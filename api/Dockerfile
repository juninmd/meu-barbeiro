# Build a partir da raiz do workspace (usa o pnpm-lock.yaml do monorepo).
FROM node:24-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api/package.json ./api/
# o schema precisa existir antes do install: o postinstall roda prisma generate
COPY api/prisma ./api/prisma
RUN pnpm install --filter api --frozen-lockfile
COPY api/tsconfig.json ./api/
COPY api/src ./api/src
WORKDIR /app/api
RUN pnpm build
EXPOSE 3333
# Aplica as migrations pendentes antes de subir, para o deploy não depender de passo manual.
# O compose local sobrescreve este comando (seed + tsx watch).
CMD ["sh", "-c", "pnpm prisma migrate deploy && node dist/server.js"]
