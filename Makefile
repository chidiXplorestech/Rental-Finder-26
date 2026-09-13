.PHONY: up down seed test
up:
	docker compose up --build

down:
	docker compose down

seed:
	docker compose exec api python -m app.seed

test:
	docker compose exec api pytest -q
