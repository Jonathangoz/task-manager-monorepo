# services/task-service/Dockerfile

# 1. Etapa Base
FROM node:22-alpine AS base
WORKDIR /app

# Instalar dependencias del sistema
RUN apk add --no-cache libc6-compat

# Instalar pnpm globalmente
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./

# 2. Etapa de Dependencias
FROM base AS dependencies
# Copia la configuración del workspace y el lockfile raíz
COPY ../../pnpm-workspace.yaml ./
# Copia selectivamente el package.json de las dependencias
COPY ../auth-service/package.json ./services/auth-service/package.json
COPY ../../shared/types/package.json ./shared/types/package.json
# Copia el esquema de Prisma
COPY prisma ./prisma/
# Instala TODAS las dependencias de producción para el monorepo
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile
# Genera el cliente de Prisma
RUN npx prisma generate

# 3. Etapa de Construcción
FROM base AS build
# Instala pnpm en la etapa de build también
RUN npm install -g pnpm
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/prisma ./prisma
# Instala dependencias de desarrollo para el build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# 4. Etapa de Producción
FROM node:22-alpine AS production
WORKDIR /app

# Instalar dependencias del sistema
RUN apk add --no-cache libc6-compat

# Crear usuario no-root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 taskservice

# Copia solo las dependencias de producción y el código compilado
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
# Copia el esquema de Prisma para acceso en tiempo de ejecución
COPY --from=build /app/prisma/schema.prisma ./prisma/schema.prisma

# Genera el cliente de Prisma (ya debería estar en node_modules pero por seguridad)
RUN npx prisma generate

# Cambiar ownership
RUN chown -R taskservice:nodejs /app
USER taskservice

# Exponer puerto
EXPOSE 3002

# Variables de entorno
ENV NODE_ENV=production
ENV PORT=3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node dist/health-check.js || exit 1

# Comando de inicio
CMD ["node", "dist/server.js"]