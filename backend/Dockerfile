# Multi-stage Docker build for ultra-lightweight Go backend (~25MB)
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Install build dependencies for CGO SQLite
RUN apk add --no-cache gcc musl-dev

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=1 GOOS=linux go build -ldflags="-s -w" -o study-tracker-server main.go

# Production Runner Stage
FROM alpine:3.19

WORKDIR /app
RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /app/study-tracker-server .

EXPOSE 8080
ENV PORT=8080
ENV DB_PATH=/app/data/study_tracker.db

# Ensure data directory exists
RUN mkdir -p /app/data

CMD ["./study-tracker-server"]
