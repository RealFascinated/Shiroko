import { createEnv } from "@t3-oss/env-core";
import { type } from "arktype";

/**
 * Type-safe environment variables for the server.
 *
 * This is a server-only Discord bot, so there is no client schema or prefix.
 * `runtimeEnv` reads `process.env`; Bun loads `.env` into it automatically.
 */
export const env = createEnv({
  server: {
    DISCORD_BOT_TOKEN: type("string > 0"),
  },
  runtimeEnv: process.env,
});
