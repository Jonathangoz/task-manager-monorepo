// src/scripts/validate-swagger.ts
import {
  swaggerSpec,
  validateSwaggerSpec,
  getSwaggerInfo,
} from '@/utils/swagger';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

async function main() {
  console.log('🔍 Validating Swagger Documentation...\n');

  // Validar especificación
  const validation = validateSwaggerSpec();

  if (!validation.isValid) {
    console.error('❌ Swagger validation failed:');
    validation.errors.forEach((error) => console.error(`  - ${error}`));
    process.exit(1);
  }

  // Mostrar información de la spec
  const info = getSwaggerInfo();
  console.log('✅ Swagger specification is valid!\n');
  console.log('📊 Documentation Info:');
  console.log(`  📖 Title: ${info.title}`);
  console.log(`  🔢 Version: ${info.version}`);
  console.log(`  🌐 Servers: ${info.servers}`);
  console.log(`  🛣️  Paths: ${info.paths}`);
  console.log(`  📋 Schemas: ${info.schemas}`);
  console.log(`  🏷️  Tags: ${info.tags}\n`);

  // Generar archivo JSON
  try {
    // Crear directorio docs si no existe
    const docsDir = join(process.cwd(), 'docs');
    mkdirSync(docsDir, { recursive: true });

    // Escribir swagger.json
    const swaggerPath = join(docsDir, 'swagger.json');
    writeFileSync(swaggerPath, JSON.stringify(swaggerSpec, null, 2));
    console.log(`📄 Swagger JSON generated: ${swaggerPath}`);

    // Generar archivo de información
    const infoPath = join(docsDir, 'api-info.json');
    writeFileSync(
      infoPath,
      JSON.stringify(
        {
          ...info,
          generatedAt: new Date().toISOString(),
          nodeVersion: process.version,
        },
        null,
        2,
      ),
    );
    console.log(`📋 API info generated: ${infoPath}`);

    console.log(
      '\n🎉 Documentation validation and generation completed successfully!',
    );
  } catch (error) {
    console.error('❌ Error generating documentation files:', error);
    process.exit(1);
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main().catch(console.error);
}

export default main;
