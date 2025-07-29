# Task-Service

## ✨ Funcionalidades

El Task Service ofrece una serie de funcionalidades robustas para la gestión eficiente de tareas:

  * Gestión Completa de Tareas (CRUD): Permite crear, leer, actualizar y eliminar tareas con atributos detallados como título, descripción, estado, prioridad, fecha de vencimiento y etiquetas.
  * Gestión de Categorías (CRUD): Facilita la organización de tareas mediante la creación, consulta, actualización y eliminación de categorías.
  * Filtrado y Búsqueda Avanzada: Soporta filtros por estado, prioridad, categoría, rango de fechas de vencimiento, tareas vencidas, tareas con o sin fecha de vencimiento, y búsqueda por texto.
  * Paginación y Ordenamiento: Implementa paginación para manejar grandes volúmenes de tareas y opciones de ordenamiento personalizables.
  * Validación de Datos: Asegura la integridad de los datos mediante validación robusta de los datos de entrada.
  * Caché de Alto Rendimiento: Utiliza Redis para cachear datos frecuentemente accedidos, mejorando la velocidad de respuesta.
  * Comunicación Segura: Interactúa con otros microservicios de forma segura, validando tokens de autenticación.

## 🛠️ Tecnologías

El Task Service está construido con las siguientes tecnologías clave:

  * Backend: Node.js, Express.js, TypeScript
  * ORM: Prisma con PostgreSQL
  * Caché: Redis
  * Validación de Datos: Zod
  * Contenerización: Docker

## 🏗️ Project Structure

El servicio sigue una arquitectura limpia y modular, inspirada en principios de diseño hexagonal (puertos y adaptadores), para mantener un código organizado y escalable.

```
services/task-service/
├── package.json                                            # Define dependencias y scripts del proyecto
├── tsconfig.json                                           # Configuración de TypeScript
├── .env.example                                            # Ejemplo de variables de entorno requeridas
├── .env                                                    # Variables de entorno específicas del ambiente
├── docker-entrypoint.sh                                    # Script de entrada para Docker
├── Dockerfile                                              # Dockerfile para la imagen de producción
├── Dockerfile.dev                                          # Dockerfile para la imagen de desarrollo
├── README.md                                               # Documentación del servicio (este archivo)
├── .gitignore                                              # Archivos y directorios a ignorar por Git
├── .eslintrc.js                                            # Configuración de ESLint para linting de código
├── .prettierinore                                          # Configuración de Prettier para formateo de código
├── jest.config.js                                          # Configuración de Jest para pruebas unitarias
├── .dockerignore                                           # Archivos y directorios a ignorar por Docker
├── prisma/                                                 # Directorio para Prisma ORM
│   ├── schema.prisma                                       # Define el esquema de la base de datos (tareas y categorías)
│   ├── seed.ts                                             # Script para sembrar datos iniciales en la DB
│   └── migrations/                                         # Directorio para las migraciones de la base de datos
├── src/                                                    # Código fuente de la aplicación
│   ├── config/                                             # Archivos de configuración de la aplicación
│   │   ├── database.ts                                     # Configuración de la conexión a la base de datos
│   │   ├── redis.ts                                        # Configuración de la conexión a Redis
│   │   └── environment.ts                                  # Configuración de variables de entorno
│   ├── core/                                               # Capa de dominio y aplicación (lógica de negocio)
│   │   ├── application/                                    # Servicios de aplicación que implementan casos de uso
│   │   │   ├── TaskService.ts                              # Lógica de negocio para la gestión de tareas
│   │   │   ├── CategoryService.ts                          # Lógica de negocio para la gestión de categorías
│   │   │   └── AuthMiddleware.ts                           # Middleware para la autenticación y autorización
│   │   ├── domain/                                         # Entidades y reglas de negocio puras
│   │   │   ├── entities/                                   # Definiciones de entidades del dominio
│   │   │   │   ├── Task.ts                                 # Entidad de Tarea
│   │   │   │   └── Category.ts                             # Entidad de Categoría
│   │   │   ├── types/                                      # Definiciones de tipos personalizados del dominio
│   │   │   │   └── TaskDomain.ts                           # Tipos relacionados con el dominio de tareas
│   │   │   └── interfaces/                                 # Interfaces de puertos (contratos)
│   │   │       ├── ITaskRepository.ts                      # Interfaz para el repositorio de tareas
│   │   │       ├── ICategoryRepository.ts                  # Interfaz para el repositorio de categorías
│   │   │       ├── ICacheService.ts                        # Interfaz para el servicio de caché
│   │   │       └── IAuthService.ts                         # Interfaz para el servicio de autenticación externo
│   │   └── infrastructure/                                 # Implementaciones de puertos (adaptadores)
│   │       ├── database/                                   # Implementaciones de repositorios para la base de datos
│   │       │   ├── PrismaTaskRepository.ts                 # Implementación de ITaskRepository usando Prisma
│   │       │   └── PrismaCategoryRepository.ts             # Implementación de ICategoryRepository usando Prisma
│   │       ├── cache/                                      # Implementación del servicio de caché
│   │       │   └── RedisCacheService.ts                    # Implementación de ICacheService usando Redis
│   │       └── http/                                       # Implementaciones para comunicación HTTP
│   │           └── AuthHttpService.ts                      # Implementación de IAuthService para llamadas HTTP
│   ├── commons/                                            # Componentes comunes de la aplicación
│   │   ├── controllers/                                    # Controladores de Express que manejan las solicitudes HTTP
│   │   │   ├── TaskController.ts                           # Controlador para las rutas de tareas
│   │   │   └── CategoryController.ts                       # Controlador para las rutas de categorías
│   │   ├── middlewares/                                    # Middlewares de Express
│   │   │   ├── errorHandler.ts                             # Middleware global para manejo de errores
│   │   │   ├── validationHandler.ts                        # Middleware para manejo de errores de validación
│   │   │   └── authMiddleware.ts                           # Middleware para autenticación
│   │   ├── routes/                                         # Definición de las rutas de la API
│   │   │   ├── taskRoutes.ts                               # Rutas específicas para tareas
│   │   │   └── categoryRoutes.ts                           # Rutas específicas para categorías
│   │   └── validators/                                     # Esquemas de validación de datos de entrada
│   │       ├── taskValidators.ts                           # Esquemas de validación para tareas
│   │       └── categoryValidators.ts                       # Esquemas de validación para categorías
│   ├── utils/                                              # Funciones de utilidad y helpers
│   │   ├── constants.ts                                    # Constantes de la aplicación
│   │   ├── logger.ts                                       # Configuración del logger
│   │   └── pagination.ts                                   # Funciones de utilidad para paginación
│   ├── app.ts                                              # Configuración principal de la aplicación Express
│   └── server.ts                                           # Punto de entrada de la aplicación, inicia el servidor
└── test/                                                   # Archivos de pruebas
```

## ⚙️ Variables de Entorno

Para ejecutar el servicio, crea un archivo `.env` en la raíz de este servicio, basándote en el archivo `.env.example`. Las variables clave son:

  * `DATABASE_URL`: Cadena de conexión a la base de datos PostgreSQL.
  * `REDIS_URL`: URL de conexión al servidor Redis.
  * `PORT`: Puerto en el que se ejecutará el servicio (e.g., `3001`).
  * `AUTH_SERVICE_URL`: URL del microservicio de autenticación para la validación de tokens.
  * `JWT_PUBLIC_KEY`: Clave pública para verificar los tokens JWE/JWT emitidos por el Auth Service.
  * `CORS_ORIGIN`: Orígenes permitidos para las peticiones CORS.

 🚀 Ejecución

El despliegue y ejecución del `task-service` se gestiona a través del monorepo principal, utilizando Docker Compose para entornos de desarrollo local.

 Con Docker (Recomendado para Desarrollo Local)

Desde la raíz del monorepo, puedes levantar todos los servicios, incluyendo el Task Service:

```bash
docker-compose -f docker-compose.dev.yml up --build
```

Esto construirá las imágenes necesarias y levantará los contenedores para el `auth-service`, `task-service` y sus dependencias (PostgreSQL, Redis).

 Desarrollo Local (sin Docker Compose)

Para ejecutar el servicio individualmente en desarrollo (asumiendo que las dependencias de DB y Redis están corriendo):

1.  Instalar dependencias:
    ```bash
    pnpm install
    ```
2.  Generar el cliente Prisma e inicializar la base de datos:
    ```bash
    pnpm prisma generate
    pnpm prisma migrate dev --name init
    pnpm prisma db seed (opcional)
    ```
3.  Iniciar el servicio:
    ```bash
    pnpm --filter=task-manager-task-service dev
    ```

 📡 Endpoints de la API

La API del Task Service está versionada bajo `/api/v1`.

 Endpoints de Tareas

  * `POST /api/v1/tasks`: Crea una nueva tarea.
  * `GET /api/v1/tasks`: Obtiene todas las tareas, con soporte para filtrado, paginación y ordenamiento.
  * `GET /api/v1/tasks/:id`: Obtiene una tarea por su ID.
  * `PUT /api/v1/tasks/:id`: Actualiza una tarea existente por su ID.
  * `DELETE /api/v1/tasks/:id`: Elimina una tarea por su ID.
  * `PATCH /api/v1/tasks/:id/status`: Actualiza el estado de una tarea (e.g., a "completed").

 Endpoints de Categorías

  * `POST /api/v1/categories`: Crea una nueva categoría.
  * `GET /api/v1/categories`: Obtiene todas las categorías.
  * `GET /api/v1/categories/:id`: Obtiene una categoría por su ID.
  * `PUT /api/v1/categories/:id`: Actualiza una categoría existente por su ID.
  * `DELETE /api/v1/categories/:id`: Elimina una categoría por su ID.

 Endpoints de Salud

  * `GET /health`: Health check del servicio.
  