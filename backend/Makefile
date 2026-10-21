.PHONY: build run migrate-up migrate-down docker-build docker-run
build:
	@go build -o bin/api/main ./cmd/api
run: build
	@./bin/api/main
migrate-up:
	@go run ./cmd/migrate up
migrate-down:
	@go run ./cmd/migrate down
docker-build:
	docker build -t eghissab-backend .
docker-run:
	docker run --rm -it -p 8080:8080 --env-file .env eghissab-backend
