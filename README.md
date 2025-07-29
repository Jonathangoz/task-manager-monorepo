# Task-Manager-MonoRepo

Este es el monorepo principal para el proyecto **Task Manager**, una aplicación de gestión de tareas construida con una arquitectura de microservicios. Contiene los servicios de backend, el frontend y las configuraciones compartidas.

## 🏗️ Estructura del Proyecto

El monorepo está organizado utilizando workspaces de `pnpm`, lo que facilita la gestión de múltiples paquetes en un solo repositorio.

├── services/
│   ├── auth-service/      # 🔐 Microservicio de Autenticación y Usuarios
│   └── task-service/      # ✅ Microservicio de Tareas y Categorías
├── frontend/
│   └── task-frontend/     # 🎨 Interfaz de usuario (Futuro)
├── shared/
│   └── ...                # 📦 Paquetes compartidos (Tipos, utilidades)
├── docker-compose.dev.yml # Orquestación de contenedores para desarrollo
├── package.json           # Scripts y dependencias principales
└── pnpm-workspace.yaml    # Definición de los workspaces

## Prerrequisitos

Asegúrate de tener instaladas las siguientes herramientas en tu entorno de desarrollo:

- **Node.js**: `v22.15.0` o superior
- **pnpm**: `v10.0.0` o superior
- **Docker** y **Docker Compose**

## 🚀 Instalación

1.  Clona el repositorio:
    ```bash
    git clone <tu-repositorio-url>
    cd task-manager-monorepo
    ```

2.  Instala todas las dependencias de los workspaces con `pnpm`:
    ```bash
    pnpm install
    ```

## 💻 Desarrollo Local con Docker

La forma recomendada de levantar el entorno de desarrollo completo es utilizando Docker Compose. Esto asegurará que todos los servicios y bases de datos se inicien y se conecten correctamente.

1.  **Levantar los servicios:**
    Ejecuta el siguiente comando desde la raíz del monorepo. Esto construirá las imágenes de los servicios (si no existen) y levantará todos los contenedores definidos en `docker-compose.dev.yml`.

    ```bash
    docker-compose -f docker-compose.dev.yml up --build
    ```

2.  **Ver logs de los servicios:**
    Para monitorear los logs de un servicio específico en tiempo real, abre otra terminal y usa:

    -   **Logs de Auth Service:**
        ```bash
        docker-compose -f docker-compose.dev.yml logs -f auth-service
        ```

    -   **Logs de Task Service:**
        ```bash
        docker-compose -f docker-compose.dev.yml logs -f task-service
        ```

3.  **Detener los servicios:**
    Para detener todos los contenedores, presiona `Ctrl + C` en la terminal donde ejecutaste el `up`, o ejecuta:
    ```bash
    docker-compose -f docker-compose.dev.yml down
    ```

## 📜 Scripts Disponibles

Puedes ejecutar los siguientes scripts desde la raíz del monorepo:

-   `pnpm setup`: Alias para `pnpm install`.
-   `pnpm build`: Compila todos los servicios del backend.
-   `pnpm dev`: Inicia todos los servicios en modo de desarrollo (sin Docker).
-   `pnpm lint`: Revisa el código de todos los paquetes con ESLint.
-   `pnpm test`: Ejecuta las pruebas para todos los paquetes.
-   `pnpm clean`: Elimina los directorios `dist` de todos los paquetes.

