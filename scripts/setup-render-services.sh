#!/bin/bash
# scripts/setup-render-services.sh
# Script para configurar todos los servicios en Render automáticamente

set -e

echo "🚀 Setting up Task Manager services on Render..."

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para log con colores
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar que render CLI esté instalado
if ! command -v render &> /dev/null; then
    log_error "Render CLI not found. Please install it first:"
    echo "npm install -g @render/cli"
    exit 1
fi

# Verificar autenticación
if ! render auth whoami &> /dev/null; then
    log_error "Not authenticated with Render. Please run:"
    echo "render auth login"
    exit 1
fi

log_info "Setting up databases..."

# Crear PostgreSQL para Auth Service
log_info "Creating Auth Service database..."
render postgres create task-manager-auth-db \
    --name "Task Manager Auth DB" \
    --plan starter \
    --version 15 \
    --region oregon

# Crear PostgreSQL para Task Service  
log_info "Creating Task Service database..."
render postgres create task-manager-tasks-db \
    --name "Task Manager Tasks DB" \
    --plan starter \
    --version 15 \
    --region oregon

# Crear Redis
log_info "Creating Redis instance..."
render redis create task-manager-redis \
    --name "Task Manager Redis" \
    --plan starter \
    --region oregon

log_success "Databases created successfully!"

log_info "Setting up web services..."

# Crear Auth Service (Staging)
log_info "Creating Auth Service (Staging)..."
render service create web \
    --name task-manager-auth-staging \
    --repo https://github.com/your-username/task-manager-monorepo \
    --branch develop \
    --build-command "cd services/auth-service && npm ci && npm run build && npx prisma generate && npx prisma migrate deploy" \
    --start-command "cd services/auth-service && npm start" \
    --region oregon \
    --plan starter

# Crear Auth Service (Production)
log_info "Creating Auth Service (Production)..."
render service create web \
    --name task-manager-auth \
    --repo https://github.com/your-username/task-manager-monorepo \
    --branch main \
    --build-command "cd services/auth-service && npm ci && npm run build && npx prisma generate && npx prisma migrate deploy" \
    --start-command "cd services/auth-service && npm start" \
    --region oregon \
    --plan starter

# Crear Task Service (Staging)
log_info "Creating Task Service (Staging)..."
render service create web \
    --name task-manager-tasks-staging \
    --repo https://github.com/your-username/task-manager-monorepo \
    --branch develop \
    --build-command "cd services/task-service && npm ci && npm run build && npx prisma generate && npx prisma migrate deploy" \
    --start-command "cd services/task-service && npm start" \
    --region oregon \
    --plan starter

# Crear Task Service (Production)
log_info "Creating Task Service (Production)..."
render service create web \
    --name task-manager-tasks \
    --repo https://github.com/your-username/task-manager-monorepo \
    --branch main \
    --build-command "cd services/task-service && npm ci && npm run build && npx prisma generate && npx prisma migrate deploy" \
    --start-command "cd services/task-service && npm start" \
    --region oregon \
    --plan starter

# Crear Frontend (Staging)
log_info "Creating Frontend (Staging)..."
render service create web \
    --name task-manager-ui-staging \
    --repo https://github.com/your-username/task-manager-monorepo \
    --branch develop \
    --build-command "cd frontend/task-manager-ui && npm ci && npm run build" \
    --start-command "cd frontend/task-manager-ui && npm start" \
    --region oregon \
    --plan starter

# Crear Frontend (Production)
log_info "Creating Frontend (Production)..."
render service create web \
    --name task-manager-ui \
    --repo https://github.com/your-username/task-manager-monorepo \
    --branch main \
    --build-command "cd frontend/task-manager-ui && npm ci && npm run build" \
    --start-command "cd frontend/task-manager-ui && npm start" \
    --region oregon \
    --plan starter

log_success "All services created successfully!"

log_info "Next steps:"
echo "1. Configure environment variables for each service in Render dashboard"
echo "2. Set up GitHub secrets with Service IDs"
echo "3. Push to develop/main branches to trigger deployments"

log_warning "Remember to:"
echo "- Link databases to respective services"
echo "- Configure CORS origins between services"
echo "- Set up proper JWT/JWE secrets"
echo "- Configure Redis connection for all services"

log_success "Setup complete! 🎉"