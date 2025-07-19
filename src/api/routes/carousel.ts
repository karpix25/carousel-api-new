import { Router, Request, Response } from 'express';
import { 
  GenerateCarouselSchema, 
  GenerateCarouselRequest,
  AVAILABLE_STYLES,
} from '../schemas/carousel.schema';
import { validateBody, rateLimiter, sizeLimit } from '../middleware/validation';
import { TextSplitter } from '../../core/textSplitter';
import { PuppeteerRenderer } from '../../renderer/puppeteerRenderer';
import { logger } from '../../utils/logger';

export const carouselRouter = Router();

interface ValidatedRequest extends Request {
  validatedBody: GenerateCarouselRequest;
}

// Rate limiting: 10 requests per minute
carouselRouter.use(rateLimiter(10, 60 * 1000));

// Size limiting: 10MB max
carouselRouter.use(sizeLimit(10 * 1024 * 1024));

/**
 * GET /api/styles - Get available styles
 */
carouselRouter.get('/styles', (req: Request, res: Response) => {
  res.json({
    styles: AVAILABLE_STYLES,
    count: AVAILABLE_STYLES.length,
  });
});

/**
 * POST /api/generate-carousel - Generate carousel from markdown
 */
carouselRouter.post(
  '/generate-carousel',
  validateBody(GenerateCarouselSchema),
  async (req: ValidatedRequest, res: Response) => {
    const startTime = Date.now();
    
    try {
      const { text, settings } = req.validatedBody;
      
      logger.info('Starting carousel generation', {
        textLength: text.length,
        settings,
        ip: req.ip,
      });

      // 1. Split text into slides
      const textSplitter = new TextSplitter(text);
      const slides = textSplitter.generateSlides(settings?.maxSlides);
      
      if (slides.length === 0) {
        return res.status(400).json({
          error: {
            message: 'No slides could be generated from the provided text',
            statusCode: 400,
          },
        });
      }

      logger.info('Generated slides', {
        slideCount: slides.length,
        slideTypes: slides.map(s => s.type),
      });

      // 2. Render slides to images
      const renderer = new PuppeteerRenderer();
      
      try {
        const images = await renderer.renderSlides(slides, settings || {});
        
        const processingTime = Date.now() - startTime;
        
        logger.info('Carousel generation completed', {
          slideCount: slides.length,
          processingTime,
          success: true,
        });

        // 3. Return response
        res.json({
          slides,
          images,
          metadata: {
            totalSlides: slides.length,
            generatedAt: new Date().toISOString(),
            processingTime,
            settings: settings || {},
          },
        });

      } finally {
        await renderer.cleanup();
      }

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('Carousel generation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        processingTime,
        ip: req.ip,
      });

      if (error instanceof Error && error.message.includes('timeout')) {
        return res.status(408).json({
          error: {
            message: 'Request timeout - text too complex or server overloaded',
            statusCode: 408,
          },
        });
      }

      throw error; // Let error handler handle it
    }
  }
);

/**
 * POST /api/preview-slides - Preview slides without rendering images
 */
carouselRouter.post(
  '/preview-slides',
  validateBody(GenerateCarouselSchema),
  async (req: ValidatedRequest, res: Response) => {
    try {
      const { text, settings } = req.validatedBody;
      
      logger.info('Generating slide preview', {
        textLength: text.length,
        maxSlides: settings?.maxSlides,
      });

      const textSplitter = new TextSplitter(text);
      const slides = textSplitter.generateSlides(settings?.maxSlides);
      const stats = textSplitter.getStats();

      res.json({
        slides,
        stats,
        metadata: {
          totalSlides: slides.length,
          generatedAt: new Date().toISOString(),
          settings: settings || {},
        },
      });

    } catch (error) {
      logger.error('Slide preview failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip: req.ip,
      });
      
      throw error;
    }
  }
);

/**
 * GET /api/test-pattern/:style - Test pattern generation
 */
carouselRouter.get('/test-pattern/:style', (req: Request, res: Response) => {
  const { style } = req.params;
  
  if (!['default', 'bright', 'elegant'].includes(style)) {
    return res.status(400).json({
      error: {
        message: 'Invalid style. Must be one of: default, bright, elegant',
        statusCode: 400,
      },
    });
  }

  try {
    const { PatternGenerator } = require('../../core/patternGenerator');
    const patterns = PatternGenerator.generateMultiplePatterns(style as any, 3);
    
    res.json({
      style,
      patterns,
      count: patterns.length,
    });
    
  } catch (error) {
    logger.error('Pattern generation failed', {
      style,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    throw error;
  }
});

/**
 * GET /api/health - Extended health check with system info
 */
carouselRouter.get('/health-detailed', async (req: Request, res: Response) => {
  try {
    // Test text processing
    const testText = '# Test\n\nThis is a test.';
    const textSplitter = new TextSplitter(testText);
    const slides = textSplitter.generateSlides(3);
    
    // Test renderer initialization (without actual rendering)
    const renderer = new PuppeteerRenderer();
    const rendererHealthy = await renderer.healthCheck();
    await renderer.cleanup();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  