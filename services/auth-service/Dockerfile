# Multi-stage Dockerfile para Auth Service
FROM node:22-alpine AS base

# auth-service - Dockerfile

# Instalar pnpm globalmente
RUN npm install -g pnpm@latest

# Crear directorio de trabajo
WORKDIR /app

# Crear usuario no-root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# ==============================================
FROM base AS dependencies

# Copiar archivos de configuración
COPY package.json pnpm-lock.yaml* ./
COPY prisma ./prisma

# Instalar dependencias de producción
RUN pnpm install --frozen-lockfile --prod

# ==============================================
FROM base AS build

# Copiar node_modules de dependencies
COPY --from=dependencies /node_modules ./node_modules

# Copiar código fuente
COPY . .

# Generar cliente de Prisma
RUN pnpm prisma:generate

# Compilar TypeScript
RUN pnpm build

# ==============================================
FROM base AS production

# Copiar dependencias y archivos compilados
COPY --from=dependencies /node_modules ./node_modules
COPY --from=build /dist ./dist
COPY --from=build ./package.json ./package.json
COPY --from=build /prisma ./prisma

# Cambiar ownership al usuario nodejs
RUN chown -R nodejs:nodejs /app
USER nodejs

# Exponer puerto
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/v1/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Comando de inicio
CMD ["node", "dist/server.js"]