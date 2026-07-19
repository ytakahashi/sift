import { z } from 'zod';
import type { Note } from '../domain/notes/types';

const lineNoteSchema = z
  .object({
    id: z.string(),
    kind: z.literal('line'),
    path: z.string(),
    startLine: z.number().int().min(1),
    endLine: z.number().int().min(1),
    bucket: z.enum(['working', 'staged']),
    body: z.string(),
    createdAt: z.number(),
  })
  .strict();

const fileNoteSchema = z
  .object({
    id: z.string(),
    kind: z.literal('file'),
    path: z.string(),
    body: z.string(),
    createdAt: z.number(),
  })
  .strict();

/**
 * Mirrors the domain `Note` type exactly (declared type keeps them in sync;
 * a shape drift between this schema and `Note` fails the build). Shared by
 * HTTP response parsing here and, later, the MCP tool `outputSchema`s.
 */
export const noteSchema: z.ZodType<Note> = z.discriminatedUnion('kind', [
  lineNoteSchema,
  fileNoteSchema,
]);

export const notesListResponseSchema: z.ZodType<{ notes: Note[] }> = z
  .object({
    notes: z.array(noteSchema),
  })
  .strict();
