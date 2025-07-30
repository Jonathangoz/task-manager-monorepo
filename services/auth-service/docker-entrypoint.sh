#!/bin/sh
set -e

# =============================================
# Helper function to wait for a service - auth-service
# =============================================
wait_for_service() {
  SERVICE_NAME=$1
  HOST=$2
  PORT=$3
  echo "⏳ Waiting for $SERVICE_NAME to be ready..."
  # Use netcat for TCP check, loop until connection is successful
  while ! nc -z "$HOST" "$PORT"; do
    sleep 1
  done
  echo "✅ $SERVICE_NAME is ready!"
}

# =============================================
# Wait for dependent services
# =============================================

# Wait for PostgreSQL database (applies to both auth-service and task-service)
# Asegúrate de que $DATABASE_HOST y $DATABASE_PORT estén definidos en tu docker-compose.dev.yml
wait_for_service "database" "$DATABASE_HOST" "$DATABASE_PORT"

# Wait for Redis (applies to both auth-service and task-service)
# Asegúrate de que $REDIS_HOST y $REDIS_PORT estén definidos en tu docker-compose.dev.yml
wait_for_service "Redis" "$REDIS_HOST" "$REDIS_PORT"

# Specific wait for Task Service to wait for Auth Service
# Esta sección solo se ejecutará para el 'task-service'
# Puedes usar una variable de entorno como SERVICE_NAME en docker-compose.dev.yml
# para diferenciar entre los servicios en el mismo entrypoint.sh
if [ "$SERVICE_NAME" = "task-service" ]; then
  echo "🔄 Waiting for Auth Service to be ready..."
  # Aquí usamos curl para una verificación de salud más robusta si el servicio tiene un endpoint /health
  # Si tu auth-service no tiene un endpoint /health aún, podrías usar una verificación de puerto con nc
  while ! curl -s http://auth-service:3001/health | grep -q '"status":"healthy"'; do
    echo "⏳ Auth Service not ready yet, waiting..."
    sleep 5
  done
  echo "✅ Auth Service is ready!"
fi

echo "🚀 Starting Service..."

# =============================================
# Crucial fix: Set NODE_PATH
# This helps Node.js and ts-node resolve local modules correctly,
# especially with pnpm's symlinks and tsconfig-paths/register.
# =============================================
export NODE_PATH=/app/node_modules

# =============================================
# Install dependencies if node_modules doesn't exist or is empty
# =============================================
if [ ! -d "node_modules" ] || [ -z "$(ls -A node_modules)" ]; then
  echo "🔄 Installing dependencies..."
  pnpm install --no-frozen-lockfile
fi

# =============================================
# Prisma Setup
# =============================================
echo "🔄 Running database migrations..."
# Se asume que prisma:migrate:dev ya usa ts-node -r tsconfig-paths/register internamente via package.json
pnpm prisma:migrate:dev

echo "🔄 Generating Prisma client..."
# Se asume que prisma:generate ya usa ts-node -r tsconfig-paths/register internamente via package.json
pnpm prisma:generate

echo "🎉 All setup complete! Starting application..."

# =============================================
# Execute the main application command
# =============================================
# "$@" se refiere a los argumentos pasados al ENTRYPOINT (e.g., "pnpm", "dev")
exec "$@"