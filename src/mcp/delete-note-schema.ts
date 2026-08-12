import { z } from 'zod';

export const deleteNoteInputSchema: z.ZodType<{ noteId: string }> = z
  .object({
    noteId: z.string().min(1).describe('Id of the note to delete, as returned by list_notes.'),
  })
  .strict();

/**
 * The HTTP DELETE answers 204 with no body, so this result is assembled from
 * the request rather than parsed from a response. It exists so the tool still
 * reports a structured outcome naming what was deleted.
 */
export const deleteNoteOutputSchema: z.ZodType<{ deleted: true; noteId: string }> = z
  .object({
    deleted: z.literal(true),
    noteId: z.string(),
  })
  .strict();
