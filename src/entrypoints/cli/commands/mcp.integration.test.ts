import { execSync } from 'node:child_process';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { beforeAll, describe, expect, it } from 'vitest';

const PROJECT_ROOT = process.cwd();
const CLI_BUNDLE = path.resolve(PROJECT_ROOT, 'dist/cli/index.js');
const EXIT_REPORT_MARKER = '__SIFT_MCP_CHILD_EXIT__';
const EXIT_REPORTER_SCRIPT = `
const { spawn } = require('node:child_process');
const [cliBundle, ...cliArgs] = process.argv.slice(1);
const child = spawn(process.execPath, [cliBundle, ...cliArgs], { stdio: 'inherit' });
child.once('error', (error) => {
  process.stderr.write('${EXIT_REPORT_MARKER}' + JSON.stringify({ error: error.message }) + '\\n');
  process.exitCode = 1;
});
child.once('exit', (code, signal) => {
  process.stderr.write('${EXIT_REPORT_MARKER}' + JSON.stringify({ code, signal }) + '\\n');
  process.exitCode = code ?? 1;
});
`;

// Deliberately nonexistent, to prove initialize/tools/list succeed without
// root resolution ever running (it is deferred to the first tool call, which
// this test never makes).
const NONEXISTENT_REPO_PATH = path.join(
  PROJECT_ROOT,
  `.sift-mcp-test-does-not-exist-${Date.now()}`,
);

describe('sift mcp (real stdio child process)', () => {
  beforeAll(() => {
    // Build and run the actual distributed bundle rather than running from
    // source via tsx: only the real esbuild bundle (external packages,
    // shebang) can reveal stdout contamination from the real distribution
    // path, and plain `node` avoids tsx's own IPC pipe, which can fail with
    // EPERM under a restricted sandbox.
    execSync('pnpm run build:server', { cwd: PROJECT_ROOT, stdio: 'inherit' });
  });

  it('initializes over real stdio, lists both Notes tools, and shuts down cleanly on its own', async () => {
    const client = new Client({ name: 'sift-mcp-stdio-test', version: '0.0.0' });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ['--eval', EXIT_REPORTER_SCRIPT, CLI_BUNDLE, 'mcp', '--repo', NONEXISTENT_REPO_PATH],
      env: Object.fromEntries(
        Object.entries(process.env).filter(
          (entry): entry is [string, string] => entry[1] !== undefined,
        ),
      ),
      stderr: 'pipe',
    });
    let stderrOutput = '';
    transport.stderr?.on('data', (chunk: Buffer | string) => {
      stderrOutput += chunk.toString();
    });
    let closed = false;

    try {
      await client.connect(transport);

      const { tools } = await client.listTools();

      expect(tools.map((tool) => tool.name).sort()).toEqual(['add_note', 'list_notes']);

      const listNotes = tools.find((tool) => tool.name === 'list_notes')!;
      expect(listNotes.outputSchema).toBeDefined();

      const addNote = tools.find((tool) => tool.name === 'add_note')!;
      expect(addNote.inputSchema).toBeDefined();
      expect(addNote.outputSchema).toBeDefined();

      // `close()` waits up to 2s for the child to exit on its own before
      // escalating to SIGTERM (then SIGKILL after another 2s), and resolves
      // "successfully" in every case. A fast resolution here is what
      // actually proves the child exited by itself in response to stdin
      // closing, rather than having needed a forceful kill.
      const closeStart = Date.now();
      await client.close();
      closed = true;
      expect(Date.now() - closeStart).toBeLessThan(1000);

      const exitReportLine = stderrOutput
        .split(/\r?\n/)
        .find((line) => line.startsWith(EXIT_REPORT_MARKER));
      expect(exitReportLine, `Child stderr:\n${stderrOutput}`).toBeDefined();
      const exitReport: unknown = JSON.parse(exitReportLine!.slice(EXIT_REPORT_MARKER.length));
      expect(exitReport).toEqual({ code: 0, signal: null });
    } finally {
      if (!closed) {
        await client.close().catch(() => {});
      }
    }
  });
});
