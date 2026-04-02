import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

/**
 * GET /api/logs/stream — Server-Sent Events for real-time logs (Feature #5)
 */
export async function GET() {
  const session = await getSession();
  if (!session?.accountId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const accountId = session.accountId;

  const encoder = new TextEncoder();
  let lastChecked = new Date();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      // Send initial heartbeat
      controller.enqueue(encoder.encode('event: connected\ndata: {"status":"connected"}\n\n'));

      const interval = setInterval(async () => {
        if (closed) return;
        try {
          // Poll for new logs since last check
          const newLogs = await prisma.dmLog.findMany({
            where: {
              accountId,
              createdAt: { gt: lastChecked },
            },
            orderBy: { createdAt: 'asc' },
            include: {
              trigger: { select: { keyword: true } },
            },
            take: 50,
          });

          if (newLogs.length > 0) {
            lastChecked = newLogs[newLogs.length - 1].createdAt;
            for (const log of newLogs) {
              const data = JSON.stringify(log);
              if (!closed) controller.enqueue(encoder.encode(`event: new-log\ndata: ${data}\n\n`));
            }
          }

          // Send heartbeat every interval
          if (!closed) controller.enqueue(encoder.encode(`event: heartbeat\ndata: ${JSON.stringify({ time: new Date().toISOString() })}\n\n`));
        } catch (error) {
          if (!closed) console.error('[sse] Error polling logs:', error);
        }
      }, 3000); // Poll every 3 seconds

      // Cleanup on close
      const cleanup = () => {
        closed = true;
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      };

      // Auto-close after 5 minutes to prevent memory leaks
      setTimeout(cleanup, 5 * 60 * 1000);
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
