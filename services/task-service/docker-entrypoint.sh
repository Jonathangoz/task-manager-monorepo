#!/bin/sh
# docker-entrypoint.sh para Task Service

set -e

# Colores para logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para logging
log_info() {
    echo -e "${GREEN}[TASK-SERVICE]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[TASK-SERVICE]${NC} $1"
}

log_error() {
    echo -e "${RED}[TASK-SERVICE]${NC} $1"
}

log_debug() {
    echo -e "${BLUE}[TASK-SERVICE]${NC} $1"
}

# Función para verificar servicios con timeout más largo
wait_for_service() {
    local host=$1
    local port=$2
    local service_name=$3
    local timeout=${4:-120}
    
    log_info "Esperando conexión a $service_name ($host:$port)..."
    
    for i in $(seq 1 $timeout); do
        if nc -z "$host" "$port" >/dev/null 2>&1; then
            log_info "✅ $service_name está disponible"
            return 0
        fi
        
        if [ $i -eq $timeout ]; then
            log_error "❌ Timeout esperando $service_name después de ${timeout}s"
            exit 1
        fi
        
        sleep 1
    done
}

# Función para verificar Redis
check_redis() {
    local redis_host=${REDIS_HOST:-redis}
    local redis_port=${REDIS_PORT:-6379}
    local timeout=30
    
    log_info "Verificando conexión Redis..."
    
    for i in $(seq 1 $timeout); do
        if redis-cli -h "$redis_host" -p "$redis_port" ping >/dev/null 2>&1; then
            log_info "✅ Redis conectado correctamente"
            return 0
        fi
        sleep 1
    done
    
    log_error "❌ Error conectando a Redis después de ${timeout}s"
    return 1
}

# Función para verificar base de datos
check_database() {
    local db_host=${DATABASE_HOST:-task-db}
    local db_port=${DATABASE_PORT:-5432}
    local db_name=${POSTGRES_DB:-task_db}
    local db_user=${POSTGRES_USER:-postgres}
    local timeout=60
    
    log_info "Verificando conexión a PostgreSQL..."
    
    for i in $(seq 1 $timeout); do
        if pg_isready -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" >/dev/null 2>&1; then
            log_info "✅ PostgreSQL conectado correctamente"
            return 0
        fi
        sleep 1
    done
    
    log_error "❌ Error conectando a PostgreSQL después de ${timeout}s"
    return 1
}

# Función para verificar Auth Service (no bloqueante, pero con más intentos)
check_auth_service() {
    local auth_url=${AUTH_SERVICE_URL:-http://auth-service:3001}
    local timeout=180
    
    log_info "Verificando conexión al Auth Service..."
    
    for i in $(seq 1 $timeout); do
        if curl -f -s --max-time 10 --connect-timeout 5 "$auth_url/api/v1/health" >/dev/null 2>&1; then
            log_info "✅ Auth Service está disponible"
            return 0
        fi
        
        if [ $i -eq $timeout ]; then
            log_warn "⚠️  Auth Service no responde después de ${timeout}s, continuando..."
            return 0
        fi
        
        sleep 1
    done
}

# Función principal de inicialización
main() {
    log_info "🚀 Iniciando Task Service..."
    log_info "🔧 NODE_ENV: ${NODE_ENV:-development}"
    log_info "🔧 SERVICE_NAME: ${SERVICE_NAME:-task-service}"
    log_info "🔧 PORT: ${PORT:-3002}"
    log_info "🔧 AUTH_SERVICE_URL: ${AUTH_SERVICE_URL:-http://auth-service:3001}"
    
    # Esperar servicios dependientes con timeouts más largos
    wait_for_service "${DATABASE_HOST:-task-db}" "${DATABASE_PORT:-5432}" "PostgreSQL" 120
    wait_for_service "${REDIS_HOST:-redis}" "${REDIS_PORT:-6379}" "Redis" 60
    
    # Verificar conexiones
    check_database || exit 1
    check_redis || exit 1
    
    # Verificar Auth Service (no bloqueante pero informativo)
    check_auth_service
    
    # Ejecutar migraciones de Prisma
    log_info "🔄 Ejecutando migraciones de base de datos..."
    if pnpm prisma:migrate:dev; then
        log_info "✅ Migraciones ejecutadas correctamente"
    else
        log_warn "⚠️ Error ejecutando migraciones dev, intentando con deploy..."
        if pnpm prisma:migrate; then
            log_info "✅ Migraciones deploy ejecutadas correctamente"
        else
            log_error "❌ Error ejecutando migraciones"
            exit 1
        fi
    fi
    
    # Generar cliente Prisma
    log_info "🔄 Generando cliente Prisma..."
    if pnpm prisma:generate; then
        log_info "✅ Cliente Prisma generado correctamente"
    else
        log_error "❌ Error generando cliente Prisma"
        exit 1
    fi
    
    # Verificar que el directorio de logs existe
    mkdir -p /app/logs
    
    log_info "🎉 Task Service listo para iniciar!"
    
    # Ejecutar el comando pasado como argumentos
    exec "$@"
}

# Trap signals para graceful shutdown
trap 'log_warn "🛑 Recibida señal de terminación, cerrando gracefully..."; exit 0' TERM INT

# Ejecutar función principal
main "$@"