.PHONY: up up-full down clean reset-db logs ps help

up: ## Start core infrastructure (Postgres + Redis)
	docker compose -f docker/docker-compose.yml --profile core up -d

up-full: ## Start full infrastructure (all services)
	docker compose -f docker/docker-compose.yml --profile full up -d

down: ## Stop all infrastructure
	docker compose -f docker/docker-compose.yml down

clean: ## Stop all + remove volumes (clean slate)
	docker compose -f docker/docker-compose.yml down -v --remove-orphans

reset-db: ## Wipe databases and re-run migrations
	docker compose -f docker/docker-compose.yml down -v --remove-orphans
	docker compose -f docker/docker-compose.yml --profile core up -d
	sleep 3
	pnpm --filter @sentinel/db run migrate

logs: ## Tail infrastructure logs
	docker compose -f docker/docker-compose.yml logs -f

ps: ## Show running infrastructure containers
	docker compose -f docker/docker-compose.yml ps

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'
