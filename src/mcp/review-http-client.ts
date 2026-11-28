import type { z } from 'zod';
import type {
  ReviewResponseSubmission,
  ReviewSession,
  ReviewSubmission,
} from '../domain/notes/review-session';
import {
  REVIEW_PARTICIPANT_HEADER,
  type ReviewPollRequest,
} from '../server/contract/review-transport';
import { buildLocalServerUrl } from '../server/fixed-port';
import { fetchJson, type HttpJsonResult } from './http-json-client';
import { reviewPollResponseSchema, reviewSessionSchema } from './review-schema';
import type { submitReviewInputSchema } from './submit-review-schema';

type ReviewRequest = ReviewSubmission & Pick<z.infer<typeof submitReviewInputSchema>, 'comments'>;
type ReviewSubmissionResult = HttpJsonResult<ReviewSession>;

export function reviewUrl(port: number, repoId: string): string {
  return `${buildLocalServerUrl(port)}/api/repositories/${encodeURIComponent(repoId)}/review`;
}

export function waitForReview(
  port: number,
  repoId: string,
  request: ReviewPollRequest,
  participantId: string,
  signal: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<HttpJsonResult<{ review: ReviewSession | null; observedReviewId?: string }>> {
  return fetchJson(
    () =>
      fetchImpl(`${reviewUrl(port, repoId)}/wait`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', [REVIEW_PARTICIPANT_HEADER]: participantId },
        body: JSON.stringify(request),
        signal,
      }),
    reviewPollResponseSchema,
  );
}

export function submitReview(
  port: number,
  repoId: string,
  request: ReviewRequest,
  participantId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ReviewSubmissionResult> {
  return postSubmission(port, repoId, 'submit-review', request, participantId, fetchImpl);
}

export function submitResponse(
  port: number,
  repoId: string,
  request: ReviewResponseSubmission,
  participantId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ReviewSubmissionResult> {
  return postSubmission(port, repoId, 'submit-response', request, participantId, fetchImpl);
}

function postSubmission(
  port: number,
  repoId: string,
  action: 'submit-review' | 'submit-response',
  request: ReviewRequest | ReviewResponseSubmission,
  participantId: string,
  fetchImpl: typeof fetch,
): Promise<ReviewSubmissionResult> {
  return fetchJson(
    () =>
      fetchImpl(`${reviewUrl(port, repoId)}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', [REVIEW_PARTICIPANT_HEADER]: participantId },
        body: JSON.stringify(request),
      }),
    reviewSessionSchema,
  );
}
