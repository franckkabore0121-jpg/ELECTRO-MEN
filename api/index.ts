import type { IncomingMessage, ServerResponse } from 'node:http';
import app, { ensureServerInitialized } from '../server.ts';

export default async function handler(
  req: IncomingMessage & { url?: string },
  res: ServerResponse
) {
  await ensureServerInitialized();
  if (typeof req.url === 'string') {
    const parsed = new URL(req.url, 'http://localhost');
    const targetPath = parsed.searchParams.get('__pathname');
    if (targetPath && targetPath.startsWith('/') && !targetPath.startsWith('//')) {
      parsed.searchParams.delete('__pathname');
      const remainingQuery = parsed.searchParams.toString();
      req.url = remainingQuery ? `${targetPath}?${remainingQuery}` : targetPath;
    }
  }
  return app(req as Parameters<typeof app>[0], res as Parameters<typeof app>[1]);
}
