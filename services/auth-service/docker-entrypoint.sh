#!/bin/sh
# services/auth-service/docker-entrypoint.sh

set -e

echo "🔄 Waiting for database to be ready..."
while ! curl -f http://auth-db:5432 > /dev/null 2>&1; do
  echo "⏳ Database not ready yet, waiting..."
  sleep 2
done

echo "🔄 Waiting for Redis to be ready..."
while ! redis-cli -h redis -p 6379 -a redis_password ping > /dev/null 2>&1; do
  echo "⏳ Redis not ready yet, waiting..."
  sleep 2
done

echo "📦 Running Prisma migrations..."
pnpm prisma:migrate:dev --name init || true

echo "🌱 Running database seed..."
pnpm prisma:seed || true

echo "🚀 Starting Auth Service..."
exec "$@"