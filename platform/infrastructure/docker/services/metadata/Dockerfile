FROM golang:1.22-alpine AS builder
WORKDIR /src
RUN apk add --no-cache git ca-certificates
COPY go.work go.work.sum* ./
COPY packages/shared/go/ packages/shared/go/
COPY services/metadata/ services/metadata/
WORKDIR /src/services/metadata
RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /server ./cmd/server

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=builder /server /app/server
EXPOSE 8082
USER nobody
ENTRYPOINT ["/app/server"]
