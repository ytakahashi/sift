import { z } from 'zod';
import { REVIEW_STATES, REVIEW_VERDICTS, type ReviewSession } from '../domain/notes/review-session';
import { RESPONSE_RESOLUTIONS } from '../domain/notes/types';

export const nonEmptyIdSchema = z.string().regex(/\S/, 'Expected a non-empty ID.');
const verdictSchema = z.enum(REVIEW_VERDICTS);
const roundSchema = z.number().int().min(0);

export const reviewSubmissionResultSchema = z.strictObject({
  reviewId: nonEmptyIdSchema,
  round: roundSchema,
  state: z.enum(REVIEW_STATES),
});

export const reviewSessionSchema: z.ZodType<ReviewSession> = reviewSubmissionResultSchema.extend({
  verdict: verdictSchema,
  reviewBody: z.string().optional(),
  lastResponse: z.strictObject({ round: roundSchema, body: z.string().optional() }).optional(),
});

export const reviewSnapshotSchema = z.strictObject({ review: reviewSessionSchema.nullable() });

export const submitResponseInputSchema = z.strictObject({
  reviewId: nonEmptyIdSchema,
  body: z.string().optional().describe('Overall summary of the response.'),
  replies: z.array(
    z.strictObject({
      noteId: nonEmptyIdSchema,
      resolution: z.enum(RESPONSE_RESOLUTIONS),
      body: z.string().regex(/\S/, 'A thread reply requires a non-empty body.'),
    }),
  ),
});

const roleSchema = z.enum(['reviewer', 'implementer']);
export type ReviewRole = z.infer<typeof roleSchema>;
export const waitForTurnInputSchema = z.strictObject({ role: roleSchema });
// Legacy MCP requires an object-rooted output schema to return the fields directly.
export const waitForTurnResultSchema = z
  .strictObject({
    status: z.enum(['your-turn', 'waiting', 'no-review', 'approved', 'needs-user', 'peer-gone']),
    reviewId: nonEmptyIdSchema.optional(),
    round: roundSchema.optional(),
    verdict: verdictSchema.optional(),
    waitingFor: roleSchema.optional(),
  })
  .refine(({ status, reviewId, round, verdict, waitingFor }) => {
    if (status === 'your-turn') {
      return reviewId !== undefined && round !== undefined && waitingFor === undefined;
    }
    if (status === 'waiting') {
      return (
        waitingFor !== undefined &&
        verdict === undefined &&
        (reviewId === undefined) === (round === undefined)
      );
    }
    return (
      reviewId === undefined &&
      round === undefined &&
      verdict === undefined &&
      waitingFor === undefined
    );
  }, 'Fields must match the review turn status.');
