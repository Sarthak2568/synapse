.PHONY: run install docker

install:
	python3 -m venv .venv && . .venv/bin/activate && pip install -r backend/requirements.txt

run:
	uvicorn app.main:app --app-dir backend --reload

docker:
	docker compose up --build
