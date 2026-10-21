# Load .env for shell commands that need variables (e.g. make migrate:up)
include .env
export

.PHONY: deploy up down logs ps migrate-up migrate-down rebuild dev dev-docker dev-db dev-backend down-dev

# ---------- development ----------
dev: dev-docker

dev-docker:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

down-dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml down

dev-db:
	docker compose up -d postgres

dev-backend:
	@$(MAKE) -C backend dev

# ---------- core ----------
deploy: up migrate-up
	@echo "✅ Deployed. App on http://<EC2-IP>/"

up:
	docker compose up -d --build

down:
	docker compose down

rebuild:
	docker compose up -d --build --force-recreate

# ---------- observability ----------
logs:
	docker compose logs -f --tail=100

ps:
	docker compose ps

# ---------- migrations ----------
migrate-up:
	docker compose --profile tools run --rm migrate-up

migrate-down:
	docker compose --profile tools run --rm migrate-down