# Build a partir da raiz do workspace (usa o pnpm-lock.yaml do monorepo).
FROM node:24-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api/package.json ./api/
RUN pnpm install --filter api --frozen-lockfile
COPY api/prisma ./api/prisma
RUN pnpm --filter api exec prisma generate
COPY api/tsconfig.json ./api/
COPY api/src ./api/src
WORKDIR /app/api
EXPOSE 3333
CMD ["pnpm", "dev"]
