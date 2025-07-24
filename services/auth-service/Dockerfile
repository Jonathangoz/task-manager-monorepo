# services/auth-service/Dockerfile

# 1. Etapa Base
FROM node:22-alpine AS base
WORKDIR /app
COPY package.json pnpm-lock.yaml ./

# 2. Etapa de Dependencias
FROM base AS dependencies
# Copia la configuración del workspace y el lockfile raíz
COPY ../../pnpm-workspace.yaml ./
# Copia selectivamente el package.json de las dependencias
COPY ../task-service/package.json ./services/task-service/package.json
COPY ../../shared/types/package.json ./shared/types/package.json
# Instala TODAS las dependencias de producción para el monorepo
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

# 3. Etapa de Construcción
FROM base AS build
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# 4. Etapa de Producción
FROM node:22-alpine AS production
WORKDIR /app
# Copia solo las dependencias de producción y el código compilado
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
# Copia el esquema de Prisma para acceso en tiempo de ejecución
COPY --from=build /app/prisma/schema.prisma ./prisma/schema.prisma

# Genera el cliente de Prisma
RUN npx prisma generate

EXPOSE 3001
CMD ["node", "dist/server.js"]