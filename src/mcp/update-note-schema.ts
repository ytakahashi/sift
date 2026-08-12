import { z } from 'zod';
import type { Note } from '../domain/notes/types';
import { noteBodySchema } from './note-body-schema';
import { noteSchema } from './notes-schema';

/**
 * `update_note` replaces the whole body rather than patching part of it, so
 * the caller always sends the complete text.
 */
export const updateNoteInputSchema: z.ZodType<{ noteId: string; body: string }> = z
  .object({
    noteId: z.string().min(1).describe('Id of the note to update, as returned by list_notes.'),
    body: noteBodySchema.describe('The new note text. Replaces the existing body entirely.'),
  })
  .strict();

export const updateNoteOutputSchema: z.ZodType<{ note: Note }> = z
  .object({ note: noteSchema })
  .strict();
