import { createSessionService } from "../session/index.js";

let sessionServiceInstance: ReturnType<typeof createSessionService> | null =
  null;

export function getSessionService() {
  if (!sessionServiceInstance) {
    sessionServiceInstance = createSessionService(process.cwd());
  }

  return sessionServiceInstance;
}
