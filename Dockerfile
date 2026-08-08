# Build stage
FROM denoland/deno:latest AS builder
# Point Deno's cache at a known location so it can be copied to the next stage
ENV DENO_DIR=/deno-dir
WORKDIR /app

# Copy manifests first so the dependency install layer caches across
# source-only edits
COPY deno.jsonc deno.lock ./
RUN deno ci --prod --skip-types

# Then copy the rest of the source
COPY src/ ./src/
COPY public/ ./public/

# Production stage
FROM denoland/deno:distroless-2.9.5
ENV DENO_DIR=/deno-dir
WORKDIR /app

# Copy the populated Deno cache so the runtime stage has the dependencies
COPY --from=builder /deno-dir /deno-dir

COPY --from=builder /app .

CMD ["run", "--allow-net", "--allow-read", "--allow-write", "--allow-env", "--allow-ffi", "--unstable-worker-options", "src/main.ts"]
