import { jest } from '@jest/globals';

// Mock para logger
export const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  child: jest.fn().mockReturnThis()
};

// Mock para Redis
export const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  flushdb: jest.fn(),
  quit: jest.fn(),
  connect: jest.fn(),
  ping: jest.fn().mockResolvedValue('PONG')
};

// Mock para Prisma
export const mockPrismaUser = {
  create: jest.fn(),
  findFirst: jest.fn(),
  findUnique: jest.fn(),
  findMany: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn()
};

export const mockPrisma = {
  user: mockPrismaUser,
  refreshToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn()
  },
  userSession: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn()
  },
  loginAttempt: {
    create: jest.fn(),
    count: jest.fn(),
    deleteMany: jest.fn()
  },
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  $transaction: jest.fn()
};

// Mock para crypto functions
export const mockCrypto = {
  hashPassword: jest.fn().mockResolvedValue('hashed-password'),
  verifyPassword: jest.fn().mockResolvedValue(true),
  generateSecureToken: jest.fn().mockReturnValue('secure-token'),
  generateSessionId: jest.fn().mockReturnValue('session-id')
};

// Factory para crear mocks de Request/Response de Express
export const createMockReq = (overrides = {}) => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  ip: '127.0.0.1',
  get: jest.fn(),
  ...overrides
});

export const createMockRes = () => {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
    header: jest.fn().mockReturnThis(),
    locals: {}
  };
  return res;
};

export const createMockNext = () => jest.fn();

// Helper para limpiar todos los mocks
export const clearAllMocks = () => {
  jest.clearAllMocks();
  
  // Limpiar mocks específicos
  Object.values(mockLogger).forEach(mock => mock.mockClear());
  Object.values(mockRedis).forEach(mock => mock.mockClear());
  Object.values(mockPrismaUser).forEach(mock => mock.mockClear());
  Object.values(mockCrypto).forEach(mock => mock.mockClear());
};