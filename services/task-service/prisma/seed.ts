// prisma/seed.ts - Task Service Database Seeder
/*
import { PrismaClient, TaskStatus, Priority } from '@prisma/client';
import { logger } from '../src/utils/logger';

const prisma = new PrismaClient();

// Datos de prueba para usuarios (simula usuarios del Auth Service)
const DEMO_USERS = [
  {
    id: 'demo-user-1',
    name: 'Juan Pérez',
    email: 'juan@example.com'
  },
  {
    id: 'demo-user-2',
    name: 'María García',
    email: 'maria@example.com'
  },
  {
    id: 'demo-user-3',
    name: 'Carlos López',
    email: 'carlos@example.com'
  }
];

// Categorías predefinidas por usuario
const DEMO_CATEGORIES = [
  {
    name: 'Trabajo',
    description: 'Tareas relacionadas con el trabajo',
    color: '#3b82f6',
    icon: 'briefcase'
  },
  {
    name: 'Personal',
    description: 'Tareas personales y del hogar',
    color: '#10b981',
    icon: 'home'
  },
  {
    name: 'Salud',
    description: 'Citas médicas y ejercicio',
    color: '#f59e0b',
    icon: 'heart'
  },
  {
    name: 'Educación',
    description: 'Cursos y aprendizaje',
    color: '#8b5cf6',
    icon: 'book'
  },
  {
    name: 'Proyectos',
    description: 'Proyectos personales y profesionales',
    color: '#ef4444',
    icon: 'folder'
  }
];

// Tareas de ejemplo
const DEMO_TASKS = [
  {
    title: 'Revisar correos electrónicos',
    description: 'Revisar y responder correos importantes del día',
    status: TaskStatus.PENDING,
    priority: Priority.MEDIUM,
    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Mañana
    tags: ['comunicación', 'diario'],
    estimatedHours: 1
  },
  {
    title: 'Completar informe mensual',
    description: 'Finalizar el informe de ventas del mes anterior',
    status: TaskStatus.IN_PROGRESS,
    priority: Priority.HIGH,
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // En 3 días
    tags: ['informe', 'ventas'],
    estimatedHours: 4
  },
  {
    title: 'Reunión de equipo',
    description: 'Reunión semanal para revisar avances del proyecto',
    status: TaskStatus.COMPLETED,
    priority: Priority.MEDIUM,
    dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Ayer
    completedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
    tags: ['reunión', 'equipo'],
    estimatedHours: 2,
    actualHours: 2
  },
  {
    title: 'Hacer ejercicio',
    description: 'Rutina de ejercicio cardiovascular 30 minutos',
    status: TaskStatus.PENDING,
    priority: Priority.LOW,
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // En una semana
    tags: ['salud', 'ejercicio'],
    estimatedHours: 1
  },
  {
    title: 'Estudiar TypeScript',
    description: 'Continuar con el curso de TypeScript avanzado',
    status: TaskStatus.IN_PROGRESS,
    priority: Priority.MEDIUM,
    tags: ['programación', 'aprendizaje'],
    estimatedHours: 3
  },
  {
    title: 'Comprar víveres',
    description: 'Lista de compras para la semana',
    status: TaskStatus.PENDING,
    priority: Priority.LOW,
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // En 2 días
    tags: ['compras', 'hogar']
  },
  {
    title: 'Cita médica',
    description: 'Chequeo médico anual',
    status: TaskStatus.PENDING,
    priority: Priority.HIGH,
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // En una semana
    tags: ['salud', 'médico'],
    estimatedHours: 2
  },
  {
    title: 'Actualizar CV',
    description: 'Añadir experiencias recientes al currículum',
    status: TaskStatus.ON_HOLD,
    priority: Priority.MEDIUM,
    tags: ['profesional', 'cv']
  }
];

async function clearDatabase() {
  logger.info('🧹 Limpiando base de datos...');
  
  // Eliminar en orden correcto debido a las relaciones
  await prisma.taskStats.deleteMany();
  await prisma.task.deleteMany();
  await prisma.category.deleteMany();
  
  logger.info('✅ Base de datos limpia');
}

async function seedCategories() {
  logger.info('🏷️  Creando categorías...');
  
  const createdCategories: Record<string, any[]> = {};
  
  for (const user of DEMO_USERS) {
    createdCategories[user.id] = [];
    
    for (const categoryData of DEMO_CATEGORIES) {
      const category = await prisma.category.create({
        data: {
          ...categoryData,
          userId: user.id
        }
      });
      
      createdCategories[user.id].push(category);
      logger.info(`✅ Categoría "${category.name}" creada para ${user.name}`);
    }
  }
  
  return createdCategories;
}

async function seedTasks(categories: Record<string, any[]>) {
  logger.info('📝 Creando tareas...');
  
  let totalTasks = 0;
  
  for (const user of DEMO_USERS) {
    const userCategories = categories[user.id];
    
    // Crear tareas para cada usuario
    for (let i = 0; i < DEMO_TASKS.length; i++) {
      const taskData = DEMO_TASKS[i];
      
      // Asignar categoría de forma rotativa
      const categoryIndex = i % userCategories.length;
      const category = userCategories[categoryIndex];
      
      const task = await prisma.task.create({
        data: {
          ...taskData,
          userId: user.id,
          categoryId: category.id
        }
      });
      
      totalTasks++;
      logger.info(`✅ Tarea "${task.title}" creada para ${user.name} en categoría "${category.name}"`);
    }
    
    // Crear algunas tareas adicionales sin categoría
    const additionalTasks = [
      {
        title: `Tarea personal de ${user.name}`,
        description: 'Tarea específica sin categoría asignada',
        status: TaskStatus.PENDING,
        priority: Priority.LOW,
        userId: user.id,
        tags: ['personal']
      },
      {
        title: `Revisar proyecto ${user.name}`,
        description: 'Revisión urgente de proyecto en curso',
        status: TaskStatus.URGENT as any,
        priority: Priority.URGENT,
        dueDate: new Date(Date.now() + 6 * 60 * 60 * 1000), // En 6 horas
        userId: user.id,
        tags: ['urgente', 'proyecto']
      }
    ];
    
    for (const taskData of additionalTasks) {
      await prisma.task.create({
        data: taskData
      });
      totalTasks++;
    }
  }
  
  logger.info(`✅ Total de ${totalTasks} tareas creadas`);
}

async function seedTaskStats() {
  logger.info('📊 Generando estadísticas...');
  
  for (const user of DEMO_USERS) {
    // Calcular estadísticas reales basadas en las tareas creadas
    const tasks = await prisma.task.findMany({
      where: { userId: user.id }
    });
    
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === TaskStatus.COMPLETED).length;
    const pendingTasks = tasks.filter(t => t.status === TaskStatus.PENDING).length;
    const inProgressTasks = tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length;
    
    const now = new Date();
    const overdueTasks = tasks.filter(t => 
      t.dueDate && 
      t.dueDate < now && 
      t.status !== TaskStatus.COMPLETED && 
      t.status !== TaskStatus.CANCELLED
    ).length;
    
    const urgentTasks = tasks.filter(t => t.priority === Priority.URGENT).length;
    const highTasks = tasks.filter(t => t.priority === Priority.HIGH).length;
    const mediumTasks = tasks.filter(t => t.priority === Priority.MEDIUM).length;
    const lowTasks = tasks.filter(t => t.priority === Priority.LOW).length;
    
    await prisma.taskStats.create({
      data: {
        userId: user.id,
        totalTasks,
        completedTasks,
        pendingTasks,
        inProgressTasks,
        overdueTasks,
        urgentTasks,
        highTasks,
        mediumTasks,
        lowTasks
      }
    });
    
    logger.info(`✅ Estadísticas creadas para ${user.name}: ${totalTasks} tareas, ${completedTasks} completadas`);
  }
}

async function generateSummary() {
  logger.info('📋 Resumen de datos creados:');
  
  const totalCategories = await prisma.category.count();
  const totalTasks = await prisma.task.count();
  const totalStats = await prisma.taskStats.count();
  
  const tasksByStatus = await prisma.task.groupBy({
    by: ['status'],
    _count: true
  });
  
  const tasksByPriority = await prisma.task.groupBy({
    by: ['priority'],
    _count: true
  });
  
  logger.info(`
📊 RESUMEN FINAL:
=================
👥 Usuarios: ${DEMO_USERS.length}
🏷️  Categorías: ${totalCategories}
📝 Tareas: ${totalTasks}
📊 Estadísticas: ${totalStats}

📈 TAREAS POR ESTADO:
${tasksByStatus.map(s => `  ${s.status}: ${s._count}`).join('\n')}

🎯 TAREAS POR PRIORIDAD:
${tasksByPriority.map(p => `  ${p.priority}: ${p._count}`).join('\n')}
  `);
}

async function main() {
  try {
    logger.info('🚀 Iniciando seed del Task Service...');
    logger.info('=====================================');
    
    // Limpiar base de datos
    await clearDatabase();
    
    // Crear datos de prueba
    const categories = await seedCategories();
    await seedTasks(categories);
    await seedTaskStats();
    
    // Mostrar resumen
    await generateSummary();
    
    logger.info('🎉 Seed completado exitosamente!');
    
  } catch (error) {
    logger.error('❌ Error durante el seed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar seed si es llamado directamente
if (require.main === module) {
  main()
    .catch((error) => {
      logger.error('❌ Seed falló:', error);
      process.exit(1);
    });
}

export default main; */