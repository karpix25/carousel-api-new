import express from 'express';
import cors from 'cors';
import { marked } from 'marked';
import puppeteer from 'puppeteer';
import { SimpleRenderer } from './simple-renderer';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Parse markdown to slides
function parseMarkdownToSlides(text: string): any[] {
  const tokens = marked.lexer(text);
  const slides: any[] = [];
  
  tokens.forEach((token: any) => {
    if (token.type === 'heading' && token.depth === 1) {
      slides.push({
        type: 'intro',
        title: token.text,
        text: '',
        color: 'default'
      });
    } else if (token.type === 'heading' && token.depth === 2) {
      slides.push({
        type: 'text',
        title: token.text,
        text: '',
        color: 'default'
      });
    } else if (token.type === 'blockquote') {
      const quoteText = token.tokens?.[0]?.text || '';
      slides.push({
        type: 'quote',
        title: '',
        text: quoteText,
        color: 'accent'
      });
    } else if (token.type === 'paragraph') {
      // Add text to the last slide if it exists
      if (slides.length > 0) {
        slides[slides.length - 1].text = token.text;
      } else {
        slides.push({
          type: 'text',
          title: '',
          text: token.text,
          color: 'default'
        });
      }
    }
  });

  if (slides.length === 0) {
    slides.push({
      type: 'text',
      title: 'Default Slide',
      text: text.substring(0, 100),
      color: 'default'
    });
  }

  return slides;
}

// Preview slides (no images)
app.post('/api/preview-slides', (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const slides = parseMarkdownToSlides(text);

    res.json({
      slides,
      metadata: {
        totalSlides: slides.length,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Processing failed' });
  }
});

// Generate carousel with images
app.post('/api/generate-carousel', async (req, res) => {
  console.log('🎨 Starting image generation...');
  
  try {
    const { text, settings = {} } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const slides = parseMarkdownToSlides(text);
    const renderer = new SimpleRenderer();
    
    // Initialize browser
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const images: string[] = [];

    try {
      for (let i = 0; i < slides.length; i++) {
        console.log(`📸 Rendering slide ${i + 1}/${slides.length}`);
        
        const html = renderer.generateSlideHTML(slides[i], i + 1, slides.length);
        
        const page = await browser.newPage();
        await page.setViewport({ width: 1080, height: 1080 });
        await page.setContent(html);
        
        const screenshot = await page.screenshot({
          type: 'png',
          encoding: 'base64'
        });
        
        images.push(screenshot as string);
        await page.close();
      }

      console.log('✅ All images generated successfully');

      res.json({
        slides,
        images,
        metadata: {
          totalSlides: slides.length,
          generatedAt: new Date().toISOString(),
          processingTime: Date.now() - Date.now(),
          settings
        }
      });

    } finally {
      await browser.close();
    }

  } catch (error) {
    console.error('❌ Image generation failed:', error);
    res.status(500).json({ 
      error: 'Image generation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Available styles
app.get('/api/styles', (req, res) => {
  res.json({
    styles: [
      { id: 'default', name: 'Минималистичный', description: 'Чистый дизайн' },
      { id: 'bright', name: 'Яркий', description: 'Динамичный стиль' },
      { id: 'elegant', name: 'Элегантный', description: 'Изысканный дизайн' }
    ]
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Carousel API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      'GET /': 'This endpoint',
      'GET /health': 'Health check',
      'GET /api/styles': 'Available styles',
      'POST /api/preview-slides': 'Preview slides structure',
      'POST /api/generate-carousel': 'Generate carousel WITH IMAGES! 🖼️'
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Carousel API running on port ${PORT}`);
  console.log(`📚 API docs: http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`🖼️ Image generation: POST /api/generate-carousel`);
});

export default app;
