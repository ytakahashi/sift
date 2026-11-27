import type { z } from 'zod';
import type {
  ReviewResponseSubmission,
  ReviewSession,
  ReviewSubmission,
} from '../domain/notes/review-session';
import { buildLocalServerUrl } from '../server/fixed-port';
import { fetchJson, type HttpJsonResult } from './http-json-client';
import { reviewSessionSchema, reviewSnapshotSchema } from './review-schema';
import type { submitReviewInputSchema } from './submit-review-schema';

type ReviewRequest = ReviewSubmission & Pick<z.infer<typeof submitReviewInputSchema>, 'comments'>;
type ReviewSubmissionResult = HttpJsonResult<ReviewSession>;

function reviewUrl(port: number, repoId: string): string {
  return `${buildLocalServerUrl(port)}/api/repositories/${encodeURIComponent(repoId)}/review`;
}

export function getReview(
  port: number,
  repoId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<HttpJsonResult<{ review: ReviewSession | null }>> {
  return fetchJson(() => fetchImpl(reviewUrl(port, repoId)), reviewSnapshotSchema);
}

export function submitReview(
  port: number,
  repoId: string,
  request: ReviewRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<ReviewSubmissionResult> {
  return postSubmission(port, repoId, 'submit-review', request, fetchImpl);
}

export function submitResponse(
  port: number,
  repoId: string,
  request: ReviewResponseSubmission,
  fetchImpl: typeof fetch = fetch,
): Promise<ReviewSubmissionResult> {
  return postSubmission(port, repoId, 'submit-response', request, fetchImpl);
}

function postSubmission(
  port: number,
  repoId: string,
  action: 'submit-review' | 'submit-response',
  request: ReviewRequest | ReviewResponseSubmission,
  fetchImpl: typeof fetch,
): Promise<ReviewSubmissionResult> {
  return fetchJson(
    () =>
      fetchImpl(`${reviewUrl(port, repoId)}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      }),
    reviewSessionSchema,
  );
}
