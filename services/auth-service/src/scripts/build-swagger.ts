// src/scripts/build-swagger.ts
import { swaggerSpec, getSwaggerInfo } from '@/utils/swagger';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

async function buildSwaggerDocs() {
  console.log('🔨 Building Swagger Documentation...\n');

  try {
    // Crear directorio docs si no existe
    const docsDir = join(process.cwd(), 'docs');
    mkdirSync(docsDir, { recursive: true });

    // 1. Generar swagger.json
    const swaggerPath = join(docsDir, 'swagger.json');
    writeFileSync(swaggerPath, JSON.stringify(swaggerSpec, null, 2));
    console.log(`✅ Generated: ${swaggerPath}`);

    // 2. Generar info del API
    const info = getSwaggerInfo();
    const infoPath = join(docsDir, 'api-info.json');
    writeFileSync(
      infoPath,
      JSON.stringify(
        {
          ...info,
          generatedAt: new Date().toISOString(),
          nodeVersion: process.version,
          totalEndpoints: Object.keys(swaggerSpec.paths || {}).length,
        },
        null,
        2,
      ),
    );
    console.log(`✅ Generated: ${infoPath}`);

    // 3. Generar HTML básico para Swagger UI
    const htmlContent = generateSwaggerHTML();
    const htmlPath = join(docsDir, 'index.html');
    writeFileSync(htmlPath, htmlContent);
    console.log(`✅ Generated: ${htmlPath}`);

    console.log('\n🎉 Swagger documentation built successfully!');
    console.log(
      `📊 Total endpoints documented: ${Object.keys(swaggerSpec.paths || {}).length}`,
    );
    console.log(`🌐 Open docs at: http://localhost:3000/api/v1/docs`);
  } catch (error) {
    console.error('❌ Error building Swagger docs:', error);
    process.exit(1);
  }
}

function generateSwaggerHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Task Manager Auth Service - API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.0.0/swagger-ui.css" />
  <style>
    html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin:0; background: #fafafa; }
    .swagger-ui .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.0.0/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.0.0/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const ui = SwaggerUIBundle({
        url: './swagger.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout"
      });
    };
  </script>
</body>
</html>`;
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  buildSwaggerDocs().catch(console.error);
}

export default buildSwaggerDocs;
