FROM node:22-alpine

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY server.mjs ./
COPY public ./public
RUN mkdir -p data

ENV PORT=3000
EXPOSE 3000

CMD ["pnpm", "start"]