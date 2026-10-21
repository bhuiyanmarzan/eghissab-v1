# Load .env for shell commands that need variables (e.g. make migrate:up)
include .env
export

.PHONY: deploy up down logs ps migrate-up migrate-down rebuild

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