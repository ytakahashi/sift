export function splitTextFileLines(content: string): string[] {
  if (content === '') {
    return [];
  }

  const lines = content.split('\n');
  if (content.endsWith('\n')) {
    // A trailing newline terminates the final line; it does not add another blank line.
    lines.pop();
  }

  return lines;
}
