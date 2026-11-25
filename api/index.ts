import type { IncomingMessage, ServerResponse } from 'node:http';
import app, { ensureServerInitialized, formatTechnicalErrorMessage } from '../server.ts';

export default async function handler(
  req: IncomingMessage & { url?: string },
  res: ServerResponse
) {
  try {
    await ensureServerInitialized();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const causeMessage = error instanceof Error && error.cause instanceof Error ? error.cause.message : undefined;
    console.error('[ELECTRO-MEN Vercel Init Error]', causeMessage ? `${message} (${causeMessage})` : message);
    const formatted = formatTechnicalErrorMessage(error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({
        success: false,
        code: formatted.code,
        error: formatted.message
      }));
    }
    return;
  }

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
