# 🔐 Microservicio Auth Service

Este documento describe el Microservicio Auth Service, un componente crucial dentro del monorepo Task Manager, dedicado a la gestión de identidad y acceso. Se encarga de la autenticación de usuarios, autorización, gestión de perfiles y seguridad de las sesiones.

 ✨ Funcionalidades

El Auth Service proporciona funcionalidades robustas para una gestión segura de la identidad:

  * Autenticación Robusta: Gestiona los procesos de registro, inicio de sesión y cierre de sesión de usuarios.
  * Seguridad de Contraseña: Garantiza la seguridad de las contraseñas mediante el hashing con Argon2.
  * Gestión de Tokens:
      * Genera tokens de acceso (JWT) y tokens de refresco.
      * Emplea JWE (JSON Web Encryption) para proteger el contenido de los tokens.
      * Maneja la verificación y el refresco de tokens.
  * Gestión de Perfil de Usuario: Permite la creación, recuperación y actualización de perfiles de usuario.
  * Gestión de Sesiones: Rastrea y revoca las sesiones de usuario activas.
  * Seguridad Avanzada:
      * Implementa Limitación de Tasa (Rate Limiting) para prevenir ataques de fuerza bruta.
      * Configura cabeceras de seguridad utilizando Helmet.
      * Asegura la integridad de los datos con validación de entrada utilizando Zod.
  * Caché de Alto Rendimiento: Utiliza Redis para el almacenamiento en caché de sesiones y perfiles de usuario, mejorando el rendimiento.

 🛠️ Tecnologías

El Auth Service está construido con las siguientes tecnologías clave:

  * Backend: Node.js, Express.js, TypeScript
  * ORM: Prisma con PostgreSQL
  * Caché: Redis
  * Autenticación: `jose` (para JWE/JWT), `argon2` para el hashing de contraseñas
  * Contenerización: Docker
  * Motores: Node.js `>=22.15.0`, pnpm `>=10.0.0`

 🏗️ Estructura del Proyecto

El servicio se adhiere a una arquitectura limpia y modular, inspirada en los principios de diseño hexagonal (puertos y adaptadores), para mantener un código organizado y escalable.

```
services/auth-service/
├── package.json                      # Define las dependencias y scripts del proyecto
├── tsconfig.json                     # Configuración de TypeScript
├── .env.example                      # Archivo de ejemplo para variables de entorno
├── .env                              # Variables de entorno para la configuración del servicio
├── Dockerfile                        # Dockerfile para la imagen de producción
├── Dockerfile.dev                    # Dockerfile para la imagen de desarrollo
├── README.md                         # Documentación del microservicio (este archivo)
├── .gitignore                        # Archivos y directorios ignorados por Git
├── .prettierignore                   # Archivos y directorios ignorados por Prettier
├── jest.config.js                    # Configuración de Jest para pruebas
├── prisma/                           # Directorio para Prisma ORM
│   ├── schema.prisma                 # Define el modelo de datos de usuario y sesión
│   ├── seed.ts                       # Script para sembrar datos iniciales en la DB
│   └── migrations/                   # Migraciones de la base de datos
├── src/                              # Código fuente de la aplicación
│   ├── config/                       # Archivos de configuración
│   │   ├── database.ts               # Configuración de la conexión a la base de datos
│   │   ├── redis.ts                  # Configuración de la conexión a Redis
│   │   └── environment.ts            # Configuración de variables de entorno
│   ├── core/                         # Capa de dominio y aplicación (lógica de negocio)
│   │   ├── application/              # Lógica de negocio (servicios de aplicación/casos de uso)
│   │   │   ├── AuthService.ts        # Servicio de autenticación
│   │   │   ├── UserService.ts        # Servicio de gestión de usuarios
│   │   │   └── TokenService.ts       # Servicio para la gestión de tokens
│   │   ├── domain/                   # Entidades y contratos (interfaces) del dominio
│   │   │   ├── entities/             # Definiciones de entidades del dominio
│   │   │   │   └── User.ts           # Entidad de usuario
│   │   │   └── interfaces/           # Interfaces de puertos (contratos de servicios)
│   │   │       ├── IUserRepository.ts     # Interfaz para el repositorio de usuarios
│   │   │       ├── IAuthService.ts        # Interfaz para el servicio de autenticación
│   │   │       ├── ITokenService.ts       # Interfaz para el servicio de tokens
|   |    |	    ├── IUserService.ts        # Interfaz para el servicio de usuarios
│   │   │       └── ICacheService.ts       # Interfaz para el servicio de caché
│   │   └── infrastructure/           # Implementaciones de puertos (adaptadores)
│   │       ├── repositories/         # Implementaciones de repositorios para la base de datos
│   │       │   └── UserRepository.ts # Implementación de IUserRepository usando Prisma
│   │       └── cache/                # Implementación del servicio de caché
│   │           └── RedisCache.ts     # Implementación de ICacheService usando Redis
│   ├── commons/                      # Componentes comunes de la aplicación
│   │   ├── controllers/              # Manejadores de rutas Express
│   │   │   ├── AuthController.ts     # Controlador para rutas de autenticación
│   │   │   ├── HealthController.ts   # Controlador para el health check
│   │   │   └── UserController.ts     # Controlador para rutas de usuario
│   │   ├── middlewares/              # Middlewares de Express (auth, error, etc.)
│   │   │   ├── auth.middleware.ts    # Middleware de autenticación y autorización
│   │   │   ├── validation.middleware.ts # Middleware para validación de datos de entrada
│   │   │   ├── error.middleware.ts   # Middleware global para manejo de errores
│   │   │   └── rateLimit.middleware.ts # Middleware para limitar la tasa de peticiones
│   │   ├── routes/                   # Definición de las rutas de la API
│   │   │   ├── auth.routes.ts        # Rutas relacionadas con autenticación
│   │   │   ├── user.routes.ts        # Rutas relacionadas con la gestión de usuarios
│   │   │   └── health.routes.ts      # Rutas para el health check
│   │   └── validators/               # Esquemas de validación con Zod
│   │       ├── auth.validator.ts     # Esquemas de validación para autenticación
│   │       └── user.validator.ts     # Esquemas de validación para usuarios
│   ├── utils/                        # Utilidades (logger, constantes, crypto)
│   │   ├── logger.ts                 # Configuración del logger
│   │   ├── crypto.ts                 # Utilidades criptográficas
│   │   ├── swagger.ts                # Configuración de Swagger
│   │   └── constants.ts              # Constantes de la aplicación
│   ├── types/                        # Definiciones de tipos adicionales
│   │   └── express.d.ts              # Declaraciones de tipos para Express
│   ├── app.ts                        # Configuración principal de la aplicación Express
│   └── server.ts                     # Punto de entrada, inicia el servidor HTTP
└── __tests__/                        # Directorio para pruebas
    ├── unit/                         # Pruebas unitarias
    └── integration/                  # Pruebas de integración
```

 ⚙️ Variables de Entorno

Para ejecutar el servicio, crea un archivo `.env` en la raíz de este servicio a partir del `.env.example`. Las variables clave son:

  * `DATABASE_URL`: Cadena de conexión a la base de datos PostgreSQL.
  * `REDIS_URL`: URL de conexión al servidor Redis.
  * `REDIS_PREFIX`: Prefijo para las claves de Redis para este servicio.
  * `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `JWE_SECRET`: Secretos para la generación y verificación de tokens.
  * `JWT_EXPIRES_IN`, `REFRESH_TOKEN_EXPIRES_IN`: Tiempos de expiración para los tokens.
  * `JWE_ALGORITHM`, `JWE_ENCRYPTION`: Algoritmos para la encriptación JWE.
  * `CORS_ORIGIN`: Orígenes permitidos para las peticiones CORS.
  * `HELMET_ENABLED`: Habilita o deshabilita las cabeceras de seguridad.
  * `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`: Configuración para la limitación de tasa.
  * `LOG_LEVEL`, `LOG_PRETTY`: Configuración para el nivel de log y el formato de salida.
  * `HEALTH_CHECK_ENABLED`, `SWAGGER_ENABLED`: Habilitar o deshabilitar health check y Swagger.

 🚀 Ejecución

El despliegue y ejecución del `auth-service` se gestiona a través del monorepo principal, utilizando Docker Compose para entornos de desarrollo local.

# Con Docker (Recomendado para Desarrollo Local)

Desde la raíz del monorepo, puedes levantar todos los servicios, incluyendo el Auth Service:

```bash
docker-compose -f docker-compose.dev.yml up --build
```

Esto construirá las imágenes necesarias y levantará los contenedores para el `auth-service`, `task-service` y sus dependencias (PostgreSQL, Redis).

# Desarrollo Local (sin Docker Compose)

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
    pnpm --filter=task-manager-auth-service dev
    ```

 📡 Endpoints de la API

La API del Auth Service está versionada bajo `/api/v1`.

  * `POST /api/v1/auth/register`: Registro de un nuevo usuario.
  * `POST /api/v1/auth/login`: Inicio de sesión.
  * `POST /api/v1/auth/refresh`: Renovar token de acceso.
  * `POST /api/v1/auth/logout`: Cerrar sesión.
  * `POST /api/v1/auth/verify-token`: Endpoint interno para validación de tokens por otros servicios.
  * `GET /api/v1/auth/me`: Obtener perfil del usuario actual.
  * `PUT /api/v1/auth/me`: Actualizar perfil del usuario.
  * `GET /api/v1/health`: Health check del servicio.
  * `GET /api/v1/docs`: Documentación interactiva de la API (Swagger).

 📜 Scripts de Desarrollo y Producción

Los siguientes scripts están disponibles para facilitar el desarrollo, la construcción y las pruebas del servicio:

  * `dev`: Inicia el servicio en modo de desarrollo con `nodemon` para recarga automática.
  * `build`: Limpia el directorio `dist` y compila el código TypeScript a JavaScript.
  * `start`: Inicia el servicio compilado en JavaScript.
  * `start:prod`: Inicia el servicio en modo de producción.
  * `clean`: Elimina el directorio `dist`.
  * `lint`: Ejecuta ESLint en el código fuente y corrige automáticamente los problemas.
  * `lint:check`: Ejecuta ESLint en el código fuente sin corregir.
  * `test`: Ejecuta todas las pruebas Jest en modo de prueba.
  * `test:watch`: Ejecuta las pruebas Jest en modo de observación.
  * `test:coverage`: Ejecuta las pruebas Jest y genera un informe de cobertura de código.
  * `prisma:generate`: Genera el cliente Prisma a partir del `schema.prisma`.
  * `prisma:migrate`: Aplica las migraciones pendientes a la base de datos.
  * `prisma:migrate:dev`: Crea y aplica nuevas migraciones de desarrollo.
  * `prisma:seed`: Ejecuta el script de siembra de datos de Prisma.
  * `swagger:validate`: Valida el archivo de configuración de Swagger.
  * `swagger:generate`: Genera el archivo `swagger.json` a partir de las anotaciones.
  * `docs:serve`: Sirve la documentación de Swagger UI.
  * `docs:build`: Construye la documentación de la API con Redoc CLI.

 📦 Dependencias Clave

Las principales dependencias utilizadas en este microservicio son:

  * `@prisma/client`: Cliente ORM para interactuar con la base de datos PostgreSQL.
  * `argon2`: Librería para el hashing seguro de contraseñas.
  * `axios`: Cliente HTTP para realizar peticiones a otros servicios.
  * `compression`: Middleware para compresión de respuestas HTTP.
  * `connect-timeout`: Middleware para establecer un tiempo de espera en las peticiones.
  * `cookie-parser`: Middleware para analizar las cookies de las peticiones.
  * `cors`: Middleware para habilitar Cross-Origin Resource Sharing.
  * `dotenv`: Carga variables de entorno desde un archivo `.env`.
  * `express`: Framework web para Node.js.
  * `express-rate-limit`: Middleware para limitar la tasa de peticiones.
  * `express-slow-down`: Middleware para ralentizar las respuestas después de un número de peticiones.
  * `helmet`: Colección de middlewares para mejorar la seguridad de la aplicación Express.
  * `http-errors`: Utilidad para crear objetos de error HTTP.
  * `ioredis`: Cliente de Redis de alto rendimiento.
  * `jose`: Implementación de JavaScript Object Signing and Encryption (JOSE) para JWT/JWE.
  * `morgan`: Middleware de logging de peticiones HTTP.
  * `pino`: Logger de alto rendimiento.
  * `pino-pretty`: Formateador de logs para `pino`.
  * `prisma`: Herramienta ORM de próxima generación.
  * `swagger-jsdoc`: Generador de especificaciones Swagger/OpenAPI.
  * `swagger-ui-express`: Middleware para servir la documentación Swagger UI.
  * `tsconfig-paths`: Permite el uso de alias de módulos en TypeScript.
  * `zod`: Librería de declaración y validación de esquemas.