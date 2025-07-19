import puppeteer, { Browser, Page } from 'puppeteer';
import { marked } from 'marked';
import { readFileSync } from 'fs';
import { join } from 'path';
import { SlideData, SettingsType } from '../api/schemas/carousel.schema';
import { PatternGenerator } from '../core/patternGenerator';
import { ColorSystem } from '../core/colorSystem';
import { logger } from '../utils/logger';
import { RenderError } from '../api/middleware/errorHandler';

export class PuppeteerRenderer {
  private browser: Browser | null = null;
  private baseTemplate: string;

  constructor() {
    // Load base template
    this.baseTemplate = readFileSync(
      join(__dirname, 'templates', 'BaseSlide.html'),
      'utf-8'
    );
  }

  /**
   * Initialize browser instance
   */
  private async initBrowser(): Promise<Browser> {
    if (this.browser) {
      return this.browser;
    }

    try {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
        ],
        defaultViewport: {
          width: 1080,
          height: 1080,
          deviceScaleFactor: 4, // 4x for high quality
        },
      });

      logger.info('Browser initialized successfully');
      return this.browser;

    } catch (error) {
      logger.error('Failed to initialize browser:', error);
      throw new RenderError('Failed to initialize rendering engine');
    }
  }

  /**
   * Render slides to PNG images
   */
  public async renderSlides(slides: SlideData[], settings: SettingsType): Promise<string[]> {
    const browser = await this.initBrowser();
    const images: string[] = [];

    try {
      // Generate CSS variables
      const cssVariables = ColorSystem.generateCSSVariables(
        settings.brandColor || '#2F00FF',
        settings.style || 'default',
        settings.authorUsername || '@username',
        settings.authorFullName || 'Full Name'
      );

      for (let i = 0; i < slides.length; i++) {
        logger.debug(`Rendering slide ${i + 1}/${slides.length}`);
        
        const slide = slides[i];
        const html = this.generateSlideHTML(slide, i + 1, slides.length, settings, cssVariables);
        
        const image = await this.renderHTML(browser, html);
        images.push(image);
      }

      logger.info(`Successfully rendered ${images.length} slides`);
      return images;

    } catch (error) {
      logger.error('Failed to render slides:', error);
      throw new RenderError(`Failed to render slides: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate HTML for a single slide
   */
  private generateSlideHTML(
    slide: SlideData,
    slideNumber: number,
    totalSlides: number,
    settings: SettingsType,
    cssVariables: Record<string, string>
  ): string {
    const style = settings.style || 'default';
    
    // Generate patterns if needed
    const showShapeOne = (slide.type === 'intro' || slide.type === 'quote') && slide.showAbstraction !== false;
    const showShapeTwo = (slide.type === 'intro' || slide.type === 'quote') && 
                         style === 'bright' && slide.showAbstraction !== false;
    
    const shapeOne = showShapeOne ? PatternGenerator.generatePattern(style) : '';
    const shapeTwo = showShapeTwo ? PatternGenerator.generatePattern(style) : '';

    // Generate content based on slide type
    const content = this.generateSlideContent(slide);

    // Create template variables
    const templateVars = {
      colorClass: `color--${slide.color}`,
      styleClass: `style--${style}`,
      cssVariables: Object.entries(cssVariables)
        .map(([key, value]) => `${key}: ${value}`)
        .join('; '),
      slideType: slide.type,
      slideNumber,
      totalSlides,
      showShapeOne,
      showShapeTwo,
      shapeOne,
      shapeTwo,
      content,
      showArrow: slideNumber < totalSlides,
    };

    // Replace template variables
    return this.replaceTemplateVariables(this.baseTemplate, templateVars);
  }

  /**
   * Generate content HTML based on slide type
   */
  private generateSlideContent(slide: SlideData): string {
    switch (slide.type) {
      case 'intro':
        const title = slide.title ? `<h1>${marked.parseInline(slide.title)}</h1>` : '';
        const text = slide.text ? `<p>${marked.parseInline(slide.text)}</p>` : '';
        return title + text;

      case 'text':
        const h2Title = slide.title ? `<h2>${marked.parseInline(slide.title)}</h2>` : '';
        const content = slide.text ? marked(slide.text) : '';
        return h2Title + content;

      case 'quote':
        const quoteClass = slide.size ? `quote--${slide.size}` : 'quote--large';
        const quoteText = slide.text ? marked(slide.text) : '';
        return `<div class="quote-content ${quoteClass}">${quoteText}</div>`;

      default:
        return '<p>Invalid slide type</p>';
    }
  }

  /**
   * Replace template variables in HTML
   */
  private replaceTemplateVariables(template: string, vars: Record<string, any>): string {
    let html = template;

    // Replace simple variables
    Object.entries(vars).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, String(value));
    });

    // Handle conditional blocks
    html = html.replace(/{{#if (\w+)}}([\s\S]*?){{\/if}}/g, (match, condition, content) => {
      return vars[condition] ? content : '';
    });

    return html;
  }

  /**
   * Render HTML to PNG image
   */
  private async renderHTML(browser: Browser, html: string): Promise<string> {
    const page = await browser.newPage();

    try {
      await page.setViewport({
        width: 1080,
        height: 1080,
        deviceScaleFactor: 4,
      });

      await page.setContent(html, {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });

      // Wait for fonts to load
      await page.evaluate(() => {
        return document.fonts.ready;
      });

      // Additional wait for rendering
      await page.waitForTimeout(500);

      const screenshot = await page.screenshot({
        type: 'png',
        fullPage: false,
        omitBackground: false,
        encoding: 'base64',
      });

      return screenshot as string;

    } finally {
      await page.close();
    }
  }

  /**
   * Health check for renderer
   */
  public async healthCheck(): Promise<boolean> {
    try {
      const browser = await this.initBrowser();
      const page = await browser.newPage();
      await page.setContent('<html><body><h1>Test</h1></body></html>');
      await page.close();
      return true;
    } catch (error) {
      logger.error('Renderer health check failed:', error);
      return false;
    }
  }

  /**
   * Cleanup browser instance
   */
  public async cleanup(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
        this.browser = null;
        logger.debug('Browser cleaned up successfully');
      } catch (error) {
        logger.error('Failed to cleanup browser:', error);
      }
    }
  }
}