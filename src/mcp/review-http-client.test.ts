import { describe, expect, it, vi } from 'vitest';
import { submitResponse, submitReview, waitForReview } from './review-http-client';

const url = 'http://127.0.0.1:49321/api/repositories/repo%2Fone/review';

describe('review HTTP client', () => {
  it('long polls the review and preserves the observed review ID and optional fields', async () => {
    // Given
    const review = {
      reviewId: 'r1',
      round: 1,
      state: 'awaiting-review',
      verdict: 'request_changes',
      lastResponse: { round: 1, body: 'Updated the call sites.' },
    };
    const request = { role: 'reviewer' as const, waitMs: 45_000 };
    const signal = new AbortController().signal;
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({ review, observedReviewId: 'r1' }));

    // When
    const result = await waitForReview(
      49321,
      'repo/one',
      request,
      'participant',
      signal,
      fetchImpl,
    );

    // Then
    expect(fetchImpl).toHaveBeenCalledWith(`${url}/wait`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-sift-review-participant': 'participant' },
      body: JSON.stringify(request),
      signal,
    });
    expect(result).toEqual({ kind: 'success', review, observedReviewId: 'r1' });
  });

  it('posts nested review comments and preserves the rejected comment index', async () => {
    // Given
    const request = {
      verdict: 'request_changes' as const,
      comments: [
        { target: { kind: 'file' as const, path: 'a.ts' }, body: 'Use the shared helper.' },
      ],
      threads: [],
      client: 'test reviewer',
    };
    const fetchImpl = vi.fn().mockResolvedValue(
      Response.json(
        {
          error: 'comments[0]: No matching file.',
          code: 'NOTE_TARGET_NOT_FOUND',
          commentIndex: 0,
        },
        { status: 404 },
      ),
    );

    // When
    const result = await submitReview(49321, 'repo/one', request, 'participant', fetchImpl);

    // Then
    expect(fetchImpl).toHaveBeenCalledWith(`${url}/submit-review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-sift-review-participant': 'participant' },
      body: JSON.stringify(request),
    });
    expect(result).toMatchObject({
      kind: 'http-error',
      status: 404,
      code: 'NOTE_TARGET_NOT_FOUND',
      message: 'comments[0]: No matching file.',
      commentIndex: 0,
    });
  });

  it('posts the response and preserves missing thread IDs', async () => {
    // Given
    const request = { reviewId: 'r1', replies: [], client: 'test implementer' };
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { error: 'Missing replies.', code: 'REVIEW_CONFLICT', noteIds: ['n1'] },
          { status: 409 },
        ),
      );

    // When
    const result = await submitResponse(49321, 'repo/one', request, 'participant', fetchImpl);

    // Then
    expect(fetchImpl).toHaveBeenCalledWith(`${url}/submit-response`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-sift-review-participant': 'participant' },
      body: JSON.stringify(request),
    });
    expect(result).toMatchObject({ kind: 'http-error', code: 'REVIEW_CONFLICT', noteIds: ['n1'] });
  });
});
