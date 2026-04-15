import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";
import { getSessionService } from "../app/services.js";

const app = new Hono();
const sessionService = getSessionService();

app.get(
  "/stream",
  describeRoute({
    operationId: "events.stream",
    summary: "全局事件流订阅",
    description: "订阅所有 run 事件，可按 runId / sessionId 过滤",
    tags: ["Events"],
    responses: {
      200: {
        description: "SSE 事件流",
        content: {
          "text/event-stream": {
            schema: resolver(
              z.object({
                event: z.string(),
                data: z.string(),
              }),
            ),
          },
        },
      },
    },
  }),
  validator(
    "query",
    z.object({
      runId: z.string().optional(),
      sessionId: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("query");

    return streamSSE(c, async (stream) => {
      if (query.runId) {
        for await (const envelope of sessionService.subscribeRunEvents(
          query.runId,
          {
            signal: c.req.raw.signal,
            replay: true,
          },
        )) {
          if (query.sessionId && envelope.session_id !== query.sessionId) {
            continue;
          }

          await stream.writeSSE({
            event: envelope.event.type,
            data: JSON.stringify({
              run_id: envelope.run_id,
              session_id: envelope.session_id,
              event: envelope.event,
            }),
          });

          if (
            envelope.event.type === "agent_complete" ||
            envelope.event.type === "agent_error" ||
            envelope.event.type === "agent_abort"
          ) {
            return;
          }
        }
        return;
      }

      for await (const envelope of sessionService.subscribeAllRunEvents({
        signal: c.req.raw.signal,
      })) {
        if (query.sessionId && envelope.session_id !== query.sessionId) {
          continue;
        }

        await stream.writeSSE({
          event: envelope.event.type,
          data: JSON.stringify({
            run_id: envelope.run_id,
            session_id: envelope.session_id,
            event: envelope.event,
          }),
        });
      }
    });
  },
);

export const eventRoutes = app;
