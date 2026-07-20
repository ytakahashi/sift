import { z } from 'zod';
import type { Note, NoteCreateTarget } from '../domain/notes/types';
import { noteSchema } from './notes-schema';

const lineTargetInputSchema = z
  .object({
    kind: z.literal('line'),
    path: z.string().min(1),
    startLine: z.number().int().min(1),
    endLine: z.number().int().min(1),
    bucket: z.enum(['working', 'staged']).optional(),
    body: z.string().min(1),
  })
  .strict();

const fileTargetInputSchema = z
  .object({
    kind: z.literal('file'),
    path: z.string().min(1),
    body: z.string().min(1),
  })
  .strict();

/**
 * Flat `add_note` arguments: `NoteCreateTarget` and `body` combined into one
 * object rather than nested, since flatter tool arguments are more reliable
 * for a model to call correctly.
 */
export const addNoteInputSchema: z.ZodType<NoteCreateTarget & { body: string }> =
  z.discriminatedUnion('kind', [lineTargetInputSchema, fileTargetInputSchema]);

export const addNoteOutputSchema: z.ZodType<{ note: Note }> = z
  .object({ note: noteSchema })
  .strict();
