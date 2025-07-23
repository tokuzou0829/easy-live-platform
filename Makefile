.PHONY: help setup build up down restart logs clean env-check

# Default domain
DOMAIN ?= localhost
PROTOCOL ?= http

# Default target
help:
	@echo "Easy Live Platform - Docker Commands"
	@echo ""
	@echo "Available commands:"
	@echo "  make setup DOMAIN=<domain>  - 完全なセットアップを実行 (推奨)"
	@echo "  make build                  - Build all Docker images"
	@echo "  make up                     - Start all services"
	@echo "  make down                   - Stop all services"
	@echo "  make restart                - Restart all services"
	@echo "  make logs                   - Show logs for all services"
	@echo "  make clean                  - Clean up Docker images and volumes"
	@echo "  make env-check              - Check environment variables"
	@echo ""
	@echo "Examples:"
	@echo "  make setup                         # Setup with localhost"
	@echo "  make setup DOMAIN=example.com     # Setup with example.com"
	@echo ""
	@echo "GitHub OAuth設定:"
	@echo "  ./setup.sh --github-id <client_id> --github-secret <client_secret> <domain>"
	@echo ""

# Complete setup (recommended)
setup:
	@echo "🚀 Setting up Easy Live Platform with domain: $(DOMAIN)"
	./setup.sh $(DOMAIN)

# Setup with SSL
setup-ssl:
	@echo "🔒 Setting up Easy Live Platform with SSL for domain: $(DOMAIN)"
	./setup.sh -s $(DOMAIN)

# Build all images
build:
	@if [ ! -f .env ]; then echo "⚠️  .env file not found. Run 'make setup' first."; exit 1; fi
	DOMAIN=$(DOMAIN) PROTOCOL=$(PROTOCOL) docker-compose build

# Start all services
up:
	@if [ ! -f .env ]; then echo "⚠️  .env file not found. Run 'make setup' first."; exit 1; fi
	DOMAIN=$(DOMAIN) PROTOCOL=$(PROTOCOL) docker-compose up -d

# Stop all services
down:
	docker-compose down

# Restart services
restart: down up

# Show logs
logs:
	docker-compose logs -f

# Clean up
clean:
	docker-compose down -v
	docker system prune -f

# Check environment variables
env-check:
	@echo "🔍 Checking environment configuration..."
	@if [ -f .env ]; then \
		echo "✅ .env file exists"; \
		echo "📋 Current configuration:"; \
		cat .env | grep -v "^#" | grep -v "^$$"; \
	else \
		echo "❌ .env file not found. Run 'make setup' first."; \
	fi
