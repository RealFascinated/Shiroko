FROM oven/bun:1.3.14

WORKDIR /app

# Install production dependencies from the lockfile first for better layer caching.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Application source.
COPY . .

# Inject the token at runtime: docker run -e DISCORD_BOT_TOKEN=... arona-bot
CMD ["bun", "run", "src/index.ts"]
