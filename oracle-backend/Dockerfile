# filepath: oracle-backend/Dockerfile
# STAGE 1: Builder
# We use the official Go image to compile the code
FROM golang:1.25-alpine AS builder

# Install build tools (needed for CGO/SQLite if we use mattn/go-sqlite3)
RUN apk add --no-cache gcc musl-dev

WORKDIR /app

# Copy dependency files first (better caching)
COPY go.mod go.sum ./
RUN go mod download

# Copy the rest of the source code
COPY . .

# Build the application
# CGO_ENABLED=1 is required for go-sqlite3
# -ldflags="-w -s" strips debug info to make binary smaller
RUN CGO_ENABLED=1 GOOS=linux go build -ldflags="-w -s" -o server ./cmd/app

# STAGE 2: Runner
# We use a tiny Alpine Linux image for the final container
FROM alpine:3.19

# Install certificates (for making HTTPS requests) and sqlite libs
RUN apk add --no-cache ca-certificates sqlite-libs

WORKDIR /root/

# Copy the binary from the builder stage
COPY --from=builder /app/server .

# Copy the static UI files
COPY --from=builder /app/static ./static

# Create the data directory
RUN mkdir -p ./data

# Expose the port
EXPOSE 8080

# Set default env vars
ENV PORT=8080
ENV DB_PATH=./data/cqd-analytics.db

# Command to run
CMD ["./server"]