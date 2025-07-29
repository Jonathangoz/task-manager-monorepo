FROM node:22-alpine AS base

# task-service - Dockerfile

# Instalar pnpm globalmente
RUN npm install -g pnpm@latest

# Crear directorio de trabajo
WORKDIR /app

# Crear usuario no-root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S taskservice -u 1001

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
COPY --from=dependencies /app/node_modules ./node_modules

# Copiar código fuente
COPY . .

# Generar cliente de Prisma
RUN pnpm prisma:generate

# Compilar TypeScript
RUN pnpm build

# ==============================================
FROM base AS production

# Copiar dependencias y archivos compilados
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma

# Cambiar ownership al usuario nodejs
RUN chown -R taskservice:nodejs /app
USER taskservice

# Exponer puerto
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/api/v1/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Comando de inicio
CMD ["node", "dist/server.js"]