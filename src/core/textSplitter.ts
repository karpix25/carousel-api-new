import { marked } from 'marked';
import { SlideData, SlideType, ColorType } from '../api/schemas/carousel.schema';
import { logger } from '../utils/logger';

interface MarkdownBlock {
  type: 'heading' | 'paragraph' | 'quote' | 'list';
  level?: number; // for headings
  content: string;
  raw: string;
}

export class TextSplitter {
  private blocks: MarkdownBlock[] = [];

  constructor(private text: string) {
    this.parseMarkdown();
  }

  /**
   * Parse markdown text into structured blocks
   */
  private parseMarkdown(): void {
    const tokens = marked.lexer(this.text);
    
    tokens.forEach(token => {
      switch (token.type) {
        case 'heading':
          this.blocks.push({
            type: 'heading',
            level: token.depth,
            content: token.text,
            raw: token.raw,
          });
          break;
          
        case 'paragraph':
          this.blocks.push({
            type: 'paragraph',
            content: token.text,
            raw: token.raw,
          });
          break;
          
        case 'blockquote':
          // Extract text from blockquote tokens
          const quoteText = this.extractBlockquoteText(token);
          this.blocks.push({
            type: 'quote',
            content: quoteText,
            raw: token.raw,
          });
          break;
          
        case 'list':
          const listText = this.extractListText(token);
          this.blocks.push({
            type: 'list',
            content: listText,
            raw: token.raw,
          });
          break;
      }
    });
    
    logger.debug('Parsed markdown blocks:', { count: this.blocks.length });
  }

  /**
   * Extract text from blockquote token
   */
  private extractBlockquoteText(token: any): string {
    if (token.tokens) {
      return token.tokens
        .filter((t: any) => t.type === 'paragraph')
        .map((t: any) => t.text)
        .join('\n\n');
    }
    return token.text || '';
  }

  /**
   * Extract text from list token
   */
  private extractListText(token: any): string {
    if (token.items) {
      const listItems = token.items.map((item: any) => {
        if (item.tokens) {
          return item.tokens
            .filter((t: any) => t.type === 'text' || t.type === 'paragraph')
            .map((t: any) => t.text || t.raw)
            .join(' ');
        }
        return item.text || '';
      });
      
      return listItems.join('\n• ');
    }
    return '';
  }

  /**
   * Generate slides from parsed blocks
   */
  public generateSlides(maxSlides: number | 'auto' = 'auto'): SlideData[] {
    if (this.blocks.length === 0) {
      return this.createDefaultSlide();
    }

    const slides: SlideData[] = [];
    const targetSlideCount = this.calculateOptimalSlideCount(maxSlides);
    
    // First pass: identify main structure
    const h1Blocks = this.blocks.filter(b => b.type === 'heading' && b.level === 1);
    const hasMainTitle = h1Blocks.length > 0;

    if (hasMainTitle) {
      // Create intro slide from first H1
      const introSlide = this.createIntroSlide(h1Blocks[0]);
      slides.push(introSlide);
    }

    // Group remaining content into slides
    const remainingBlocks = hasMainTitle ? 
      this.blocks.slice(this.blocks.indexOf(h1Blocks[0]) + 1) : 
      this.blocks;

    const contentSlides = this.groupIntoSlides(remainingBlocks, targetSlideCount - (hasMainTitle ? 1 : 0));
    slides.push(...contentSlides);

    // Ensure we have at least one slide
    if (slides.length === 0) {
      slides.push(this.createDefaultSlide());
    }

    logger.info('Generated slides:', { 
      total: slides.length, 
      types: slides.map(s => s.type),
      targetCount: targetSlideCount,
    });

    return slides;
  }

  /**
   * Calculate optimal number of slides
   */
  private calculateOptimalSlideCount(maxSlides: number | 'auto'): number {
    if (typeof maxSlides === 'number') {
      return maxSlides;
    }

    // Calculate based on content length and complexity
    const totalWords = this.text.split(/\s+/).length;
    const avgWordsPerSlide = 50;
    const calculated = Math.ceil(totalWords / avgWordsPerSlide);
    
    // Adjust based on structure
    const headingCount = this.blocks.filter(b => b.type === 'heading').length;
    const quoteCount = this.blocks.filter(b => b.type === 'quote').length;
    
    const structureBonus = Math.min(headingCount + quoteCount, 3);
    const finalCount = Math.max(3, Math.min(calculated + structureBonus, 15));
    
    logger.debug('Calculated slide count:', {
      totalWords,
      headingCount,
      quoteCount,
      calculated,
      final: finalCount,
    });

    return finalCount;
  }

  /**
   * Group blocks into slides
   */
  private groupIntoSlides(blocks: MarkdownBlock[], targetCount: number): SlideData[] {
    const slides: SlideData[] = [];
    
    if (blocks.length === 0) {
      return slides;
    }

    // Strategy 1: Each H2 becomes a slide
    const h2Blocks = blocks.filter(b => b.type === 'heading' && b.level === 2);
    
    if (h2Blocks.length > 0 && h2Blocks.length <= targetCount) {
      h2Blocks.forEach(h2Block => {
        const h2Index = blocks.indexOf(h2Block);
        const nextH2Index = blocks.findIndex((b, i) => 
          i > h2Index && b.type === 'heading' && b.level === 2
        );
        
        const endIndex = nextH2Index === -1 ? blocks.length : nextH2Index;
        const slideBlocks = blocks.slice(h2Index, endIndex);