# ==============================================
# AUTH SERVICE DOCKERFILE
# Multi-stage build para optimización
# ==============================================

# Etapa de construcción
FROM node:18-alpine AS builder

# Metadata
LABEL maintainer="Task Manager Team"
LABEL description="Auth Service - Task Manager Microservices"
LABEL version="1.0.0"

# Instalar dependencias del sistema
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libc6-compat

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/

# Instalar dependencias
RUN npm ci --only=production && npm cache clean --force

# Generar Prisma Client
RUN npx prisma generate

# Copiar código fuente
COPY src ./src

# Construir aplicación
RUN npm run build

# ==============================================
# Etapa de producción
FROM node:18-alpine AS production

# Instalar dumb-init para manejo de procesos
RUN apk add --no-cache dumb-init

# Crear usuario no-root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S authuser -u 1001

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos necesarios desde builder
COPY --from=builder --chown=authuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=authuser:nodejs /app/dist ./dist
COPY --from=builder --chown=authuser:nodejs /app/prisma ./prisma
COPY --from=builder --chown=authuser:nodejs /app/package*.json ./

# Cambiar a usuario no-root
USER authuser

# Exponer puerto
EXPOSE 3001

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/api/v1/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Comando de inicio con dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]