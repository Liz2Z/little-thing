import { cors } from "hono/cors";
import { Hono } from "hono";
// must import before other modules
import { settings } from "./settings";

import { sessionRoutes, systemRoutes, providerRoutes } from "./routes";
import { errorHandler } from "./errors";

const rawSettings = settings.get();

if (!rawSettings?.server) {
  throw new Error("Server config not loaded");
}

const port = rawSettings.server.port;
const host = rawSettings.server.host;

const app = new Hono()
  .onError(errorHandler)
  .use(
    "/*",
    cors({
      origin: [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
      ],
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    }),
  )
  .route("/sessions", sessionRoutes)
  .route("/system", systemRoutes)
  .route("/provider", providerRoutes);

app.get("/openapi.json", async (c) => {
  const { generateSpecs } = await import("hono-openapi");
  const specs = await generateSpecs(app);
  return c.json({
    ...specs,
    openapi: "3.1.0",
    info: {
      title: "Little Thing API",
      version: "1.0.0",
      description:
        "API for Little Thing a agent application with session management and real-time events",
    },
    servers: [
      {
        url: `http://${host}:${port}`,
        description: "Development server",
      },
    ],
  });
});

console.log(`Server running on http://${host}:${port}`);
console.log(`OpenAPI spec available at http://${host}:${port}/openapi.json`);

if (import.meta.main) {
  Bun.serve({
    port: port,
    hostname: host,
    fetch: app.fetch,
  });
}

export { app };
