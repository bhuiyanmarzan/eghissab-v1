# Load environment variables (.env in backend/ or ../.env in root)
-include .env
export

# PostgreSQL defaults if not specified in .env
POSTGRES_USER ?= eghissab
POSTGRES_PASSWORD ?= change-me-strong-password
POSTGRES_DB ?= eghissab_v1_dev
POSTGRES_PORT ?= 5432

POSTGRES_APP_USER ?= eghissab_app
POSTGRES_APP_PASSWORD ?= change-me-app-password

# Migration runner connects with privileged user
MIGRATION_DATABASE_URL ?= postgres://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@localhost:$(POSTGRES_PORT)/$(POSTGRES_DB)?sslmode=disable
export MIGRATION_DATABASE_URL

# Application server defaults to restricted app user (or falls back to migration credentials if not set)
DATABASE_URL ?= postgres://$(POSTGRES_APP_USER):$(POSTGRES_APP_PASSWORD)@localhost:$(POSTGRES_PORT)/$(POSTGRES_DB)?sslmode=disable
export DATABASE_URL

.PHONY: build run dev install-air db db-stop db-logs migrate-up migrate-down docker-build docker-run

# ---------- database management ----------
db:
	@echo "Checking/Starting PostgreSQL database container..."
	@docker compose -f ../docker-compose.yml up -d postgres
	@echo "Waiting for PostgreSQL to be ready..."
	@until docker compose -f ../docker-compose.yml exec -T postgres pg_isready -U $(POSTGRES_USER) -d $(POSTGRES_DB) > /dev/null 2>&1; do \
		echo "Database is warming up, waiting..."; \
		sleep 1; \
	done
	@echo "✅ PostgreSQL is ready and accepting connections."

db-stop:
	@echo "Stopping PostgreSQL database container..."
	@docker compose -f ../docker-compose.yml stop postgres

db-logs:
	@docker compose -f ../docker-compose.yml logs -f postgres

# ---------- development with auto-restart ----------
install-air:
	@which air > /dev/null 2>&1 || (echo "Installing Air..." && go install github.com/air-verse/air@latest)

dev: db install-air
	@echo "Starting backend with Air (DATABASE_URL configured)..."
	@air

# ---------- standard build & run ----------
build:
	@go build -o bin/api/main ./cmd/api

run: db build
	@./bin/api/main

migrate-up: db
	@go run ./cmd/migrate up

migrate-down: db
	@go run ./cmd/migrate down

migrate-down-all: db
	@go run ./cmd/migrate down-all

docker-build:
	docker build -t eghissab-backend .

docker-run:
	docker run --rm -it -p 8080:8080 --env-file .env eghissab-backend
