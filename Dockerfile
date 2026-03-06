# Stage 1: Build
FROM node:24-alpine AS builder

WORKDIR /build

COPY package.json pnpm-lock.yaml ./

RUN npm install -g pnpm && \
    pnpm install --frozen-lockfile

COPY src/ src/
COPY tsconfig.json ./

RUN pnpm build

# Stage 2: Runtime
FROM node:24-alpine

WORKDIR /app

# Install AWS CLI
RUN apk add --no-cache \
    aws-cli \
    curl \
    bash

# Copy only what's needed for runtime
COPY package.json pnpm-lock.yaml ./

RUN npm install -g pnpm && \
    pnpm install --frozen-lockfile --prod

COPY --from=builder /build/dist ./dist

# Set AWS credentials directory
ENV HOME=/root
VOLUME /root/.aws

ENTRYPOINT ["node", "/app/dist/index.js"]
