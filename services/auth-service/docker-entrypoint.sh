#!/bin/sh
set -e

echo "🚀 Starting Auth Service..."

# Esperar a que la base de datos esté disponible
echo "⏳ Waiting for database to be ready..."
until pg_isready -h auth-db -p 5432 -U postgres -d auth_db; do
  echo "Database is unavailable - sleeping"
  sleep 2
done

echo "✅ Database is ready!"

# Esperar a que Redis esté disponible
echo "⏳ Waiting for Redis to be ready..."
until redis-cli -h redis -p 6379 ping; do
  echo "Redis is unavailable - sleeping"
  sleep 2
done

echo "✅ Redis is ready!"

# Ejecutar migraciones de Prisma
echo "🔄 Running database migrations..."
pnpm prisma:migrate:dev

# Generar cliente de Prisma (por si acaso)
echo "🔄 Generating Prisma client..."
pnpm prisma:generate

echo "🎉 All setup complete! Starting application..."

# Ejecutar el comando pasado como argumentos
exec "$@"