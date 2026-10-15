.PHONY: setup dev test backend-test frontend-test e2e build figures

setup:
	python -m venv .venv
	.venv/bin/python -m pip install -r backend/requirements-dev.txt
	cd frontend && npm ci

dev:
	bash scripts/dev.sh

backend-test:
	.venv/bin/python -m pytest -q --junitxml=docs/backend-tests.xml

frontend-test:
	cd frontend && npm test

e2e:
	cd frontend && npm run test:e2e

test: backend-test frontend-test e2e

build:
	cd frontend && npm run build

figures:
	.venv/bin/python scripts/export_results.py
