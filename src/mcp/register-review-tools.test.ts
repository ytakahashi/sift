import { describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/client';
import {
  CLIENT_INFO_META_KEY,
  InMemoryTransport,
  McpServer,
  type CallToolResult,
} from '@modelcontextprotocol/server';
import { registerReviewTools, type ReviewToolClients } from './register-review-tools';
import type { ResolveToolTarget } from './tool-target';

type ToolCallback = (
  args?: unknown,
  ctx?: { mcpReq: { envelope?: Record<string, unknown>; signal?: AbortSignal } },
) => Promise<CallToolResult>;

function createFakeServer(client?: string): {
  server: McpServer;
  tools: Map<string, ToolCallback>;
} {
  const tools = new Map<string, ToolCallback>();
  const registerTool = vi.fn((name: string, _config: unknown, cb: ToolCallback) => {
    tools.set(name, (args, ctx) =>
      cb(args, { mcpReq: { signal: new AbortController().signal, ...ctx?.mcpReq } }),
    );
  });
  return {
    server: {
      registerTool,
      server: { getClientVersion: () => (client ? { name: client } : undefined) },
    } as unknown as McpServer,
    tools,
  };
}

const resolveTarget: ResolveToolTarget = async () => ({
  ok: true,
  port: 49321,
  repoId: 'sift-repo',
});

function createOptions(overrides: Partial<ReviewToolClients> = {}): ReviewToolClients {
  return {
    connect: vi.fn().mockResolvedValue({ kind: 'connected', participantId: 'participant' }),
    waitForReview: vi.fn(),
    submitReview: vi.fn(),
    submitResponse: vi.fn(),
    ...overrides,
  };
}

describe('registerReviewTools', () => {
  it('returns object-shaped turn status and indexed comment errors over legacy MCP', async () => {
    // Given
    const server = new McpServer({ name: 'test-server', version: '1' });
    const client = new Client({ name: 'test-client', version: '1' });
    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
    const submitReview = vi.fn();
    const options = createOptions({
      waitForReview: vi.fn().mockResolvedValue({ kind: 'success', review: null }),
      submitReview,
    });
    registerReviewTools(server, options, resolveTarget);
    await server.connect(serverTransport);
    try {
      await client.connect(clientTransport);

      // When
      const { tools } = await client.listTools();
      const waiting = await client.callTool({
        name: 'wait_for_turn',
        arguments: { role: 'implementer' },
      });
      const noReview = await client.callTool({
        name: 'wait_for_turn',
        arguments: { role: 'reviewer' },
      });
      const invalid = await client.callTool({
        name: 'submit_review',
        arguments: {
          verdict: 'comment',
          comments: [
            { target: { kind: 'file', path: 'a.ts' }, body: 'Valid comment' },
            { target: { kind: 'file', path: 'b.ts' }, body: '' },
          ],
          threads: [],
        },
      });

      // Then
      expect(tools.find((tool) => tool.name === 'wait_for_turn')?.outputSchema?.type).toBe(
        'object',
      );
      expect(waiting).toMatchObject({
        structuredContent: { status: 'waiting', waitingFor: 'reviewer' },
      });
      expect(noReview).toMatchObject({
        structuredContent: { status: 'no-review' },
        content: [
          { type: 'text', text: '{"status":"no-review"}' },
          { type: 'text', text: 'There is no active review. Call submit_review to start one.' },
        ],
      });
      expect(invalid).toMatchObject({ isError: true });
      expect(JSON.stringify(invalid.content)).toContain('comments.1.body');
      expect(submitReview).not.toHaveBeenCalled();
    } finally {
      await client.close();
      await server.close();
    }
  });

  it('submits the reviewer turn with the initialized client name and returns a summary', async () => {
    // Given
    const submitReview = vi.fn().mockResolvedValue({
      kind: 'success',
      reviewId: 'r1',
      round: 1,
      state: 'awaiting-response',
      verdict: 'request_changes',
      reviewBody: 'Please address this.',
    });
    const { server, tools } = createFakeServer('legacy-client');
    registerReviewTools(server, createOptions({ submitReview }), resolveTarget);
    const args = {
      verdict: 'request_changes',
      comments: [{ target: { kind: 'file', path: 'a.ts' }, body: 'Use the shared helper.' }],
      threads: [],
    };

    // When
    const result = await tools.get('submit_review')!(args, { mcpReq: {} });

    // Then
    expect(submitReview).toHaveBeenCalledWith(
      49321,
      'sift-repo',
      {
        ...args,
        client: 'legacy-client',
      },
      'participant',
    );
    expect(result.structuredContent).toEqual({
      reviewId: 'r1',
      round: 1,
      state: 'awaiting-response',
    });
  });

  it('uses the per-request client name and reports IDs of threads missing a response', async () => {
    // Given
    const submitResponse = vi.fn().mockResolvedValue({
      kind: 'http-error',
      status: 409,
      code: 'REVIEW_CONFLICT',
      message: 'Each open thread needs an implementer reply.',
      noteIds: ['n1', 'n2'],
    });
    const { server, tools } = createFakeServer();
    registerReviewTools(server, createOptions({ submitResponse }), resolveTarget);

    // When
    const result = await tools.get('submit_response')!(
      { reviewId: 'r1', replies: [] },
      {
        mcpReq: { envelope: { [CLIENT_INFO_META_KEY]: { name: 'modern-client', version: '1' } } },
      },
    );

    // Then
    expect(submitResponse).toHaveBeenCalledWith(
      49321,
      'sift-repo',
      {
        reviewId: 'r1',
        replies: [],
        client: 'modern-client',
      },
      'participant',
    );
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      { type: 'text', text: 'Each open thread needs an implementer reply. Note IDs: n1, n2.' },
    ]);
  });

  it.each([
    {
      status: 422,
      code: 'NOTE_TARGET_NOT_FOUND',
      message: 'comments[0]: File path not found.',
      guidance: 'Check the path.',
    },
    {
      status: 503,
      code: 'NOTE_GENERATION_UNAVAILABLE',
      message: 'comments[0]: File state unavailable.',
      guidance: 'retry with the same content.',
    },
  ])('returns corrective guidance for $code', async ({ status, code, message, guidance }) => {
    // Given
    const submitReview = vi.fn().mockResolvedValue({ kind: 'http-error', status, code, message });
    const { server, tools } = createFakeServer();
    registerReviewTools(server, createOptions({ submitReview }), resolveTarget);

    // When
    const result = await tools.get('submit_review')!(
      { verdict: 'comment', comments: [], threads: [] },
      { mcpReq: {} },
    );

    // Then
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: 'text', text: expect.stringContaining(message) }]);
    expect(JSON.stringify(result.content)).toContain(guidance);
  });

  it.each([
    { kind: 'http-error', status: 500, message: 'Internal server error.' },
    { kind: 'http-error', status: 502, message: 'Bad gateway.' },
    { kind: 'network-error' },
    { kind: 'invalid-response' },
    { kind: 'invalid-error-response' },
  ])(
    'asks the reviewer to check whether the submission was saved for $kind $status',
    async (failure) => {
      // Given
      const submitReview = vi.fn().mockResolvedValue(failure);
      const { server, tools } = createFakeServer();
      registerReviewTools(server, createOptions({ submitReview }), resolveTarget);

      // When
      const result = await tools.get('submit_review')!(
        { verdict: 'comment', comments: [], threads: [] },
        { mcpReq: {} },
      );

      // Then
      expect(result.isError).toBe(true);
      expect(result.content).toEqual([
        {
          type: 'text',
          text: 'Could not confirm whether the review submission was saved. Check wait_for_turn and list_notes for the review before retrying.',
        },
      ]);
    },
  );

  it('returns repository guidance when the turn lookup is rejected', async () => {
    // Given
    const waitForReview = vi.fn().mockResolvedValue({
      kind: 'http-error',
      status: 404,
      code: 'REPOSITORY_NOT_FOUND',
      message: 'Repository not found.',
    });
    const { server, tools } = createFakeServer();
    registerReviewTools(server, createOptions({ waitForReview }), resolveTarget);

    // When
    const result = await tools.get('wait_for_turn')!({ role: 'implementer' });

    // Then
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      { type: 'text', text: "Repository not found. Check the repository's registration state." },
    ]);
  });

  it.each([
    { fullPolls: 13, gapMs: 0, remainingMs: 15_000 },
    { fullPolls: 12, gapMs: 59_000, remainingMs: 1_000 },
  ])(
    'honors the existing deadline after a $gapMs ms gap',
    async ({ fullPolls, gapMs, remainingMs }) => {
      vi.useFakeTimers({ toFake: ['performance'] });
      try {
        // Given: each poll waits the full duration it was asked to wait
        const waitForReview = vi.fn<ReviewToolClients['waitForReview']>(
          async (_port, _repoId, { waitMs }) => {
            vi.advanceTimersByTime(waitMs);
            return { kind: 'success', review: null };
          },
        );
        const { server, tools } = createFakeServer();
        registerReviewTools(server, createOptions({ waitForReview }), resolveTarget);
        const checkTurn = (): Promise<CallToolResult> =>
          tools.get('wait_for_turn')!({ role: 'implementer' });

        // When
        for (let poll = 0; poll < fullPolls; poll++) {
          await expect(checkTurn()).resolves.toMatchObject({
            structuredContent: { status: 'waiting' },
          });
        }
        vi.advanceTimersByTime(gapMs);
        const timeout = await checkTurn();
        await checkTurn();

        // Then
        expect(timeout.structuredContent).toEqual({ status: 'timeout' });
        expect(waitForReview.mock.calls.map(([, , request]) => request.waitMs)).toEqual([
          ...Array<number>(fullPolls).fill(45_000),
          remainingMs,
          45_000,
        ]);
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it('starts a fresh wait when the caller resumes after a long gap', async () => {
    vi.useFakeTimers({ toFake: ['performance'] });
    try {
      // Given
      const waitForReview = vi.fn().mockResolvedValue({ kind: 'success', review: null });
      const { server, tools } = createFakeServer();
      registerReviewTools(server, createOptions({ waitForReview }), resolveTarget);
      const checkTurn = (): Promise<CallToolResult> =>
        tools.get('wait_for_turn')!({ role: 'implementer' });
      await checkTurn();
      vi.advanceTimersByTime(10 * 60_000 + 1);

      // When
      const resumed = await checkTurn();

      // Then
      expect(resumed.structuredContent).toEqual({ status: 'waiting', waitingFor: 'reviewer' });
      expect(waitForReview.mock.calls.map(([, , request]) => request.waitMs)).toEqual([
        45_000, 45_000,
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    [{ kind: 'rejected', status: 404 }, 'same Sift version'],
    [
      {
        kind: 'rejected',
        status: 409,
        code: 'REVIEW_CONFLICT',
        message: 'This review participant already has an open connection.',
      },
      'already has an open connection. Wait briefly and retry.',
    ],
    [{ kind: 'unreachable' }, 'Check that the local Sift server is running'],
  ])(
    'reports actionable guidance when the participant connection fails (%j)',
    async (failure, guidance) => {
      // Given
      const connect = vi.fn().mockResolvedValue(failure);
      const options = createOptions({ connect });
      const { server, tools } = createFakeServer();
      registerReviewTools(server, options, resolveTarget);

      // When
      const result = await tools.get('wait_for_turn')!({ role: 'implementer' });

      // Then
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result.content)).toContain(guidance);
      expect(options.waitForReview).not.toHaveBeenCalled();
    },
  );

  it('reports peer-gone if a review ended during the first poll that observed it', async () => {
    // Given
    const waitForReview = vi.fn().mockResolvedValue({
      kind: 'success',
      review: { reviewId: 'r1', round: 1, state: 'peer-gone', verdict: 'comment' },
      observedReviewId: 'r1',
    });
    const { server, tools } = createFakeServer();
    registerReviewTools(server, createOptions({ waitForReview }), resolveTarget);

    // When
    const result = await tools.get('wait_for_turn')!({ role: 'reviewer' });

    // Then
    expect(result.structuredContent).toEqual({ status: 'peer-gone' });
  });

  it('reports peer-gone to the reviewer that submitted the review', async () => {
    // Given
    const review = { reviewId: 'r1', round: 1, verdict: 'request_changes' };
    const submitReview = vi.fn().mockResolvedValue({
      kind: 'success',
      ...review,
      state: 'awaiting-response',
    });
    const waitForReview = vi.fn().mockResolvedValue({
      kind: 'success',
      review: { ...review, state: 'peer-gone' },
    });
    const { server, tools } = createFakeServer();
    registerReviewTools(server, createOptions({ submitReview, waitForReview }), resolveTarget);
    await tools.get('submit_review')!(
      { verdict: review.verdict, comments: [], threads: [] },
      { mcpReq: {} },
    );

    // When: the implementer disconnects before the reviewer's first status check
    const result = await tools.get('wait_for_turn')!({ role: 'reviewer' });

    // Then
    expect(result.structuredContent).toEqual({ status: 'peer-gone' });
  });

  it.each(['approved', 'needs-user', 'peer-gone'] as const)(
    'guides a new reviewer to start a review when the previous review is %s',
    async (state) => {
      // Given
      const waitForReview = vi.fn().mockResolvedValue({
        kind: 'success',
        review: {
          reviewId: 'old',
          round: 2,
          state,
          verdict: state === 'approved' ? 'approve' : 'request_changes',
        },
      });
      const { server, tools } = createFakeServer();
      registerReviewTools(server, createOptions({ waitForReview }), resolveTarget);

      // When
      const result = await tools.get('wait_for_turn')!({ role: 'reviewer' });

      // Then
      expect(result.structuredContent).toEqual({ status: 'no-review' });
      expect(result.content).toContainEqual({
        type: 'text',
        text: 'There is no active review. Call submit_review to start one.',
      });
    },
  );

  it('reports needs-user after the reviewer observed the review while active', async () => {
    // Given
    const review = { reviewId: 'r1', round: 2, verdict: 'request_changes' };
    const waitForReview = vi
      .fn()
      .mockResolvedValueOnce({ kind: 'success', review: { ...review, state: 'awaiting-review' } })
      .mockResolvedValueOnce({ kind: 'success', review: { ...review, state: 'needs-user' } });
    const { server, tools } = createFakeServer();
    registerReviewTools(server, createOptions({ waitForReview }), resolveTarget);
    const checkTurn = tools.get('wait_for_turn')!;
    await checkTurn({ role: 'reviewer' });

    // When
    const result = await checkTurn({ role: 'reviewer' });

    // Then
    expect(result.structuredContent).toEqual({ status: 'needs-user' });
  });

  it.each(['approved', 'needs-user', 'peer-gone'] as const)(
    'skips an old terminal review and reports %s for a review the implementer observed',
    async (state) => {
      // Given
      const review = { reviewId: 'r1', round: 1, verdict: 'request_changes' };
      const waitForReview = vi
        .fn()
        .mockResolvedValueOnce({
          kind: 'success',
          review: { ...review, reviewId: 'old', state: 'approved' },
        })
        .mockResolvedValueOnce({
          kind: 'success',
          review: { ...review, state: 'awaiting-response' },
        })
        .mockResolvedValueOnce({ kind: 'success', review: { ...review, state: 'awaiting-review' } })
        .mockResolvedValueOnce({ kind: 'success', review: { ...review, state } });
      const { server, tools } = createFakeServer();
      registerReviewTools(server, createOptions({ waitForReview }), resolveTarget);
      const checkTurn = tools.get('wait_for_turn')!;

      // When
      const results = [];
      for (const role of ['implementer', 'implementer', 'reviewer', 'implementer']) {
        results.push(await checkTurn({ role }));
      }

      // Then
      expect(results.map((result) => result.structuredContent)).toEqual([
        { status: 'waiting', waitingFor: 'reviewer' },
        { status: 'your-turn', ...review },
        { status: 'your-turn', reviewId: review.reviewId, round: review.round },
        { status: state },
      ]);
    },
  );
});
