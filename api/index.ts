import type { IncomingMessage, ServerResponse } from 'node:http';
import app, { ensureServerInitialized, formatTechnicalErrorMessage } from '../server.ts';
import { logPostgresError } from '../server/investorStore.ts';

export default async function handler(
  req: IncomingMessage & { url?: string },
  res: ServerResponse
) {
  if (typeof req.url === 'string') {
    const parsed = new URL(req.url, 'http://localhost');
    const targetPath = parsed.searchParams.get('__pathname');
    if (targetPath && targetPath.startsWith('/') && !targetPath.startsWith('//')) {
      parsed.searchParams.delete('__pathname');
      const remainingQuery = parsed.searchParams.toString();
      req.url = remainingQuery ? `${targetPath}?${remainingQuery}` : targetPath;
    }
  }

  try {
    await ensureServerInitialized();
  } catch (error) {
    logPostgresError('Vercel Init', error, process.env.DATABASE_URL);
    const formatted = formatTechnicalErrorMessage(error);
    if (!res.headersSent) {
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.end(JSON.stringify({
        success: false,
        degraded: true,
        code: formatted.code,
        error: formatted.message
      }));
    }
    return;
  }

  return app(req as Parameters<typeof app>[0], res as Parameters<typeof app>[1]);
}
