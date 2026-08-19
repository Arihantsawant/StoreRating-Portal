FROM node:24-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build
ENV NODE_ENV=production
EXPOSE 8080
CMD ["sh", "-c", "node server/src/migrate.js && node server/src/index.js"]
