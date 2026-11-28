import { z } from 'zod';
import { REVIEW_ROLES, REVIEW_VERDICTS } from '../../domain/notes/review-session';
import { RESPONSE_RESOLUTIONS } from '../../domain/notes/types';
import { REVIEW_POLL_LIMIT_MS } from '../contract/review-transport';
import { NoteRequestValidationError } from '../services/notes-store';

const nonEmpty = z.string().refine((value) => value.trim() !== '', 'Expected a non-empty string.');
const submissionFields = { body: z.string().optional(), client: z.string().optional() };

export const reviewParticipantIdSchema = z.uuid();

export const reviewPollRequestSchema = z.strictObject({
  role: z.enum(REVIEW_ROLES),
  knownReviewId: nonEmpty.optional(),
  waitMs: z.number().int().min(0).max(REVIEW_POLL_LIMIT_MS),
});

export const reviewRequestSchema = z.strictObject({
  ...submissionFields,
  reviewId: nonEmpty.optional(),
  abandonReviewId: nonEmpty.optional(),
  verdict: z.enum(REVIEW_VERDICTS),
  comments: z.array(z.unknown()),
  threads: z.array(
    z.discriminatedUnion('action', [
      z.strictObject({ noteId: nonEmpty, action: z.literal('resolve'), body: nonEmpty.optional() }),
      z.strictObject({ noteId: nonEmpty, action: z.literal('reply'), body: nonEmpty }),
    ]),
  ),
  continueAfterLimit: z.boolean().optional(),
});

export class ReviewCommentError extends Error {
  constructor(
    public readonly index: number,
    public readonly cause: unknown,
  ) {
    super(`comments[${index}]: ${cause instanceof Error ? cause.message : String(cause)}`, {
      cause,
    });
    this.name = 'ReviewCommentError';
  }
}

export const reviewResponseRequestSchema = z.strictObject({
  ...submissionFields,
  reviewId: nonEmpty,
  replies: z.array(
    z.strictObject({
      noteId: nonEmpty,
      resolution: z.enum(RESPONSE_RESOLUTIONS),
      body: nonEmpty,
    }),
  ),
});

export function parseReviewRequest<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const reasons = parsed.error.issues.map((issue) =>
      issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message,
    );
    throw new NoteRequestValidationError(reasons.join('; '));
  }
  return parsed.data;
}
