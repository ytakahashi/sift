import { z } from 'zod';
import { REVIEW_VERDICTS } from '../domain/notes/review-session';
import { noteCreateTargetSchema } from './add-note-schema';
import { noteBodySchema } from './note-body-schema';
import { nonEmptyIdSchema } from './review-schema';

export const submitReviewInputSchema = z.strictObject({
  reviewId: nonEmptyIdSchema.optional().describe('ID of the review to continue or approve.'),
  abandonReviewId: nonEmptyIdSchema
    .optional()
    .describe(
      'Replace this review while it awaits a response. Use only on explicit user instruction.',
    ),
  verdict: z.enum(REVIEW_VERDICTS),
  body: z.string().optional().describe('Overall summary of the review.'),
  // Batch entries use the same nested request shape as the review HTTP endpoint.
  comments: z.array(z.strictObject({ target: noteCreateTargetSchema, body: noteBodySchema })),
  threads: z.array(
    z.discriminatedUnion('action', [
      z.strictObject({
        noteId: nonEmptyIdSchema,
        action: z.literal('resolve'),
        body: noteBodySchema.optional(),
      }),
      z.strictObject({
        noteId: nonEmptyIdSchema,
        action: z.literal('reply'),
        body: noteBodySchema,
      }),
    ]),
  ),
  continueAfterLimit: z
    .boolean()
    .optional()
    .describe('Extend the review by one round. Use only on explicit user instruction.'),
});
