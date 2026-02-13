SHELL := /bin/bash

.PHONY: test test-app test-handlers test-db vet scan

test:
	go test ./... -count=1

test-app:
	go test ./cmd/app -count=1

test-handlers:
	go test ./internal/handlers -count=1

test-db:
	go test ./internal/db -count=1

vet:
	go vet ./...

scan:
	./scripts/full-scan.sh
