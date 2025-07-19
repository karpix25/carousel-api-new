import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../../utils/logger';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

export const errorHandler = (
  error: ApiError | ZodError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let details: any = undefined;

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    statusCode = 400;
    message = 'Validation Error';
    details = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
    }));
  }
  // Handle custom API errors
  else if (error.statusCode) {
    statusCode = error.statusCode;
    message = error.message;
  }
  // Handle specific error types
  else if (error.message.includes('ENOENT')) {
    statusCode = 404;
    message = 'Resource not found';
  }
  else if (error.message.includes('timeout')) {
    statusCode = 408;
    message = 'Request timeout';
  }
  else if (error.message.includes('ECONNREFUSED')) {
    statusCode = 503;
    message = 'Service unavailable';
  }

  // Log error details
  logger.error('API Error:', {
    statusCode,
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Send error response
  res.status(statusCode).json({
    error: {
      message,
      statusCode,
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
      ...(details && { details }),
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    },
  });
};

// Custom error classes
export class ValidationError extends Error {
  statusCode = 400;
  
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  statusCode = 404;
  
  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class RenderError extends Error {
  statusCode = 500;
  
  constructor(message: string = 'Failed to render carousel') {
    super(message);
    this.name = 'RenderError';
  }
}

export class TextProcessingError extends Error {
  statusCode = 422;
  
  constructor(message: string = 'Failed to process text') {
    super(message);
    this.name = 'TextProcessingError';
  }
}