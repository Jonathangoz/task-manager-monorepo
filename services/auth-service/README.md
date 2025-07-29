# Auth-Service

🔐 Auth Service - Task Manager
Este microservicio es el pilar central para la gestión de identidad en la aplicación Task Manager. Se encarga de la autenticación, autorización, gestión de perfiles de usuario y seguridad de las sesiones.

✨ Funcionalidades
Autenticación Robusta: Registro, inicio de sesión y cierre de sesión.

Seguridad de Contraseña: Hashing con Argon2.

Gestión de Tokens:

Generación de tokens de acceso (JWT) y de refresco.

Uso de JWE (JSON Web Encryption) para proteger el contenido de los tokens.

Verificación y refresco de tokens.

Gestión de Perfil de Usuario: Creación, consulta y actualización de perfiles.

Gestión de Sesiones: Rastreo y revocación de sesiones activas por usuario.

Seguridad Avanzada:

Limitación de tasa (Rate Limiting) para prevenir ataques de fuerza bruta.

Cabeceras de seguridad con Helmet.

Validación de datos de entrada con Zod.

Caché de Alto Rendimiento: Uso de Redis para cachear sesiones y perfiles.

🛠️ Tecnologías
Backend: Node.js, Express.js, TypeScript

ORM: Prisma con PostgreSQL

Caché: Redis

Autenticación: jose (para JWE/JWT), argon2 para hash de contraseñas

Contenerización: Docker

📁 Estructura de Archivos
El servicio sigue una arquitectura hexagonal (puertos y adaptadores) para mantener un código limpio y escalable.

services/auth-service/
├── prisma/
│   ├── schema.prisma   # Define el modelo de datos de usuario y sesión
│   └── migrations/     # Migraciones de la base de datos
├── src/
│   ├── config/         # Configuración de entorno, base de datos y Redis
│   ├── core/
│   │   ├── application/  # Lógica de negocio (servicios)
│   │   ├── domain/       # Entidades y contratos (interfaces)
│   │   └── infrastructure/ # Implementaciones (repositorios, caché)
│   ├── commons/
│   │   ├── controllers/  # Manejadores de rutas Express
│   │   ├── middlewares/  # Middlewares de Express (auth, error, etc.)
│   │   ├── routes/       # Definición de las rutas de la API
│   │   └── validators/   # Esquemas de validación con Zod
│   ├── utils/            # Utilidades (logger, constantes, crypto)
│   ├── app.ts            # Configuración principal de la app Express
│   └── server.ts         # Punto de entrada, inicia el servidor HTTP
└── ...                 # Archivos de configuración (package.json, Dockerfile, etc.)


⚙️ Variables de EntornoPara ejecutar el servicio, crea un archivo .env en la raíz de este servicio a partir del .env.example. Las variables clave son:DATABASE_URL: Cadena de conexión a la base de datos PostgreSQL.REDIS_URL: URL de conexión al servidor Redis.JWT_SECRET, REFRESH_TOKEN_SECRET, JWE_SECRET: Secretos para la generación de tokens.CORS_ORIGIN: Orígenes permitidos para las peticiones.🚀 EjecuciónCon Docker (Recomendado)Desde la raíz del monorepo, ejecuta:docker-compose -f docker-compose.dev.yml up --build
Desarrollo LocalDesde la raíz del monorepo, ejecuta:pnpm --filter=task-manager-auth-service dev
📡 Endpoints de la APILa API está versionada bajo /api/v1.POST /auth/register: Registro de un nuevo usuario.POST /auth/login: Inicio de sesión.POST /auth/refresh: Renovar token de acceso.POST /auth/logout: Cerrar sesión.POST /auth/verify-token: Endpoint interno para validación de tokens por otros servicios.GET /users/me: Obtener perfil del usuario actual.PUT /users/me: Actualizar perfil del usuario.GET /health: Health check del servicio.GET /docs: Documentación interactiva de la API (Swagger).