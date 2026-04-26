import type { CurrentUser, SessionRecord } from "../lib/types";
import type { DatabaseClient } from "../db/client";

export type AppEnv = {
  Bindings: Env;
  Variables: {
    backgroundTasks: Promise<unknown>[];
    currentUser: CurrentUser;
    db: DatabaseClient;
    session: SessionRecord;
  };
};
