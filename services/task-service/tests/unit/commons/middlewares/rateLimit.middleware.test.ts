// ==============================================
// __tests__/presentation/middlewares/rateLimit.middleware.test.ts
// Tests unitarios completos para el middleware de rate limiting
// ==============================================

import { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';
import {
  createRateLimiter,
  TaskServiceRedisRateLimitStore,
  generalRateLimit,
  authRateLimit,
  createTaskRateLimit,
} from '@/presentation/middlewares/rateLimit.middleware';
import { taskRedisConnection } from '@/config/redis';
import { config } from '@/config/environment';
import { logger } from '@/utils/logger';
import {
  HTTP_STATUS,
  ERROR_CODES,
  ERROR_MESSAGES,
  EVENT_TYPES,
} from '@/utils/constants';

// ==============================================
// MOCKS
// ==============================================

// Mock del Redis connection
jest.mock('@/config/redis', () => ({
  taskRedisConnection: {
    getClient: jest.fn(),
    isHealthy: jest.fn(),
  },
}));

// Mock del logger
jest.mock('@/utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
  },
}));

// Mock de la configuración
jest.mock('@/config/environment', () => ({
  config: {
    app: {
      isDevelopment: true,
    },
    rateLimit: {
      enabled: true,
      windowMs: 900000,
      maxRequests: 100,
      auth: { max: 20, windowMs: 900000 },
      createTask: { max: 10, windowMs: 60000 },
    },
  },
}));

// ==============================================
// SETUP Y HELPERS
// ==============================================

describe('Rate Limit Middleware', () => {
  let mockRedis: jest.Mocked<Redis>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonSpy: jest.SpyInstance;
  let statusSpy: jest.SpyInstance;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock Redis client
    mockRedis = {
      pipeline: jest.fn().mockReturnValue({
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        ttl: jest.fn().mockReturnThis(),
        exec: jest.fn(),
      }),
      incr: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      decr: jest.fn(),
      setex: jest.fn(),
      keys: jest.fn(),
      multi: jest.fn().mockReturnValue({
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn(),
      }),
    } as any;

    (taskRedisConnection.getClient as jest.Mock).mockReturnValue(mockRedis);
    (taskRedisConnection.isHealthy as jest.Mock).mockReturnValue(true);

    // Mock request/response
    mockReq = {
      ip: '192.168.1.1',
      path: '/api/v1/tasks',
      method: 'GET',
      get: jest.fn().mockReturnValue('Test-Agent/1.0'),
    };

    jsonSpy = jest.fn();
    statusSpy = jest.fn().mockReturnValue({ json: jsonSpy });

    mockRes = {
      status: statusSpy,
      set: jest.fn(),
    };

    mockNext = jest.fn();
  });

  // ==============================================
  // TESTS DE REDIS STORE
  // ==============================================

  describe('TaskServiceRedisRateLimitStore', () => {
    let store: TaskServiceRedisRateLimitStore;

    beforeEach(() => {
      store = new TaskServiceRedisRateLimitStore(60000);
    });

    describe('increment', () => {
      it('should increment counter and return correct result', async () => {
        // Arrange
        const key = 'test-key';
        const expectedHits = 5;
        
        mockRedis.pipeline().exec.mockResolvedValue([
          [null, expectedHits],
          [null, 'OK'],
          [null, 55],
        ]);

        // Act
        const result = await store.increment(key);

        // Assert
        expect(result.totalHits).toBe(expectedHits);
        expect(result.timeToExpire).toBe(55000);
        expect(result.resetTime).toBeInstanceOf(Date);
        expect(mockRedis.pipeline).toHaveBeenCalled();
      });

      it('should handle Redis errors gracefully', async () => {
        // Arrange
        const key = 'test-key';
        mockRedis.pipeline().exec.mockRejectedValue(new Error('Redis error'));

        // Act
        const result = await store.increment(key);

        // Assert
        expect(result.totalHits).toBe(1); // Fallback value
        expect(logger.error).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.any(Error),
            key,
            event: EVENT_TYPES.CACHE_ERROR,
          }),
          'Failed to increment rate limit counter'
        );
      });

      it('should handle unhealthy Redis connection', async () => {
        // Arrange
        const key = 'test-key';
        (taskRedisConnection.isHealthy as jest.Mock).mockReturnValue(false);

        // Act
        const result = await store.increment(key);

        // Assert
        expect(result.totalHits).toBe(1); // Fallback value
        expect(logger.warn).toHaveBeenCalledWith(
          expect.objectContaining({
            event: EVENT_TYPES.CACHE_ERROR,
            component: 'rate_limit_store',
            key,
          }),
          'Redis not healthy, allowing request'
        );
      });
    });

    describe('decrement', () => {
      it('should decrement counter when value exists', async () => {
        // Arrange
        const key = 'test-key';
        mockRedis.get.mockResolvedValue('5');
        mockRedis.decr.mockResolvedValue(4);

        // Act
        await store.decrement(key);

        // Assert
        expect(mockRedis.get).toHaveBeenCalledWith('rate_limit:test-key');
        expect(mockRedis.decr).toHaveBeenCalledWith('rate_limit:test-key');
        expect(logger.debug).toHaveBeenCalledWith(
          expect.objectContaining({
            event: EVENT_TYPES.CACHE_HIT,
            component: 'rate_limit_store',
            key,
          }),
          'Rate limit decremented'
        );
      });

      it('should not decrement when value is 0', async () => {
        // Arrange
        const key = 'test-key';
        mockRedis.get.mockResolvedValue('0');

        // Act
        await store.decrement(key);

        // Assert
        expect(mockRedis.decr).not.toHaveBeenCalled();
      });

      it('should handle Redis errors gracefully', async () => {
        // Arrange
        const key = 'test-key';
        mockRedis.get.mockRejectedValue(new Error('Redis error'));

        // Act
        await store.decrement(key);

        // Assert
        expect(logger.error).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.any(Error),
            key,
            event: EVENT_TYPES.CACHE_ERROR,
          }),
          'Failed to decrement rate limit counter'
        );
      });
    });

    describe('resetKey', () => {
      it('should reset key successfully', async () => {
        // Arrange
        const key = 'test-key';
        mockRedis.del.mockResolvedValue(1);

        // Act
        await store.resetKey(key);

        // Assert
        expect(mockRedis.del).toHaveBeenCalledWith('rate_limit:test-key');
        expect(logger.debug).toHaveBeenCalledWith(
          expect.objectContaining({
            event: EVENT_TYPES.CACHE_MISS,
            component: 'rate_limit_store',
            key,
          }),
          'Rate limit key reset'
        );
      });
    });

    describe('getStatus', () => {
      it('should return current status', async () => {
        // Arrange
        const key = 'test-key';
        mockRedis.pipeline().exec.mockResolvedValue([
          [null, '5'],
          [null, 55],
        ]);

        // Act
        const result = await store.getStatus(key);

        // Assert
        expect(result).toEqual({
          count: 5,
          ttl: 55,
        });
      });

      it('should return null on Redis error', async () => {
        // Arrange
        const key = 'test-key';
        mockRedis.pipeline().exec.mockRejectedValue(new Error('Redis error'));

        // Act
        const result = await store.getStatus(key);

        // Assert
        expect(result).toBeNull();
      });
    });
  });

  // ==============================================
  // TESTS DE FACTORY FUNCTION
  // ==============================================

  describe('createRateLimiter', () => {
    it('should create rate limiter with default options', () => {
      // Act
      const rateLimiter = createRateLimiter();

      // Assert
      expect(rateLimiter).toBeDefined();
      expect(typeof rateLimiter).toBe('function');
    });

    it('should create rate limiter with custom options', () => {
      // Arrange
      const options = {
        windowMs: 60000,
        max: 50,
        message: 'Custom message',
        keyGenerator: (req: Request) => 'custom-key',
      };

      // Act
      const rateLimiter = createRateLimiter(options);

      // Assert
      expect(rateLimiter).toBeDefined();
      expect(typeof rateLimiter).toBe('function');
    });
  });

  // ==============================================
  // TESTS DE RATE LIMITERS ESPECÍFICOS
  // ==============================================

  describe('Specific Rate Limiters', () => {
    describe('generalRateLimit', () => {
      it('should be properly configured', () => {
        expect(generalRateLimit).toBeDefined();
        expect(typeof generalRateLimit).toBe('function');
      });
    });

    describe('authRateLimit', () => {
      it('should be properly configured', () => {
        expect(authRateLimit).toBeDefined();
        expect(typeof authRateLimit).toBe('function');
      });
    });

    describe('createTaskRateLimit', () => {
      it('should be properly configured', () => {
        expect(createTaskRateLimit).toBeDefined();
        expect(typeof createTaskRateLimit).toBe('function');
      });
    });
  });

  // ==============================================
  // TESTS DE INTEGRACIÓN
  // ==============================================

  describe('Integration Tests', () => {
    let rateLimiter: any;

    beforeEach(() => {
      rateLimiter = createRateLimiter({
        windowMs: 60000,
        max: 5,
        enableRedisStore: true,
      });
    });

    it('should allow requests under limit', async () => {
      // Arrange
      mockRedis.pipeline().exec.mockResolvedValue([
        [null, 3], // current count
        [null, 'OK'], // expire result
        [null, 57], // ttl
      ]);

      // Act
      await new Promise<void>((resolve) => {
        mockNext.mockImplementation(() => resolve());
        rateLimiter(mockReq as Request, mockRes as Response, mockNext);
      });

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should block requests over limit', async () => {
      // Arrange
      mockRedis.pipeline().exec.mockResolvedValue([
        [null, 6], // current count (over limit of 5)
        [null, 'OK'], // expire result
        [null, 57], // ttl
      ]);

      // Act
      await new Promise<void>((resolve) => {
        jsonSpy.mockImplementation(() => resolve());
        rateLimiter(mockReq as Request, mockRes as Response, mockNext);
      });

      // Assert
      expect(mockNext).not.toHaveBeenCalled();
      expect(statusSpy).toHaveBeenCalledWith(HTTP_STATUS.TOO_MANY_REQUESTS);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
          error: {
            code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
            details: expect.any(Object),
          },
        })
      );
    });

    it('should handle Redis store errors gracefully', async () => {
      // Arrange
      mockRedis.pipeline().exec.mockRejectedValue(new Error('Redis error'));

      // Act
      await new Promise<void>((resolve) => {
        mockNext.mockImplementation(() => resolve());
        rateLimiter(mockReq as Request, mockRes as Response, mockNext);
      });

      // Assert
      expect(mockNext).toHaveBeenCalled(); // Should allow through on Redis error
      expect(logger.error).toHaveBeenCalled();
    });

    it('should use custom key generator', async () => {
      // Arrange
      const customKeyGenerator = jest.fn().mockReturnValue('custom-key');
      const customRateLimiter = createRateLimiter({
        windowMs: 60000,
        max: 5,
        keyGenerator: customKeyGenerator,
      });

      mockRedis.pipeline().exec.mockResolvedValue([
        [null, 1],
        [null, 'OK'],
        [null, 59],
      ]);

      // Act
      await new Promise<void>((resolve) => {
        mockNext.mockImplementation(() => resolve());
        customRateLimiter(mockReq as Request, mockRes as Response, mockNext);
      });

      // Assert
      expect(customKeyGenerator).toHaveBeenCalledWith(mockReq);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  // ==============================================
  // TESTS DE LOGGING Y MONITOREO
  // ==============================================

  describe('Logging and Monitoring', () => {
    it('should log rate limit exceeded events', async () => {
      // Arrange
      const rateLimiter = createRateLimiter({
        windowMs: 60000,
        max: 1,
      });

      mockRedis.pipeline().exec.mockResolvedValue([
        [null, 2], // over limit
        [null, 'OK'],
        [null, 57],
      ]);

      // Act
      await new Promise<void>((resolve) => {
        jsonSpy.mockImplementation(() => resolve());
        rateLimiter(mockReq as Request, mockRes as Response, mockNext);
      });

      // Assert
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: EVENT_TYPES.RATE_LIMIT_EXCEEDED,
          component: 'rate_limit_middleware',
          ip: mockReq.ip,
          path: mockReq.path,
          method: mockReq.method,
        }),
        'Rate limit exceeded'
      );
    });

    it('should enrich request with rate limit info', async () => {
      // Arrange
      const rateLimiter = createRateLimiter({
        windowMs: 60000,
        max: 10,
      });

      mockRedis.pipeline().exec.mockResolvedValue([
        [null, 3],
        [null, 'OK'],
        [null, 57],
      ]);

      // Act
      await new Promise<void>((resolve) => {
        mockNext.mockImplementation(() => resolve());
        rateLimiter(mockReq as Request, mockRes as Response, mockNext);
      });

      // Assert
      expect(mockRes.set).toHaveBeenCalledWith({
        'X-RateLimit-Limit': '10',
        'X-RateLimit-Remaining': '7',
        'X-RateLimit-Reset': expect.any(String),
      });
    });
  });

  // ==============================================
  // TESTS DE EDGE CASES
  // ==============================================

  describe('Edge Cases', () => {
    it('should handle missing IP address', async () => {
      // Arrange
      const rateLimiter = createRateLimiter();
      mockReq.ip = undefined;

      mockRedis.pipeline().exec.mockResolvedValue([
        [null, 1],
        [null, 'OK'],
        [null, 59],
      ]);

      // Act
      await new Promise<void>((resolve) => {
        mockNext.mockImplementation(() => resolve());
        rateLimiter(mockReq as Request, mockRes as Response, mockNext);
      });

      // Assert
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle Redis connection loss during operation', async () => {
      // Arrange
      const rateLimiter = createRateLimiter();
      
      // First call: Redis is healthy
      (taskRedisConnection.isHealthy as jest.Mock).mockReturnValueOnce(true);
      // Second call: Redis becomes unhealthy
      (taskRedisConnection.isHealthy as jest.Mock).mockReturnValueOnce(false);

      mockRedis.pipeline().exec.mockRejectedValue(new Error('Connection lost'));

      // Act
      await new Promise<void>((resolve) => {
        mockNext.mockImplementation(() => resolve());
        rateLimiter(mockReq as Request, mockRes as Response, mockNext);
      });

      // Assert
      expect(mockNext).toHaveBeenCalled(); // Should allow through
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle malformed Redis responses', async () => {
      // Arrange
      const rateLimiter = createRateLimiter();
      
      // Return malformed response
      mockRedis.pipeline().exec.mockResolvedValue([
        ['Error occurred'], // Error in first result
        [null, 'OK'],
        [null, 59],
      ]);

      // Act
      await new Promise<void>((resolve) => {
        mockNext.mockImplementation(() => resolve());
        rateLimiter(mockReq as Request, mockRes as Response, mockNext);
      });

      // Assert
      expect(mockNext).toHaveBeenCalled(); // Should allow through on error
    });
  });

  // ==============================================
  // TESTS DE PERFORMANCE
  // ==============================================

  describe('Performance Tests', () => {
    it('should handle high concurrency', async () => {
      // Arrange
      const rateLimiter = createRateLimiter({
        windowMs: 60000,
        max: 100,
      });

      mockRedis.pipeline().exec.mockResolvedValue([
        [null, 50],
        [null, 'OK'],
        [null, 55],
      ]);

      // Act
      const promises = Array.from({ length: 50 }, () => 
        new Promise<void>((resolve) => {
          mockNext.mockImplementation(() => resolve());
          rateLimiter(mockReq as Request, mockRes as Response, mockNext);
        })
      );

      await Promise.all(promises);

      // Assert
      expect(mockNext).toHaveBeenCalledTimes(50);
    });

    it('should not block event loop', async () => {
      // Arrange
      const rateLimiter = createRateLimiter();
      
      // Simulate slow Redis response
      mockRedis.pipeline().exec.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve([[null, 1], [null, 'OK'], [null, 59]]), 100)
        )
      );

      const startTime = Date.now();

      // Act
      await new Promise<void>((resolve) => {
        mockNext.mockImplementation(() => resolve());
        rateLimiter(mockReq as Request, mockRes as Response, mockNext);
      });

      const endTime = Date.now();

      // Assert
      expect(endTime - startTime).toBeLessThan(200); // Should complete reasonably fast
      expect(mockNext).toHaveBeenCalled();
    });
  });
});