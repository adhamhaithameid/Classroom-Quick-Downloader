# oracle-backend/Dockerfile
# Multi-stage build for minimal production image

FROM golang:1.27.0-alpine3.24@sha256:4c9fe60190a2a3350ddc51de80d0224b8a6698d12bdfc999fee45ea9d6c46dbc AS builder

WORKDIR /app

# CGO_ENABLED=0 means we don't need gcc/musl-dev for compilation

# Cache dependencies
COPY go.mod go.sum ./
RUN go mod download

# Build the application.
# Build inside the container's native architecture so the resulting binaries
# always match the runtime platform (important for arm64 Oracle VM deploys).
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o oracle-backend ./cmd/app
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o archiver ./cmd/archiver

# -------------------------------------------
# Production image
FROM alpine:3.24.1@sha256:28bd5fe8b56d1bd048e5babf5b10710ebe0bae67db86916198a6eec434943f8b

# Install runtime dependencies
RUN apk add --no-cache ca-certificates tzdata

# Create non-root user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

WORKDIR /app

# Copy binary and static files
COPY --from=builder /app/oracle-backend .
COPY --from=builder /app/archiver .
COPY --from=builder /app/static ./static

# Create data directory for SQLite
RUN mkdir -p /data && chown -R appuser:appgroup /data

# Switch to non-root user
USER appuser

# Environment variables
ENV ADDR=:8080
ENV DB_PATH=/data/analytics.db
ENV STATIC_DIR=/app/static

# Persistent data volume for SQLite
VOLUME ["/data"]

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

EXPOSE 8080

CMD ["./oracle-backend"]
