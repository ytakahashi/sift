import { z } from 'zod';

/**
 * The text of a note, accepting exactly what the server's `readNoteBody`
 * accepts: a body that is empty or whitespace-only is rejected here rather
 * than round-tripping into a NOTE_REQUEST_INVALID.
 *
 * Whitespace decides emptiness but is never stripped, so the note keeps the
 * exact text the caller wrote (the indentation of a quoted snippet, say).
 */
export const noteBodySchema: z.ZodType<string> = z
  .string()
  .refine((value) => value.trim() !== '', 'Note body must contain non-whitespace text.');
