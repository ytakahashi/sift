import { describe, expect, it } from 'vitest';
import type { ErrorResponseCode } from '../server/routes/route-error';
import { ERROR_RESPONSE_CODES } from '../server/routes/route-error';
import {
  describeCapabilityMissing,
  describeIncompatibleProduct,
  describeInvalidResponse,
  describeKnownError,
  describePortResolutionFailure,
  describeRepoRootResolutionFailure,
  describeRepositoryLookupFailure,
  describeUnreachable,
  describeUnregisteredRepository,
} from './notes-tool-guidance';

describe('describeUnreachable', () => {
  it('mentions how to start the server', () => {
    // Given / When
    const message = describeUnreachable();

    // Then
    expect(message).toContain('sift open');
    expect(message).toContain('sift serve');
  });
});

describe('describeIncompatibleProduct', () => {
  it('mentions the port is owned by something else', () => {
    // Given / When
    const message = describeIncompatibleProduct();

    // Then
    expect(message).toContain('PORT');
  });
});

describe('describeCapabilityMissing', () => {
  it('mentions updating Sift', () => {
    // Given / When
    const message = describeCapabilityMissing();

    // Then
    expect(message).toContain('Update Sift');
  });
});

describe('describeRepoRootResolutionFailure', () => {
  it('includes the candidate path and the underlying Error message', () => {
    // Given
    const error = new Error('not a git repository');

    // When
    const message = describeRepoRootResolutionFailure('/some/path', error);

    // Then
    expect(message).toContain('/some/path');
    expect(message).toContain('not a git repository');
    expect(message).toContain('--repo');
  });

  it('stringifies a non-Error thrown value', () => {
    // Given
    const error = 'plain string failure';

    // When
    const message = describeRepoRootResolutionFailure('/some/path', error);

    // Then
    expect(message).toContain('plain string failure');
  });
});

describe('describeUnregisteredRepository', () => {
  it('includes the resolved root and the sift add command', () => {
    // Given / When
    const message = describeUnregisteredRepository('/repo/sift');

    // Then
    expect(message).toContain('/repo/sift');
    expect(message).toContain('sift add /repo/sift');
  });
});

describe('describeRepositoryLookupFailure', () => {
  it('includes the configuration error and retry guidance', () => {
    // Given / When
    const message = describeRepositoryLookupFailure(new Error('invalid JSON'));

    // Then
    expect(message).toContain('invalid JSON');
    expect(message).toContain('configuration');
    expect(message).toContain('retry');
  });
});

describe('describePortResolutionFailure', () => {
  it('includes the invalid PORT error', () => {
    // Given / When
    const message = describePortResolutionFailure(new Error('Invalid PORT environment variable'));

    // Then
    expect(message).toContain('Invalid PORT environment variable');
    expect(message).toContain('port');
  });
});

describe('describeInvalidResponse', () => {
  it('mentions updating or restarting the server', () => {
    // Given / When
    const message = describeInvalidResponse();

    // Then
    expect(message).toMatch(/update|restart/i);
  });
});

describe('describeKnownError', () => {
  it.each(ERROR_RESPONSE_CODES)('produces dedicated guidance for known code %s', (code) => {
    // Given
    const message = 'server message';

    // When
    const guidance = describeKnownError(code, message, 422);

    // Then
    expect(guidance).toContain(message);
  });

  it('mentions bucket for NOTE_TARGET_AMBIGUOUS', () => {
    // Given / When
    const guidance = describeKnownError(
      'NOTE_TARGET_AMBIGUOUS' satisfies ErrorResponseCode,
      'x',
      422,
    );

    // Then
    expect(guidance).toContain('bucket');
  });

  it('mentions kind: "file" for NOTE_TARGET_NOT_FOUND', () => {
    // Given / When
    const guidance = describeKnownError(
      'NOTE_TARGET_NOT_FOUND' satisfies ErrorResponseCode,
      'x',
      422,
    );

    // Then
    expect(guidance).toContain('kind: "file"');
  });

  it('mentions server logs for a code-less 500', () => {
    // Given / When
    const guidance = describeKnownError(undefined, 'invariant violated', 500);

    // Then
    expect(guidance).toContain('invariant violated');
    expect(guidance).toContain('logs');
  });

  it('mentions sift add and the status for a code-less non-500 error', () => {
    // Given / When
    const guidance = describeKnownError(undefined, 'bad config', 400);

    // Then
    expect(guidance).toContain('bad config');
    expect(guidance).toContain('400');
    expect(guidance).toContain('sift add');
  });

  it('falls back to the generic non-500 message for a code this client does not recognize (forward compatibility)', () => {
    // Given / When
    const guidance = describeKnownError('SOME_FUTURE_CODE', 'new failure kind', 409);

    // Then
    expect(guidance).toContain('new failure kind');
    expect(guidance).toContain('409');
    expect(guidance).toContain('sift add');
  });
});
