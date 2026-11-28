import type { ReviewRole } from '../../domain/notes/review-session';

export const REVIEW_PARTICIPANT_HEADER = 'x-sift-review-participant';
export const REVIEW_POLL_LIMIT_MS = 45_000;

export interface ReviewPollRequest {
  role: ReviewRole;
  knownReviewId?: string;
  waitMs: number;
}
