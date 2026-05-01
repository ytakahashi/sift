/**
 * Reads the `{ error: string }` body from a failed HTTP response.
 * Returns the fallback message when the body cannot be parsed or does not
 * have the expected shape.
 */
export async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as unknown;
    if (
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'string'
    ) {
      return body.error;
    }
  } catch (_error: unknown) {
    return fallback;
  }

  return fallback;
}
