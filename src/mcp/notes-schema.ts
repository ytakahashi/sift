import { z } from 'zod';
import { NOTE_STALE_REASONS, type Note, type NoteStaleness } from '../domain/notes/types';

export const listNotesInputSchema = z
  .object({
    includeStale: z
      .boolean()
      .optional()
      .describe(
        'Include notes whose creation-time anchors no longer apply to the current repository ' +
          'state. Defaults to false. A file note may be live while its tracked file is outside ' +
          'the current diff.',
      ),
  })
  .strict();

const stalenessSchema: z.ZodType<NoteStaleness> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('live') }).strict(),
  z.object({ kind: z.literal('stale'), reason: z.enum(NOTE_STALE_REASONS) }).strict(),
]);

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
    staleness: stalenessSchema,
  })
  .strict();

const fileNoteSchema = z
  .object({
    id: z.string(),
    kind: z.literal('file'),
    path: z.string(),
    body: z.string(),
    createdAt: z.number(),
    staleness: stalenessSchema,
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

/** Shape of the `GET /notes` response body. Always carries every stored note. */
export const notesListResponseSchema: z.ZodType<{ notes: Note[] }> = z
  .object({
    notes: z.array(noteSchema),
  })
  .strict();

/**
 * Shape of the `list_notes` tool result. Distinct from the HTTP response
 * because `staleCount` is computed while filtering here: the API has no
 * business carrying a field that only exists to explain an omission the MCP
 * layer made.
 */
export const listNotesOutputSchema: z.ZodType<{ notes: Note[]; staleCount: number }> = z
  .object({
    notes: z.array(noteSchema),
    staleCount: z.number().int().min(0),
  })
  .strict();
