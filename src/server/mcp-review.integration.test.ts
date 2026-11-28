import { once } from 'node:events';
import { createAdaptorServer } from '@hono/node-server';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { SIFT_HEALTH_CAPABILITIES, SIFT_HEALTH_PRODUCT } from './contract/health-contract';
import { InMemoryNotesStore } from './infrastructure/notes/in-memory-notes-store';
import { createNotesRoutes } from './routes/notes';

const repository = { id: 'repo', name: 'repo', path: '/repo' };

// Supply a repository without touching the user's Git checkout or configuration, while
// exercising the real MCP stdio lifecycle and a real loopback HTTP connection.
const mcpScript = `
  import { startMcpServer } from './src/mcp/start-mcp-server.ts';
  const repository = ${JSON.stringify(repository)};
  startMcpServer({
    repoPath: repository.path,
    resolveRepoRoot: () => repository.path,
    findRegisteredRepositoryByPath: async () => repository,
  });
`;

function createAgent(
  role: string,
  port: number,
): { client: Client; transport: StdioClientTransport } {
  const client = new Client({ name: role, version: '1' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--import', 'tsx', '--input-type=module', '--eval', mcpScript],
    env: { PORT: String(port) },
    stderr: 'inherit',
  });
  return { client, transport };
}

describe('MCP review presence over HTTP and stdio', () => {
  it.each(['stdin EOF', 'SIGKILL'] as const)(
    'wakes the reviewer with peer-gone after %s',
    async (exit) => {
      // Given
      const store = new InMemoryNotesStore();
      let markPollStarted!: () => void;
      const pollStarted = new Promise<void>((resolve) => {
        markPollStarted = resolve;
      });
      const waitForReview = store.waitForReview.bind(store);
      vi.spyOn(store, 'waitForReview').mockImplementation((repoId, options, signal) => {
        const result = waitForReview(repoId, options, signal);
        if (options.role === 'reviewer') {
          markPollStarted();
        }
        return result;
      });
      const app = new Hono();
      app.get('/api/health', (c) =>
        c.json({
          product: SIFT_HEALTH_PRODUCT,
          version: '1',
          capabilities: SIFT_HEALTH_CAPABILITIES,
        }),
      );
      app.route(
        '/api',
        createNotesRoutes({
          repositoryResolver: {
            async listRepositories() {
              return { repositories: [repository], invalidRepositories: [] };
            },
            async resolveRepository() {
              return repository;
            },
          },
          notesStore: store,
          createDiffProvider() {
            throw new Error('This review does not require Git data.');
          },
          createFileGenerationProvider() {
            throw new Error('This review does not require file data.');
          },
          createRepositoryIndexProvider() {
            throw new Error('This review does not require index data.');
          },
          notifyNotesChanged: vi.fn(),
        }),
      );
      const http = createAdaptorServer({ fetch: app.fetch });
      const listening = once(http, 'listening');
      http.listen(0, '127.0.0.1');
      await listening;
      const address = http.address();
      if (!address || typeof address === 'string') {
        throw new Error('Expected a loopback TCP port.');
      }
      const reviewer = createAgent('reviewer', address.port);
      const implementer = createAgent('implementer', address.port);
      try {
        await Promise.all([
          reviewer.client.connect(reviewer.transport),
          implementer.client.connect(implementer.transport),
        ]);
        const submission = await reviewer.client.callTool({
          name: 'submit_review',
          arguments: { verdict: 'comment', comments: [], threads: [] },
        });
        expect(submission).toMatchObject({ structuredContent: { state: 'awaiting-response' } });

        const turn = await implementer.client.callTool({
          name: 'wait_for_turn',
          arguments: { role: 'implementer' },
        });
        expect(turn).toMatchObject({ structuredContent: { status: 'your-turn' } });
        const waiting = reviewer.client.callTool({
          name: 'wait_for_turn',
          arguments: { role: 'reviewer' },
        });
        await Promise.race([
          pollStarted,
          waiting.then((result) => {
            throw new Error(`Review poll returned before waiting: ${JSON.stringify(result)}`);
          }),
        ]);

        // When
        if (exit === 'SIGKILL') {
          process.kill(implementer.transport.pid!, 'SIGKILL');
        } else {
          const start = performance.now();
          await implementer.client.close();
          // The SDK escalates to SIGTERM after two seconds if stdin EOF did not exit.
          expect(performance.now() - start).toBeLessThan(1_500);
        }

        // Then
        await expect(waiting).resolves.toMatchObject({
          structuredContent: { status: 'peer-gone' },
        });
        await expect(store.getReview(repository.id)).resolves.toMatchObject({ state: 'peer-gone' });
      } finally {
        await Promise.allSettled([reviewer.client.close(), implementer.client.close()]);
        http.close();
        if ('closeAllConnections' in http) {
          http.closeAllConnections();
        }
      }
    },
  );
});
