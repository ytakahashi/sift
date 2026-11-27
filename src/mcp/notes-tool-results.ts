import type { CallToolResult } from '@modelcontextprotocol/server';
import type { HttpJsonResult } from './http-json-client';
import { describeKnownError } from './notes-tool-guidance';

export function errorResult(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

export function successResult(
  structuredContent: Record<string, unknown>,
  guidance?: string,
): CallToolResult {
  return {
    content: [
      { type: 'text', text: JSON.stringify(structuredContent) },
      ...(guidance === undefined ? [] : [{ type: 'text' as const, text: guidance }]),
    ],
    structuredContent,
  };
}

export function httpErrorResult(
  error: Extract<HttpJsonResult<object>, { kind: 'http-error' }>,
): CallToolResult {
  const guidance = describeKnownError(error.code, error.message, error.status);
  const ids = error.noteIds?.length ? ` Note IDs: ${error.noteIds.join(', ')}.` : '';
  return errorResult(guidance + ids);
}
