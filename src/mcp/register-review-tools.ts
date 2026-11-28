import {
  CLIENT_INFO_META_KEY,
  type CallToolResult,
  type McpServer,
  type ServerContext,
} from '@modelcontextprotocol/server';
import { z } from 'zod';
import { isActiveReview, type ReviewRole } from '../domain/notes/review-session';
import { REVIEW_POLL_LIMIT_MS } from '../server/contract/review-transport';
import { describeInvalidResponse, describeUnreachable } from './notes-tool-guidance';
import { errorResult, httpErrorResult, successResult } from './notes-tool-results';
import type { submitResponse, submitReview, waitForReview } from './review-http-client';
import {
  reviewSubmissionResultSchema,
  submitResponseInputSchema,
  waitForTurnInputSchema,
  waitForTurnResultSchema,
} from './review-schema';
import { submitReviewInputSchema } from './submit-review-schema';
import type { ReviewPresence } from './review-presence';
import type { ResolveToolTarget } from './tool-target';

export interface ReviewToolClients {
  connect: ReviewPresence['connect'];
  waitForReview: typeof waitForReview;
  submitReview: typeof submitReview;
  submitResponse: typeof submitResponse;
}

function reviewSubmissionResult(result: Awaited<ReturnType<typeof submitReview>>): CallToolResult {
  if (result.kind === 'success') {
    const { reviewId, round, state } = result;
    return successResult({ reviewId, round, state });
  }
  if (
    result.kind === 'http-error' &&
    (result.status < 500 || result.code === 'NOTE_GENERATION_UNAVAILABLE')
  ) {
    return httpErrorResult(result);
  }
  // A submission can advance the round or create a new review before its acknowledgement is lost.
  return errorResult(
    'Could not confirm whether the review submission was saved. Check wait_for_turn and ' +
      'list_notes for the review before retrying.',
  );
}

const clientInfoSchema = z.object({ name: z.string() });

function clientName(server: McpServer, ctx: ServerContext): string | undefined {
  const envelope: Record<string, unknown> | undefined = ctx.mcpReq.envelope;
  const info = clientInfoSchema.safeParse(envelope?.[CLIENT_INFO_META_KEY]);
  return info.success ? info.data.name : server.server.getClientVersion()?.name;
}

const REVIEW_WAIT_LIMIT_MS = 10 * 60_000;
const REVIEW_WAIT_RESTART_GAP_MS = REVIEW_POLL_LIMIT_MS + 15_000;

type WaitingTurn = { waitingFor: ReviewRole; reviewId?: string; round?: number };

interface ReviewProgress {
  reviewId?: string;
  wait?: { deadline: number; lastReturnedAt: number };
}

export function registerReviewTools(
  server: McpServer,
  options: ReviewToolClients,
  resolveTarget: ResolveToolTarget,
): void {
  // Report an ended review only to a role that submitted or observed it while it was active.
  const progress: Record<ReviewRole, Map<string, ReviewProgress>> = {
    reviewer: new Map(),
    implementer: new Map(),
  };

  const resolveParticipant: ResolveParticipant = async () => {
    const target = await resolveTarget();
    if (!target.ok) {
      return target;
    }
    const connection = await options.connect(target.port, target.repoId);
    switch (connection.kind) {
      case 'connected':
        return { ...target, participantId: connection.participantId };
      case 'rejected': {
        const { status, code } = connection;
        if (status === 404 && !code) {
          return {
            ok: false,
            result: errorResult(
              'The running Sift server does not support review participant connections. Make sure ' +
                'the server and MCP process are from the same Sift version, then restart the server.',
            ),
          };
        }
        const message = connection.message ?? 'Could not open the review participant connection.';
        return {
          ok: false,
          result: httpErrorResult({
            kind: 'http-error',
            status,
            code,
            message: status === 409 ? message + ' Wait briefly and retry.' : message,
          }),
        };
      }
      case 'unreachable':
        return {
          ok: false,
          result: errorResult(
            'Could not open the review participant connection. Check that the local Sift server is running and retry.',
          ),
        };
    }
  };

  server.registerTool(
    'submit_review',
    {
      description:
        'Start a review or submit the reviewer turn. New comments are saved together only if ' +
        'every comment is valid. Address each open thread after an implementer response with ' +
        'resolve or reply. Reply requires a body. Approval requires resolving all open threads ' +
        'and an explicit reviewId for a paused review. Use continueAfterLimit or abandonReviewId ' +
        'only on explicit user instruction.',
      inputSchema: submitReviewInputSchema,
      outputSchema: reviewSubmissionResultSchema,
      annotations: { idempotentHint: false, destructiveHint: true },
    },
    async (args, ctx) => {
      const pre = await resolveParticipant();
      if (!pre.ok) {
        return pre.result;
      }
      ctx.mcpReq.signal.throwIfAborted();
      const result = await options.submitReview(
        pre.port,
        pre.repoId,
        { ...args, client: clientName(server, ctx) },
        pre.participantId,
      );
      if (result.kind === 'success') {
        progress.reviewer.set(pre.repoId, { reviewId: result.reviewId });
      }
      return reviewSubmissionResult(result);
    },
  );

  server.registerTool(
    'submit_response',
    {
      description:
        'Submit the implementer turn for the specified reviewId. Include exactly one reply for ' +
        'every open thread, including stale threads. Every reply requires a non-empty body and ' +
        'a resolution of fixed, declined, or discuss.',
      inputSchema: submitResponseInputSchema,
      outputSchema: reviewSubmissionResultSchema,
      annotations: { idempotentHint: false, destructiveHint: false },
    },
    async (args, ctx) => {
      const pre = await resolveParticipant();
      if (!pre.ok) {
        return pre.result;
      }
      ctx.mcpReq.signal.throwIfAborted();
      const result = await options.submitResponse(
        pre.port,
        pre.repoId,
        { ...args, client: clientName(server, ctx) },
        pre.participantId,
      );
      if (result.kind === 'success') {
        progress.implementer.set(pre.repoId, { reviewId: result.reviewId });
      }
      return reviewSubmissionResult(result);
    },
  );

  server.registerTool(
    'wait_for_turn',
    {
      description:
        'Wait up to 45 seconds for the current review turn. On your-turn, call list_notes with ' +
        'the returned reviewId to read threads. On no-review, use submit_review to start a review. ' +
        'On waiting, call wait_for_turn again. On timeout or peer-gone, stop and tell the user.',
      inputSchema: waitForTurnInputSchema,
      outputSchema: waitForTurnResultSchema,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ role }, ctx) => {
      const startedAt = performance.now();
      const pre = await resolveParticipant();
      if (!pre.ok) {
        return pre.result;
      }
      const roleProgress = progress[role].get(pre.repoId) ?? {};
      progress[role].set(pre.repoId, roleProgress);

      // A long gap between calls starts a fresh wait. Time spent in a poll still
      // counts toward the deadline when the caller follows up promptly.
      const previous = roleProgress.wait;
      const deadline =
        previous && startedAt - previous.lastReturnedAt <= REVIEW_WAIT_RESTART_GAP_MS
          ? previous.deadline
          : startedAt + REVIEW_WAIT_LIMIT_MS;
      const waitMs = Math.min(
        REVIEW_POLL_LIMIT_MS,
        Math.max(0, Math.ceil(deadline - performance.now())),
      );
      const result = await options.waitForReview(
        pre.port,
        pre.repoId,
        { role, knownReviewId: roleProgress.reviewId, waitMs },
        pre.participantId,
        ctx.mcpReq.signal,
      );
      if (result.kind !== 'success') {
        roleProgress.wait = undefined;
        switch (result.kind) {
          case 'http-error':
            return httpErrorResult(result);
          case 'invalid-response':
          case 'invalid-error-response':
            return errorResult(describeInvalidResponse());
          case 'network-error':
            return errorResult(describeUnreachable());
        }
      }

      const review = result.review ?? undefined;
      // A review first observed by the server may have ended before the poll returned.
      roleProgress.reviewId = result.observedReviewId ?? roleProgress.reviewId;
      let waiting: WaitingTurn;
      if (isActiveReview(review)) {
        const { reviewId, round, state, verdict } = review;
        roleProgress.reviewId = reviewId;
        const waitingFor = state === 'awaiting-review' ? 'reviewer' : 'implementer';
        if (role === waitingFor) {
          roleProgress.wait = undefined;
          return successResult({
            status: 'your-turn',
            reviewId,
            round,
            ...(role === 'implementer' ? { verdict } : {}),
          });
        }
        waiting = { waitingFor, reviewId, round };
      } else if (review && review.reviewId === roleProgress.reviewId) {
        roleProgress.wait = undefined;
        return successResult({ status: review.state });
      } else if (role === 'reviewer') {
        roleProgress.wait = undefined;
        return successResult(
          { status: 'no-review' },
          'There is no active review. Call submit_review to start one.',
        );
      } else {
        waiting = { waitingFor: 'reviewer' };
      }

      const returnedAt = performance.now();
      if (returnedAt >= deadline) {
        roleProgress.wait = undefined;
        return successResult(
          { status: 'timeout' },
          'The review wait reached 10 minutes. Stop and tell the user the current situation.',
        );
      }
      roleProgress.wait = { deadline, lastReturnedAt: returnedAt };
      return waitingResult(waiting);
    },
  );
}

type ResolveParticipant = () => Promise<
  | { ok: true; repoId: string; port: number; participantId: string }
  | { ok: false; result: CallToolResult }
>;

function waitingResult(details: WaitingTurn): CallToolResult {
  return successResult(
    { status: 'waiting', ...details },
    'Call wait_for_turn again to keep waiting.',
  );
}
