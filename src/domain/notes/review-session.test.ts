import { describe, expect, it } from 'vitest';
import {
  ReviewConflict,
  submitResponse,
  submitReview,
  type ReviewSession,
  type ReviewSubmission,
} from './review-session';
import type { NoteMetadata } from './types';

const review = (overrides: Partial<ReviewSubmission> = {}): ReviewSubmission => ({
  verdict: 'request_changes',
  threads: [],
  ...overrides,
});

const session = (state: ReviewSession['state'], round = 1): ReviewSession => ({
  reviewId: 'review-1',
  round,
  state,
  verdict: 'request_changes',
});

const thread = (
  id: string,
  overrides: Partial<NoteMetadata> = {},
): NoteMetadata & { id: string } => ({
  id,
  reviewId: 'review-1',
  status: 'open',
  replies: [],
  ...overrides,
});

const reply = (noteId: string) =>
  ({ noteId, resolution: 'fixed', body: 'Changed the implementation.' }) as const;

describe('submitReview', () => {
  it.each(['request_changes', 'comment'] as const)(
    '%s hands the turn over and opens threads',
    (verdict) => {
      // Given / When: the initial submission contains feedback
      const result = submitReview(undefined, [], review({ verdict, client: 'Agent' }), 'new');

      // Then
      expect(result.session).toMatchObject({
        reviewId: 'new',
        round: 1,
        state: 'awaiting-response',
        verdict,
      });
      expect(result.newThread).toEqual({
        reviewId: 'new',
        status: 'open',
        replies: [],
        author: { role: 'reviewer', client: 'Agent' },
      });
    },
  );

  it('rejects a review during the implementer turn', () => {
    // Given
    const current = session('awaiting-response');

    // When / Then
    expect(() => submitReview(current, [], review(), 'new')).toThrow(ReviewConflict);
  });

  it('requires the ID of the review awaiting a response before replacing it', () => {
    // Given
    const current = session('awaiting-response');

    // When / Then: a stale replacement request cannot affect the current session
    expect(() => submitReview(current, [], review({ abandonReviewId: 'previous' }), 'new')).toThrow(
      ReviewConflict,
    );

    // When
    const result = submitReview(
      current,
      [thread('old')],
      review({ abandonReviewId: current.reviewId }),
      'new',
    );

    // Then: the new review starts at round one and leaves the old thread intact
    expect(result.session).toMatchObject({ reviewId: 'new', state: 'awaiting-response', round: 1 });
    expect(result.changes.size).toBe(0);
  });

  it('lists every thread still needing reviewer acknowledgement', () => {
    // Given
    const notes = [thread('a'), thread('b'), thread('c'), thread('closed', { status: 'resolved' })];

    // When / Then
    expect(() =>
      submitReview(
        session('awaiting-review'),
        notes,
        review({
          threads: [{ noteId: 'a', action: 'reply', body: 'Can you add a check?' }],
        }),
        'new',
      ),
    ).toThrow(expect.objectContaining({ noteIds: ['b', 'c'] }));
  });

  it('rejects approval when any thread is kept open', () => {
    // Given
    const notes = [thread('a'), thread('b')];

    // When / Then
    expect(() =>
      submitReview(
        session('awaiting-review'),
        notes,
        review({
          verdict: 'approve',
          threads: [{ noteId: 'a', action: 'reply', body: 'Still needs attention.' }],
        }),
        'new',
      ),
    ).toThrow(expect.objectContaining({ noteIds: ['a', 'b'] }));
  });

  it('resolves acknowledged threads without mutating them and approves at the limit', () => {
    // Given
    const note = thread('a');

    // When
    const result = submitReview(
      session('awaiting-review', 2),
      [note],
      review({
        verdict: 'approve',
        threads: [{ noteId: 'a', action: 'resolve', body: 'Verified.' }],
      }),
      'new',
    );

    // Then
    expect(result.session).toMatchObject({ reviewId: 'review-1', round: 2, state: 'approved' });
    expect(result.newThread.status).toBe('resolved');
    expect(result.changes.get('a')).toEqual({
      status: 'resolved',
      replies: [{ author: { role: 'reviewer' }, body: 'Verified.', round: 2 }],
    });
    expect(note).toMatchObject({ status: 'open', replies: [] });
  });

  it('pauses at two handoffs and allows exactly one handoff per explicit extension', () => {
    // Given
    const current = session('awaiting-review', 2);
    const note = thread('a');
    const threads = [{ noteId: 'a', action: 'reply', body: 'Please follow up.' }] as const;

    // When
    const paused = submitReview(
      current,
      [note],
      review({ threads, body: 'One issue remains.' }),
      'new',
    );
    const resumed = submitReview(
      paused.session,
      [note],
      review({ continueAfterLimit: true }),
      'new',
    );
    const response = submitResponse(resumed.session, [note], {
      reviewId: resumed.session.reviewId,
      replies: [reply('a')],
    });
    const pausedAgain = submitReview(response.session, [note], review({ threads }), 'new');

    // Then
    expect(paused.session).toMatchObject({ reviewId: 'review-1', state: 'needs-user', round: 2 });
    expect(paused.changes.get('a')?.replies).toHaveLength(1);
    expect(resumed.session).toMatchObject({
      reviewId: 'review-1',
      state: 'awaiting-response',
      round: 3,
      reviewBody: 'One issue remains.',
    });
    expect(pausedAgain.session).toMatchObject({
      reviewId: 'review-1',
      state: 'needs-user',
      round: 3,
    });
  });

  it('rejects an early extension', () => {
    // Given / When / Then
    expect(() =>
      submitReview(session('awaiting-review'), [], review({ continueAfterLimit: true }), 'new'),
    ).toThrow(ReviewConflict);
  });

  it('approves the explicitly targeted paused review only after resolving its open threads', () => {
    // Given
    const current = session('needs-user', 2);
    const notes = [thread('a')];
    const approval = review({ verdict: 'approve', reviewId: current.reviewId });

    // When / Then: the paused review still enforces the approval condition
    expect(() => submitReview(current, notes, approval, 'new')).toThrow(
      expect.objectContaining({ noteIds: ['a'] }),
    );

    // When
    const result = submitReview(
      current,
      notes,
      { ...approval, threads: [{ noteId: 'a', action: 'resolve' }] },
      'new',
    );

    // Then
    expect(result.session).toMatchObject({
      reviewId: current.reviewId,
      state: 'approved',
      round: 2,
    });
    expect(result.changes.get('a')?.status).toBe('resolved');
  });

  it('requires the review ID to approve a paused review', () => {
    // Given
    const current = session('needs-user', 2);

    // When / Then
    expect(() =>
      submitReview(current, [thread('a')], review({ verdict: 'approve' }), 'new'),
    ).toThrow('Specify reviewId to approve the current paused review.');
  });

  it.each(['awaiting-review', 'needs-user', 'approved', 'peer-gone'] as const)(
    'rejects an approval for a different review when the current review is %s',
    (state) => {
      // Given
      const current = session(state, 2);

      // When / Then
      expect(() =>
        submitReview(current, [], review({ verdict: 'approve', reviewId: 'previous' }), 'new'),
      ).toThrow(ReviewConflict);
    },
  );

  it.each(['approved', 'needs-user', 'peer-gone'] as const)(
    'starts fresh after %s by default',
    (state) => {
      // Given
      const current = session(state, 2);

      // When
      const result = submitReview(current, [thread('old')], review(), 'new');

      // Then
      expect(result.session).toMatchObject({
        reviewId: 'new',
        state: 'awaiting-response',
        round: 1,
      });
      expect(result.changes.size).toBe(0);
    },
  );
});

describe('submitResponse', () => {
  it('requires a reply on every open thread, ignoring other reviews and resolved threads', () => {
    // Given
    const notes = [
      thread('a'),
      thread('b'),
      thread('closed', { status: 'resolved' }),
      thread('old', { reviewId: 'review-0' }),
    ];

    // When / Then
    expect(() =>
      submitResponse(session('awaiting-response'), notes, {
        reviewId: 'review-1',
        replies: [reply('a')],
      }),
    ).toThrow(expect.objectContaining({ noteIds: ['b'] }));

    // When
    const result = submitResponse(session('awaiting-response'), notes, {
      reviewId: 'review-1',
      body: 'Implemented both changes.',
      client: 'Agent',
      replies: [
        reply('a'),
        { ...reply('b'), resolution: 'declined', body: 'Required for compatibility.' },
      ],
    });

    // Then
    expect(result.session).toMatchObject({
      state: 'awaiting-review',
      round: 1,
      lastResponse: { round: 1, body: 'Implemented both changes.' },
    });
    expect(result.changes.get('b')).toEqual({
      replies: [
        {
          author: { role: 'implementer', client: 'Agent' },
          body: 'Required for compatibility.',
          resolution: 'declined',
          round: 1,
        },
      ],
    });
    expect(notes[1].replies).toEqual([]);
  });

  it.each([
    ['unknown thread', [reply('other')], 'other'],
    ['resolved thread', [reply('closed')], 'closed'],
    ['duplicate reply', [reply('a'), reply('a')], 'a'],
    ['blank fixed reply', [{ ...reply('a'), body: '  ' }], 'a'],
  ] as const)('rejects a submission with a %s', (_reason, replies, noteId) => {
    // Given
    const notes = [thread('a'), thread('closed', { status: 'resolved' })];

    // When / Then
    expect(() =>
      submitResponse(session('awaiting-response'), notes, { reviewId: 'review-1', replies }),
    ).toThrow(expect.objectContaining({ noteIds: [noteId] }));
  });

  it.each([undefined, session('awaiting-review'), session('approved')])(
    'rejects an unsolicited or repeated response (%j)',
    (current) => {
      // When / Then
      expect(() => submitResponse(current, [], { reviewId: 'review-1', replies: [] })).toThrow(
        ReviewConflict,
      );
    },
  );
});
