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
    PRIVACY_POLICY_URL: type("string > 0"),
    TERMS_OF_SERVICE_URL: type("string > 0"),
    VM_PUSH_URL: type("string | undefined"),
    VM_PUSH_INTERVAL_MS: type("string | undefined"),
    /** Guild that private commands register into as guild commands. */
    PRIVATE_COMMANDS_GUILD_ID: type("string | undefined"),
    DISCORDBOTLIST_TOKEN: type("string | undefined"),
    TOPBOT_TOKEN: type("string | undefined"),
    S3_ACCESS_KEY: type("string > 0"),
    S3_SECRET_KEY: type("string > 0"),
    S3_REGION: type("string > 0"),
    S3_ENDPOINT: type("string > 0"),
    /** Public-read base URL that stored objects are served from. */
    S3_PUBLIC_URL: type("string > 0"),
  },
  runtimeEnv: process.env,
});
