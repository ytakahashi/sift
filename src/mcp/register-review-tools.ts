import {
  CLIENT_INFO_META_KEY,
  type CallToolResult,
  type McpServer,
  type ServerContext,
} from '@modelcontextprotocol/server';
import { z } from 'zod';
import { describeInvalidResponse, describeUnreachable } from './notes-tool-guidance';
import { errorResult, httpErrorResult, successResult } from './notes-tool-results';
import type { getReview, submitResponse, submitReview } from './review-http-client';
import {
  reviewSubmissionResultSchema,
  submitResponseInputSchema,
  waitForTurnInputSchema,
  waitForTurnResultSchema,
  type ReviewRole,
} from './review-schema';
import { submitReviewInputSchema } from './submit-review-schema';
import type { ResolveToolTarget } from './tool-target';

export interface ReviewToolClients {
  getReview: typeof getReview;
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

export function registerReviewTools(
  server: McpServer,
  options: ReviewToolClients,
  resolveTarget: ResolveToolTarget,
): void {
  // Report an ended review only to a role that submitted or observed it while it was active.
  const knownReviews: Record<ReviewRole, Map<string, string>> = {
    reviewer: new Map(),
    implementer: new Map(),
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
      const pre = await resolveTarget();
      if (!pre.ok) {
        return pre.result;
      }
      const result = await options.submitReview(pre.port, pre.repoId, {
        ...args,
        client: clientName(server, ctx),
      });
      if (result.kind === 'success') {
        knownReviews.reviewer.set(pre.repoId, result.reviewId);
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
      const pre = await resolveTarget();
      if (!pre.ok) {
        return pre.result;
      }
      const result = await options.submitResponse(pre.port, pre.repoId, {
        ...args,
        client: clientName(server, ctx),
      });
      if (result.kind === 'success') {
        knownReviews.implementer.set(pre.repoId, result.reviewId);
      }
      return reviewSubmissionResult(result);
    },
  );

  server.registerTool(
    'wait_for_turn',
    {
      description:
        'Check the current review turn immediately. On your-turn, call list_notes with the ' +
        'returned reviewId to read threads. On no-review, use submit_review to start a review. ' +
        'On waiting, check again when the other agent has had a chance to submit.',
      inputSchema: waitForTurnInputSchema,
      outputSchema: waitForTurnResultSchema,
      annotations: { readOnlyHint: true },
    },
    async ({ role }) => {
      const pre = await resolveTarget();
      if (!pre.ok) {
        return pre.result;
      }
      const result = await options.getReview(pre.port, pre.repoId);
      switch (result.kind) {
        case 'http-error':
          return httpErrorResult(result);
        case 'invalid-response':
        case 'invalid-error-response':
          return errorResult(describeInvalidResponse());
        case 'network-error':
          return errorResult(describeUnreachable());
      }

      const review = result.review;
      if (review) {
        const { reviewId, round, state, verdict } = review;
        const roleReviews = knownReviews[role];
        if (state === 'awaiting-review' || state === 'awaiting-response') {
          roleReviews.set(pre.repoId, reviewId);
          const waitingFor = state === 'awaiting-review' ? 'reviewer' : 'implementer';
          return role === waitingFor
            ? successResult({
                status: 'your-turn',
                reviewId,
                round,
                ...(role === 'implementer' ? { verdict } : {}),
              })
            : waitingResult({ waitingFor, reviewId, round });
        }
        if (roleReviews.get(pre.repoId) === reviewId) {
          return successResult({ status: state });
        }
      }
      return role === 'reviewer'
        ? successResult(
            { status: 'no-review' },
            'There is no active review. Call submit_review to start one.',
          )
        : waitingResult({ waitingFor: 'reviewer' });
    },
  );
}

function waitingResult(details: {
  waitingFor: ReviewRole;
  reviewId?: string;
  round?: number;
}): CallToolResult {
  return successResult(
    { status: 'waiting', ...details },
    'Call wait_for_turn again when the other agent has had a chance to submit.',
  );
}
