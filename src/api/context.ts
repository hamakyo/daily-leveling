import type { CurrentUser, SessionRecord } from "../lib/types";

export type AppEnv = {
  Bindings: Env;
  Variables: {
    currentUser: CurrentUser;
    session: SessionRecord;
  };
};
