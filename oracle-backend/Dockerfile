# oracle-backend/Dockerfile
# Multi-stage build for minimal production image

FROM golang:1.24-alpine AS builder

WORKDIR /app

# CGO_ENABLED=0 means we don't need gcc/musl-dev for compilation
# RUN apk add --no-cache gcc musl-dev

# Cache dependencies
COPY go.mod go.sum ./
RUN go mod download

# Build the application
COPY . .
# Use TARGETARCH from Docker buildx (defaults to amd64 if not set, but we want flexibility)
ARG TARGETARCH=arm64
RUN CGO_ENABLED=0 GOOS=linux GOARCH=${TARGETARCH} go build -ldflags="-s -w" -o oracle-backend ./cmd/app

# -------------------------------------------
# Production image
FROM alpine:3.20

# Install runtime dependencies
RUN apk add --no-cache ca-certificates tzdata

# Create non-root user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

WORKDIR /app

# Copy binary and static files
COPY --from=builder /app/oracle-backend .
COPY --from=builder /app/static ./static

# Create data directory for SQLite
RUN mkdir -p /data && chown -R appuser:appgroup /data

# Switch to non-root user
USER appuser

# Environment variables
ENV ADDR=:8080
ENV DB_PATH=/data/analytics.db
ENV STATIC_DIR=/app/static
ENV DO_SHARED_SECRET=change-me-in-production

# Persistent data volume for SQLite
VOLUME ["/data"]

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

EXPOSE 8080

CMD ["./oracle-backend"]