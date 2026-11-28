import type { NoteAuthor, NoteMetadata, NoteReply, ResponseResolution } from './types';

export const REVIEW_ROLES = ['reviewer', 'implementer'] as const;
export type ReviewRole = (typeof REVIEW_ROLES)[number];

export const REVIEW_VERDICTS = ['request_changes', 'comment', 'approve'] as const;
export type ReviewVerdict = (typeof REVIEW_VERDICTS)[number];

export const REVIEW_STATES = [
  'awaiting-response',
  'awaiting-review',
  'approved',
  // A paused review can still be approved or extended.
  'needs-user',
  // Participant tracking sets this terminal state when a peer disconnects.
  'peer-gone',
] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];

export interface ReviewSession {
  reviewId: string;
  round: number;
  state: ReviewState;
  verdict: ReviewVerdict;
  reviewBody?: string;
  lastResponse?: { round: number; body?: string };
}

export function isActiveReview(
  review: ReviewSession | undefined,
): review is ReviewSession & { state: 'awaiting-review' | 'awaiting-response' } {
  return review?.state === 'awaiting-review' || review?.state === 'awaiting-response';
}

export type ReviewThreadAction =
  | { noteId: string; action: 'resolve'; body?: string }
  | { noteId: string; action: 'reply'; body: string };

export interface ReviewSubmission {
  reviewId?: string;
  abandonReviewId?: string;
  verdict: ReviewVerdict;
  body?: string;
  threads: readonly ReviewThreadAction[];
  continueAfterLimit?: boolean;
  client?: string;
}

export interface ReviewResponseSubmission {
  reviewId: string;
  body?: string;
  replies: readonly { noteId: string; resolution: ResponseResolution; body: string }[];
  client?: string;
}

export class ReviewConflict extends Error {
  constructor(
    message: string,
    public readonly noteIds?: readonly string[],
  ) {
    super(message);
    this.name = 'ReviewConflict';
  }
}

type SessionNote = NoteMetadata & { id: string };
type ThreadChanges = Pick<NoteMetadata, 'status' | 'replies'>;

interface ReviewTransition {
  session: ReviewSession;
  changes: ReadonlyMap<string, ThreadChanges>;
}

/** Counts how many times the reviewer has handed the turn to the implementer. */
const ROUND_LIMIT = 2;

export function isProtectedReviewThread(
  note: Pick<NoteMetadata, 'reviewId'>,
  current: ReviewSession | undefined,
): boolean {
  // A paused review can still resume, so its threads must remain available.
  return (
    current !== undefined &&
    note.reviewId === current.reviewId &&
    current.state !== 'approved' &&
    current.state !== 'peer-gone'
  );
}

function openThreads(
  session: ReviewSession | undefined,
  notes: readonly SessionNote[],
): Map<string, SessionNote> {
  if (!session) {
    return new Map();
  }
  return new Map(
    notes
      .filter((note) => note.reviewId === session.reviewId && note.status === 'open')
      .map((note) => [note.id, note]),
  );
}

function requireOpenThread(
  open: ReadonlyMap<string, SessionNote>,
  changes: ReadonlyMap<string, ThreadChanges>,
  noteId: string,
): SessionNote {
  const note = open.get(noteId);
  if (!note) {
    throw new ReviewConflict('The note is not an open thread in this review.', [noteId]);
  }
  if (changes.has(noteId)) {
    throw new ReviewConflict('A thread can only appear once in a submission.', [noteId]);
  }
  return note;
}

function requireCoverage(
  open: ReadonlyMap<string, SessionNote>,
  changes: ReadonlyMap<string, ThreadChanges>,
  message: string,
): void {
  const missing = [...open.keys()].filter((id) => !changes.has(id));
  if (missing.length > 0) {
    throw new ReviewConflict(message, missing);
  }
}

function appendReply(note: SessionNote, reply: NoteReply): readonly NoteReply[] {
  if (reply.body.trim() === '') {
    throw new ReviewConflict('A thread reply requires a non-empty body.', [note.id]);
  }
  return [...(note.replies ?? []), reply];
}

export function submitReview(
  current: ReviewSession | undefined,
  notes: readonly SessionNote[],
  submission: ReviewSubmission,
  newReviewId: string,
): ReviewTransition & { newThread: Required<NoteMetadata> } {
  if (submission.abandonReviewId !== undefined) {
    // Match the pending review at commit time so a retry cannot replace its successor.
    if (current?.state !== 'awaiting-response' || current.reviewId !== submission.abandonReviewId) {
      throw new ReviewConflict(
        'The review specified by abandonReviewId is not awaiting a response.',
      );
    }
  } else if (current?.state === 'awaiting-response') {
    throw new ReviewConflict('The implementer has not submitted a response.');
  }

  // Require an explicit target so approval cannot silently replace the paused review.
  if (
    current?.state === 'needs-user' &&
    submission.verdict === 'approve' &&
    submission.reviewId === undefined
  ) {
    throw new ReviewConflict('Specify reviewId to approve the current paused review.');
  }

  const session =
    current?.state === 'awaiting-review' ||
    (current?.state === 'needs-user' &&
      (submission.continueAfterLimit ||
        (submission.verdict === 'approve' && submission.reviewId === current.reviewId)))
      ? current
      : undefined;
  if (submission.reviewId !== undefined && submission.reviewId !== session?.reviewId) {
    throw new ReviewConflict('The requested review is not accepting this submission.');
  }
  const round = session?.round ?? 0;
  if (submission.continueAfterLimit && (round < ROUND_LIMIT || submission.verdict === 'approve')) {
    throw new ReviewConflict(
      'Continuing after the limit requires a review that hands off a round.',
    );
  }

  const author: NoteAuthor = { role: 'reviewer', client: submission.client };
  const open = openThreads(session, notes);
  const changes = new Map<string, ThreadChanges>();
  for (const thread of submission.threads) {
    const note = requireOpenThread(open, changes, thread.noteId);
    changes.set(note.id, {
      status: thread.action === 'resolve' ? 'resolved' : 'open',
      replies:
        thread.body === undefined
          ? note.replies
          : appendReply(note, { author, body: thread.body, round }),
    });
  }

  // Approval requires resolving every open thread, which also acknowledges every reply.
  // A paused review already acknowledged the last response when it reached the limit.
  const approved = submission.verdict === 'approve';
  if (session?.state === 'awaiting-review' && !approved) {
    requireCoverage(open, changes, 'Each open thread needs a reviewer resolution or reply.');
  }

  if (approved) {
    const remaining = [...open.keys()].filter((id) => changes.get(id)?.status !== 'resolved');
    if (remaining.length > 0) {
      throw new ReviewConflict('Approval requires resolving every open thread.', remaining);
    }
  }

  const reviewId = session?.reviewId ?? newReviewId;
  const atLimit = round >= ROUND_LIMIT && !submission.continueAfterLimit;
  const state = approved ? 'approved' : atLimit ? 'needs-user' : 'awaiting-response';
  return {
    session: {
      reviewId,
      // A review stopped at the limit has not handed the turn over.
      round: state === 'awaiting-response' ? round + 1 : round,
      state,
      verdict: submission.verdict,
      reviewBody:
        submission.body ?? (session?.state === 'needs-user' ? session.reviewBody : undefined),
      lastResponse: session?.lastResponse,
    },
    changes,
    // Comments accompanying approval are informational and require no response.
    newThread: { reviewId, status: approved ? 'resolved' : 'open', replies: [], author },
  };
}

export function submitResponse(
  session: ReviewSession | undefined,
  notes: readonly SessionNote[],
  submission: ReviewResponseSubmission,
): ReviewTransition {
  if (session?.state !== 'awaiting-response') {
    throw new ReviewConflict('There is no review awaiting an implementer response.');
  }
  if (submission.reviewId !== session.reviewId) {
    throw new ReviewConflict('The response does not target the current review.');
  }

  const author: NoteAuthor = { role: 'implementer', client: submission.client };
  const open = openThreads(session, notes);
  const changes = new Map<string, ThreadChanges>();
  for (const reply of submission.replies) {
    const note = requireOpenThread(open, changes, reply.noteId);
    changes.set(note.id, {
      replies: appendReply(note, {
        author,
        body: reply.body,
        resolution: reply.resolution,
        round: session.round,
      }),
    });
  }
  requireCoverage(open, changes, 'Each open thread needs an implementer reply.');

  return {
    session: {
      ...session,
      state: 'awaiting-review',
      lastResponse: { round: session.round, body: submission.body },
    },
    changes,
  };
}
