import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { logger } from '../../utils/logger';

interface ValidatedRequest<T> extends Request {
  validatedBody: T;
}

export const validateBody = <T>(schema: ZodSchema<T>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = schema.parse(req.body);
      (req as ValidatedRequest<T>).validatedBody = validatedData;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Validation error:', {
          errors: error.errors,
          body: req.body,
          path: req.path,
        });
      }
      next(error);
    }
  };
};

export const validateQuery = <T>(schema: ZodSchema<T>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = schema.parse(req.query);
      req.query = validatedData as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Query validation error:', {
          errors: error.errors,
          query: req.query,
          path: req.path,
        });
      }
      next(error);
    }
  };
};

// Rate limiting middleware
export const rateLimiter = (maxRequests: number = 10, windowMs: number = 60000) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const clientId = req.ip || 'unknown';
    const now = Date.now();
    
    const clientRequests = requests.get(clientId);
    
    if (!clientRequests || now > clientRequests.resetTime) {
      requests.set(clientId, { count: 1, resetTime: now + windowMs });
      next();
    } else if (clientRequests.count < maxRequests) {
      clientRequests.count++;
      next();
    } else {
      logger.warn('Rate limit exceeded:', {
        clientId,
        count: clientRequests.count,
        maxRequests,
      });
      
      res.status(429).json({
        error: {
          message: 'Too many requests',
          statusCode: 429,
          retryAfter: Math.ceil((clientRequests.resetTime - now) / 1000),
        },
      });
    }
  };
};

// Request size limiter
export const sizeLimit = (maxSizeBytes: number = 10 * 1024 * 1024) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.get('content-length') || '0', 10);
    
    if (contentLength > maxSizeBytes) {
      logger.warn('Request size limit exceeded:', {
        contentLength,
        maxSizeBytes,
        path: req.path,
      });
      
      return res.status(413).json({
        error: {
          message: 'Request entity too large',
          statusCode: 413,
          maxSize: maxSizeBytes,
        },
      });
    }
    
    next();
  };
};