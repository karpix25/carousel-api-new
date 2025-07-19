# Carousel API Makefile

.PHONY: help install dev build start test lint clean docker-build docker-run docker-stop example

# Colors for output
YELLOW := \033[33m
GREEN := \033[32m
BLUE := \033[34m
RED := \033[31m
NC := \033[0m # No Color

help: ## Show this help message
	@echo "$(BLUE)Carousel API - Available Commands$(NC)\n"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "$(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'

install: ## Install dependencies
	@echo "$(BLUE)Installing dependencies...$(NC)"
	npm install

dev: ## Start development server
	@echo "$(BLUE)Starting development server...$(NC)"
	npm run dev

build: ## Build for production
	@echo "$(BLUE)Building for production...$(NC)"
	npm run build

start: ## Start production server
	@echo "$(BLUE)Starting production server...$(NC)"
	npm start

test: ## Run tests
	@echo "$(BLUE)Running tests...$(NC)"
	npm test

lint: ## Run linter
	@echo "$(BLUE)Running linter...$(NC)"
	npm run lint

clean: ## Clean build artifacts
	@echo "$(BLUE)Cleaning build artifacts...$(NC)"
	rm -rf dist/
	rm -rf node_modules/
	rm -rf logs/
	rm -rf examples/output/

docker-build: ## Build Docker image
	@echo "$(BLUE)Building Docker image...$(NC)"
	docker build -t carousel-api:latest .

docker-run: ## Run Docker container
	@echo "$(BLUE)Running Docker container...$(NC)"
	docker run -d \
		--name carousel-api \
		-p 3000:3000 \
		-e NODE_ENV=production \
		carousel-api:latest

docker-stop: ## Stop Docker container
	@echo "$(BLUE)Stopping Docker container...$(NC)"
	docker stop carousel-api || true
	docker rm carousel-api || true

docker-compose-up: ## Start with docker-compose
	@echo "$(BLUE)Starting with docker-compose...$(NC)"
	docker-compose up -d

docker-compose-down: ## Stop docker-compose
	@echo "$(BLUE)Stopping docker-compose...$(NC)"
	docker-compose down

docker-logs: ## Show Docker logs
	@echo "$(BLUE)Showing Docker logs...$(NC)"
	docker logs -f carousel-api

example: ## Run API usage example
	@echo "$(BLUE)Running API usage example...$(NC)"
	@echo "$(YELLOW)Make sure the API server is running first!$(NC)"
	node examples/api-usage-example.js

setup-env: ## Setup environment file
	@echo "$(BLUE)Setting up environment file...$(NC)"
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "$(GREEN).env file created from .env.example$(NC)"; \
	else \
		echo "$(YELLOW).env file already exists$(NC)"; \
	fi

health-check: ## Check API health
	@echo "$(BLUE)Checking API health...$(NC)"
	@curl -s http://localhost:3000/health | python3 -m json.tool || echo "$(RED)API not responding$(NC)"

quick-start: setup-env install build docker-build ## Quick start setup
	@echo "$(GREEN)Quick start completed!$(NC)"
	@echo "$(YELLOW)Run 'make docker-run' to start the API$(NC)"

full-example: docker-compose-up ## Full example with docker-compose
	@echo "$(BLUE)Starting full example...$(NC)"
	@echo "$(YELLOW)Waiting for API to start...$(NC)"
	@sleep 10
	@make example

production-deploy: clean install build docker-build ## Prepare for production deployment
	@echo "$(GREEN)Production build completed!$(NC)"
	@echo "$(YELLOW)Image: carousel-api:latest$(NC)"

dev-setup: setup-env install ## Setup development environment
	@echo "$(GREEN)Development environment ready!$(NC)"
	@echo "$(YELLOW)Run 'make dev' to start development server$(NC)"

status: ## Show project status
	@echo "$(BLUE)Project Status:$(NC)"
	@echo "Node.js version: $(shell node --version)"
	@echo "npm version: $(shell npm --version)"
	@echo "Docker version: $(shell docker --version 2>/dev/null || echo 'Not installed')"
	@echo "API running: $(shell curl -s http://localhost:3000/health >/dev/null && echo '$(GREEN)Yes$(NC)' || echo '$(RED)No$(NC)')"

benchmark: ## Run simple benchmark
	@echo "$(BLUE)Running simple benchmark...$(NC)"
	@echo "$(YELLOW)Make sure API is running first!$(NC)"
	@time curl -s -X POST http://localhost:3000/api/preview-slides \
		-H "Content-Type: application/json" \
		-d '{"text":"# Test\n\nBenchmark content","settings":{"maxSlides":3}}' \
		> /dev/null

logs: ## Show application logs
	@echo "$(BLUE)Showing application logs...$(NC)"
	@if [ -f logs/combined.log ]; then \
		tail -f logs/combined.log; \
	else \
		echo "$(YELLOW)No log file found. Logs may be in Docker container.$(NC)"; \
		echo "$(YELLOW)Try: make docker-logs$(NC)"; \
	fi