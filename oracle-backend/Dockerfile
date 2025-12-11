# oracle-backend/Dockerfile
FROM golang:1.22-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o oracle-backend ./cmd/app

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
WORKDIR /app

COPY --from=builder /app/oracle-backend .
COPY static ./static

# Persistent data volume for SQLite
VOLUME ["/data"]
ENV DB_PATH=/data/analytics.db
ENV DO_SHARED_SECRET=change-me
ENV STATIC_DIR=/app/static

EXPOSE 8080
CMD ["./oracle-backend"]