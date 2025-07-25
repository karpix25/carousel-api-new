console.log('🎯 ФИНАЛЬНАЯ ПРОДАКШН ВЕРСИЯ - Canvas API');

const express = require('express');
const { marked } = require('marked');
const { createCanvas } = require('canvas');

const app = express();
app.use(express.json({ limit: '10mb' }));

// Конфигурация с правильным масштабированием ×4 от веб-версии
const CONFIG = {
  CANVAS: {
    WIDTH: 1600,
    HEIGHT: 2000,
    PADDING: 144, // 36px × 4 = 144px (боковые отступы)
    BORDER_RADIUS: 64,
    HEADER_FOOTER_PADDING: 192, // 48px × 4 = 192px (верх/низ)
    CONTENT_GAP: 144, // 36px × 4 = 144px (gap между header и content)
    CONTENT_START_Y: 420 // ИСПРАВЛЕНО: возвращаем 420px от верха
  },
  FONTS: {
    TITLE_INTRO: { size: 128, weight: 'bold', lineHeightRatio: 1.1 },
    SUBTITLE_INTRO: { size: 64, weight: 'normal', lineHeightRatio: 1.25 },
    TITLE_TEXT_WITH_CONTENT: { size: 96, weight: 'bold', lineHeightRatio: 1.2 }, // 24px × 4 = 96px
    TITLE_TEXT_ONLY: { size: 136, weight: 'bold', lineHeightRatio: 1.2 },
    TEXT: { size: 64, weight: 'normal', lineHeightRatio: 1.4 }, // 16px × 4 = 64px
    QUOTE_LARGE: { size: 96, weight: 'bold', lineHeightRatio: 1.2 },
    QUOTE_SMALL: { size: 64, weight: 'bold', lineHeightRatio: 1.3 },
    HEADER_FOOTER: { size: 48, weight: 'normal', lineHeightRatio: 1.4 } // 12px × 4 = 48px
  },
  SPACING: {
    H2_TO_P: 80, // 20px × 4 = 80px (margin-bottom h2) - БОЛЬШОЙ отступ между блоками
    P_TO_P: 24   // ИСПРАВЛЕНО: 6px × 4 = 24px - МАЛЕНЬКИЙ отступ внутри блока
  },
  COLORS: {
    DEFAULT_BG: '#ffffff',
    DEFAULT_TEXT: '#000000',
    ACCENT_FALLBACK: '#6366F1'
  }
};

// Функция для получения CSS шрифта и line-height
function getFontStyle(fontConfig) {
  const fontCSS = `${fontConfig.weight} ${fontConfig.size}px Arial`;
  const lineHeight = Math.round(fontConfig.size * fontConfig.lineHeightRatio);
  return { fontCSS, lineHeight };
}

// ТОЧНО ваша функция + ТОЛЬКО висячие предлоги
function wrapText(ctx, text, maxWidth) {
  if (!text) return [];
  
  const words = text.split(' ');
  const lines = [];
  let currentLine = words[0] || '';

  // Висячие предлоги
  const hangingWords = [
    'и', 'а', 'но', 'да', 'или', 'либо', 'то', 'не', 'ни', 
    'за', 'для', 'без', 'при', 'про', 'под', 'над', 'через', 'между', 
    'из', 'от', 'до', 'на', 'в', 'с', 'у', 'о', 'об', 'во', 'со', 'ко',
    'что', 'как', 'где', 'когда', 'если', 'чтобы', 'который', 'которая'
  ];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine + ' ' + word;
    const width = ctx.measureText(testLine).width;
    
    if (width < maxWidth) {
      currentLine = testLine;
      
      // ДОБАВЛЯЕМ ТОЛЬКО проверку висячих предлогов
      const nextWord = words[i + 1];
      if (nextWord && hangingWords.includes(word.toLowerCase())) {
        const testWithNext = currentLine + ' ' + nextWord;
        const widthWithNext = ctx.measureText(testWithNext).width;
        
        if (widthWithNext < maxWidth) {
          currentLine = testWithNext;
          i++; // Пропускаем следующее слово
        }
      }
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines;
}

function parseMarkdownToSlides(text) {
  const tokens = marked.lexer(text);
  const slides = [];
  let currentSlide = null;

  tokens.forEach((token, index) => {
    if (token.type === 'heading' && token.depth === 1) {
      const nextToken = tokens[index + 1];
      const subtitle = (nextToken && nextToken.type === 'paragraph') ? nextToken.text : '';
      
      slides.push({
        type: 'intro',
        title: token.text,
        text: subtitle,
        color: 'accent'
      });
    } 
    else if (token.type === 'heading' && token.depth === 2) {
      currentSlide = {
        type: 'text',
        title: token.text,
        text: '',
        color: 'default',
        content: []
      };
      slides.push(currentSlide);
    } 
    else if (token.type === 'blockquote') {
      const quoteText = token.tokens?.[0]?.text || '';
      slides.push({
        type: 'quote',
        text: quoteText,
        color: 'accent',
        size: quoteText.length > 100 ? 'small' : 'large'
      });
    } 
    else if (currentSlide && (token.type === 'paragraph' || token.type === 'list')) {
      if (token.type === 'paragraph') {
        currentSlide.content.push({ type: 'paragraph', text: token.text });
      } else if (token.type === 'list') {
        currentSlide.content.push({
          type: 'list',
          items: token.items.map(item => item.text)
        });
      }
    }
  });

  // Объединяем контент
  slides.forEach(slide => {
    if (slide.content) {
      const paragraphs = slide.content.filter(c => c.type === 'paragraph').map(c => c.text);
      const lists = slide.content.filter(c => c.type === 'list');
      
      let fullText = '';
      if (paragraphs.length > 0) {
        fullText += paragraphs.join('\n\n');
      }
      if (lists.length > 0) {
        if (fullText) fullText += '\n\n';
        lists.forEach(list => {
          fullText += list.items.map(item => `• ${item}`).join('\n');
        });
      }
      
      slide.text = fullText;
      delete slide.content;
    }
  });

  return slides;
}

function renderSlideToCanvas(slide, slideNumber, totalSlides, settings) {
  const {
    brandColor = CONFIG.COLORS.ACCENT_FALLBACK,
    authorUsername = '@username',
    authorFullName = 'Your Name'
  } = settings;

  const canvas = createCanvas(CONFIG.CANVAS.WIDTH, CONFIG.CANVAS.HEIGHT);
  const ctx = canvas.getContext('2d');
  
  // Цвета
  const isAccent = slide.color === 'accent';
  const bgColor = isAccent ? brandColor : CONFIG.COLORS.DEFAULT_BG;
  const textColor = isAccent ? CONFIG.COLORS.DEFAULT_BG : CONFIG.COLORS.DEFAULT_TEXT;
  
  // Фон с закругленными углами
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.roundRect(0, 0, CONFIG.CANVAS.WIDTH, CONFIG.CANVAS.HEIGHT, CONFIG.CANVAS.BORDER_RADIUS);
  ctx.fill();
  
  ctx.fillStyle = textColor;
  
  // Header - отступ по формуле ×4 от веб-версии
  const headerFooter = getFontStyle(CONFIG.FONTS.HEADER_FOOTER);
  ctx.font = headerFooter.fontCSS;
  ctx.globalAlpha = 0.7;
  ctx.textAlign = 'left';
  ctx.fillText(authorUsername, CONFIG.CANVAS.PADDING, CONFIG.CANVAS.HEADER_FOOTER_PADDING);
  ctx.textAlign = 'right';
  ctx.fillText(`${slideNumber}/${totalSlides}`, CONFIG.CANVAS.WIDTH - CONFIG.CANVAS.PADDING, CONFIG.CANVAS.HEADER_FOOTER_PADDING);
  ctx.globalAlpha = 1;

  // Content area - начинается с правильного отступа
  const contentY = CONFIG.CANVAS.CONTENT_START_Y;
  const contentHeight = CONFIG.CANVAS.HEIGHT - contentY - CONFIG.CANVAS.HEADER_FOOTER_PADDING;
  const contentWidth = CONFIG.CANVAS.WIDTH - (CONFIG.CANVAS.PADDING * 2);
  
  if (slide.type === 'intro') {
    renderIntroSlide(ctx, slide, contentY, contentHeight, contentWidth);
  } else if (slide.type === 'text') {
    renderTextSlide(ctx, slide, contentY, contentWidth);
  } else if (slide.type === 'quote') {
    renderQuoteSlide(ctx, slide, contentY, contentHeight, contentWidth);
  }

  // Footer - отступ по формуле ×4 от веб-версии
  ctx.font = headerFooter.fontCSS;
  ctx.globalAlpha = 0.7;
  ctx.textAlign = 'left';
  ctx.fillText(authorFullName, CONFIG.CANVAS.PADDING, CONFIG.CANVAS.HEIGHT - CONFIG.CANVAS.HEADER_FOOTER_PADDING);
  ctx.textAlign = 'right';
  if (slideNumber < totalSlides) {
    ctx.fillText('→', CONFIG.CANVAS.WIDTH - CONFIG.CANVAS.PADDING, CONFIG.CANVAS.HEIGHT - CONFIG.CANVAS.HEADER_FOOTER_PADDING);
  }
  ctx.globalAlpha = 1;

  return canvas;
}

function renderIntroSlide(ctx, slide, contentY, contentHeight, contentWidth) {
  // Заголовок h1 - начинается с 420px по левому краю
  const titleStyle = getFontStyle(CONFIG.FONTS.TITLE_INTRO);
  ctx.font = titleStyle.fontCSS;
  ctx.textAlign = 'left';
  const titleLines = wrapText(ctx, slide.title || '', contentWidth);
  let y = contentY; // Начинаем с 420px
  
  titleLines.forEach(line => {
    ctx.fillText(line, CONFIG.CANVAS.PADDING, y);
    y += titleStyle.lineHeight;
  });

  // Подзаголовок p - БОЛЬШОЙ отступ как между блоками
  if (slide.text) {
    const subtitleStyle = getFontStyle(CONFIG.FONTS.SUBTITLE_INTRO);
    ctx.font = subtitleStyle.fontCSS;
    ctx.textAlign = 'left';
    ctx.globalAlpha = 0.9;
    y += CONFIG.SPACING.H2_TO_P; // 80px отступ между блоками
    const subtitleLines = wrapText(ctx, slide.text, contentWidth);
    subtitleLines.forEach(line => {
      ctx.fillText(line, CONFIG.CANVAS.PADDING, y);
      y += subtitleStyle.lineHeight;
    });
    ctx.globalAlpha = 1;
  }
}

function renderTextSlide(ctx, slide, contentY, contentWidth) {
  let y = contentY; // Начинаем с 420px
  
  // Заголовок h2 с правильным margin-bottom
  if (slide.title) {
    const titleStyle = getFontStyle(CONFIG.FONTS.TITLE_TEXT_WITH_CONTENT);
    ctx.font = titleStyle.fontCSS;
    ctx.textAlign = 'left';
    
    const titleLines = wrapText(ctx, slide.title, contentWidth);
    titleLines.forEach(line => {
      ctx.fillText(line, CONFIG.CANVAS.PADDING, y);
      y += titleStyle.lineHeight;
    });
    
    // h2 имеет БОЛЬШОЙ margin-bottom: 80px (отступ между блоками)
    y += CONFIG.SPACING.H2_TO_P; // 80px
  }

  // Основной текст с МАЛЕНЬКИМИ отступами между параграфами
  if (slide.text) {
    const textStyle = getFontStyle(CONFIG.FONTS.TEXT);
    ctx.font = textStyle.fontCSS;
    ctx.textAlign = 'left';
    
    const textLines = slide.text.split('\n').filter(line => line.trim());
    
    textLines.forEach((line, lineIndex) => {
      const isLastLine = lineIndex === textLines.length - 1;
      
      if (line.trim().startsWith('•')) {
        const itemText = line.replace(/^•\s*/, '');
        const wrappedLines = wrapText(ctx, '→ ' + itemText, contentWidth);
        wrappedLines.forEach(wrappedLine => {
          ctx.fillText(wrappedLine, CONFIG.CANVAS.PADDING, y);
          y += textStyle.lineHeight;
        });
        
        // ИСПРАВЛЕНО: МАЛЕНЬКИЙ отступ между пунктами списка (24px вместо 64px)
        if (!isLastLine) {
          y += CONFIG.SPACING.P_TO_P; // 24px - внутри одного блока
        }
      } else if (line.trim()) {
        const wrappedLines = wrapText(ctx, line.trim(), contentWidth);
        wrappedLines.forEach(wrappedLine => {
          ctx.fillText(wrappedLine, CONFIG.CANVAS.PADDING, y);
          y += textStyle.lineHeight;
        });
        
        // ИСПРАВЛЕНО: МАЛЕНЬКИЙ отступ между параграфами (24px вместо 64px)
        if (!isLastLine) {
          y += CONFIG.SPACING.P_TO_P; // 24px - внутри одного блока
        }
      }
    });
  }
}

function renderQuoteSlide(ctx, slide, contentY, contentHeight, contentWidth) {
  ctx.textAlign = 'left'; // Цитаты тоже по левому краю (современный подход)
  
  const isSmall = slide.size === 'small';
  const quoteStyle = getFontStyle(isSmall ? CONFIG.FONTS.QUOTE_SMALL : CONFIG.FONTS.QUOTE_LARGE);
  ctx.font = quoteStyle.fontCSS;
  
  const quoteLines = wrapText(ctx, slide.text || '', contentWidth);
  // Цитаты начинаются с 450px и центрируются в оставшемся пространстве
  let y = contentY + (contentHeight - quoteLines.length * quoteStyle.lineHeight) / 2;
  
  quoteLines.forEach(line => {
    ctx.fillText(line, CONFIG.CANVAS.PADDING, y); // По левому краю
    y += quoteStyle.lineHeight;
  });
}

// API Routes
app.get('/health', (req, res) => {
  res.json({ 
    status: 'production-ready',
    engine: 'canvas-api',
    performance: 'optimized',
    memory: 'efficient'
  });
});

app.post('/api/generate-carousel', async (req, res) => {
  const startTime = Date.now();
  console.log('🎯 Генерация через Canvas API...');
  
  try {
    const { text, settings = {} } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Требуется текст' });
    }

    // Парсинг
    const slides = parseMarkdownToSlides(text);
    
    if (slides.length === 0) {
      slides.push({
        type: 'text',
        title: 'Ваш контент',
        text: text.substring(0, 200),
        color: 'default'
      });
    }

    console.log(`📝 Создано слайдов: ${slides.length}`);

    // Рендеринг
    const images = [];
    for (let i = 0; i < slides.length; i++) {
      const canvas = renderSlideToCanvas(slides[i], i + 1, slides.length, settings);
      const base64 = canvas.toBuffer('image/png').toString('base64');
      images.push(base64);
    }

    const processingTime = Date.now() - startTime;
    console.log(`🚀 Завершено за ${processingTime}ms`);

    res.json({
      slides,
      images,
      metadata: {
        totalSlides: slides.length,
        generatedAt: new Date().toISOString(),
        processingTime,
        settings,
        engine: 'canvas-api-production'
      }
    });

  } catch (error) {
    console.error('❌ Ошибка:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Graceful shutdown');
  process.exit(0);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 PRODUCTION Canvas API на порту ${PORT}`);
  console.log(`⚡ Готов к высоким нагрузкам`);
});
