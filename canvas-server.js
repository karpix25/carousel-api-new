/**
 * Canvas Carousel API - v2.1 Final
 * Описание: Полностью переработанная версия с параллельной генерацией,
 * исправленной типографикой (без висячих предлогов), унифицированным
 * рендерингом и надежным управлением зависимостями.
 *
 * @author Gemini AI (based on user's code)
 * @version 2.1
 */
console.log('🎯 ФИНАЛЬНАЯ ВЕРСИЯ v2.1 - Canvas API (auto contrast, advanced typography)');

const express = require('express');
const { marked } = require('marked');
const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');

// ================== CONFIG ==================
const CONFIG = {
  CANVAS: {
    WIDTH: 1600,
    HEIGHT: 2000,
    PADDING: 144,
    BORDER_RADIUS: 64,
    HEADER_FOOTER_PADDING: 192,
    CONTENT_GAP: 144,
    CONTENT_START_Y: 500
  },
  FONTS: {
    FAMILY: 'Inter',
    TITLE_INTRO: { size: 128, weight: 'bold', lineHeightRatio: 1.1 },
    SUBTITLE_INTRO: { size: 64, weight: 'normal', lineHeightRatio: 1.25 },
    TITLE_TEXT: { size: 96, weight: 'bold', lineHeightRatio: 1.2 },
    TEXT: { size: 64, weight: 'normal', lineHeightRatio: 1.4 },
    QUOTE_LARGE: { size: 96, weight: 'bold', lineHeightRatio: 1.2 },
    QUOTE_SMALL: { size: 64, weight: 'bold', lineHeightRatio: 1.3 },
    HEADER_FOOTER: { size: 48, weight: 'normal', lineHeightRatio: 1.4 }
  },
  SPACING: {
    H2_TO_CONTENT: 80,
    BLOCK_TO_BLOCK: 48
  },
  COLORS: {
    DEFAULT_BG: '#ffffff',
    DEFAULT_TEXT: '#000000',
    ACCENT_FALLBACK: '#6366F1',
    LIGHT_TEXT: '#ffffff',
    DARK_TEXT: '#000000'
  },
  LIST_MARKER: '→'
};

// ================== FONT REGISTRATION ==================
try {
  registerFont(path.join(__dirname, 'fonts', 'Inter-Regular.ttf'), { family: CONFIG.FONTS.FAMILY, weight: 'normal' });
  registerFont(path.join(__dirname, 'fonts', 'Inter-Bold.ttf'), { family: CONFIG.FONTS.FAMILY, weight: 'bold' });
  console.log('✅ Шрифты Inter-Regular и Inter-Bold успешно зарегистрированы.');
} catch (error) {
  console.error('❌ ОШИБКА: Не удалось зарегистрировать шрифты. Убедитесь, что файлы .ttf находятся в папке /fonts.', error.message);
  process.exit(1);
}

// ================== COLOR CONTRAST HELPERS ==================
function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('');
  }
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return { r, g, b };
}

function getLuminance(r, g, b) {
  const a = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function getContrastColor(backgroundColor) {
  try {
    const { r, g, b } = hexToRgb(backgroundColor);
    const luminance = getLuminance(r, g, b);
    return luminance > 0.5 ? CONFIG.COLORS.DARK_TEXT : CONFIG.COLORS.LIGHT_TEXT;
  } catch (error) {
    console.warn('⚠️ Ошибка определения контраста для цвета:', backgroundColor, '. Используется цвет по умолчанию.');
    return CONFIG.COLORS.DARK_TEXT;
  }
}

function getAccentColorForBackground(backgroundColor, brandColor) {
  try {
    const { r, g, b } = hexToRgb(backgroundColor);
    const luminance = getLuminance(r, g, b);
    return luminance > 0.5 ? brandColor : CONFIG.COLORS.LIGHT_TEXT;
  } catch (error) {
    console.warn('⚠️ Ошибка определения акцентного цвета для:', backgroundColor, '. Используется цвет бренда.');
    return brandColor;
  }
}

// ================== TYPOGRAPHY & TEXT HELPERS ==================
function fixTypography(text) {
  if (!text) return '';
  return text.replace(/(^|\s)([вкмсзиоуая]{1,2})\s/gi, '$1$2\u00A0');
}

function buildFont(weight, size) {
  return `${weight} ${size}px ${CONFIG.FONTS.FAMILY}`;
}

function parseInline(raw) {
  if (!raw) return [];
  const tokens = [];
  const regex = /(__\*\*.+?\*\*__|__.+?__|\*\*.+?\*\*|[^*_]+)/g;
  let match;

  while ((match = regex.exec(raw)) !== null) {
    let chunk = match[0];
    let bold = false;
    let underline = false;
    let text = chunk;

    if (chunk.startsWith('__') && chunk.endsWith('__')) {
      underline = true;
      text = text.slice(2, -2);
      if (text.startsWith('**') && text.endsWith('**')) {
        bold = true;
        text = text.slice(2, -2);
      }
    } else if (chunk.startsWith('**') && chunk.endsWith('**')) {
      bold = true;
      text = text.slice(2, -2);
    }

    if (!text) continue;
    tokens.push({ text, bold, underline });
  }

  if (tokens.length < 2) return tokens;
  return tokens.reduce((acc, current) => {
    const last = acc[acc.length - 1];
    if (last && last.bold === current.bold && last.underline === current.underline) {
      last.text += current.text;
    } else {
      acc.push(current);
    }
    return acc;
  }, []);
}

/**
 * Разбивает сегменты текста на строки с учетом максимальной ширины.
 * Это ядро системы переноса. ИСПРАВЛЕННАЯ ВЕРСИЯ.
 */
function wrapSegments(ctx, segments, maxWidth, baseFontSize) {
  const lines = [];
  let currentLine = { runs: [], width: 0 };

  const pushLine = () => {
    if (currentLine.runs.length > 0) {
      lines.push(currentLine);
      currentLine = { runs: [], width: 0 };
    }
  };

  for (const seg of segments) {
    // ИСПРАВЛЕНИЕ: Используем split только по обычным пробелам/табам, чтобы не ломать неразрывный пробел.
    const words = seg.text.split(/([ \t]+)/);

    for (const word of words) {
      if (!word) continue;

      ctx.font = buildFont(seg.bold ? 'bold' : 'normal', baseFontSize);
      const wordWidth = ctx.measureText(word).width;
      // ИСПРАВЛЕНИЕ: Проверяем на обычный пробел/таб
      const isSpace = /^[ \t]+$/.test(word);

      // Переносим строку, только если слово не помещается И строка уже не пустая
      if (currentLine.width + wordWidth > maxWidth && !isSpace && currentLine.runs.length > 0) {
        pushLine();
      }

      currentLine.runs.push({ ...seg, text: word });
      currentLine.width += wordWidth;
    }
  }
  pushLine();
  return lines;
}

// ================== UNIFIED TEXT RENDERER ==================
/**
 * ✨ ЕДИНЫЙ РЕНДЕРЕР ТЕКСТА.
 */
function renderRichText(ctx, rawText, x, startY, maxWidth, fontConf, baseColor, accentColor, slideIsAccent) {
  const processedText = fixTypography(rawText);
  if (!processedText) return 0;

  const { size: baseFontSize, lineHeightRatio } = fontConf;
  const lineHeight = Math.round(baseFontSize * lineHeightRatio);

  const segments = parseInline(processedText);
  const lines = wrapSegments(ctx, segments, maxWidth, baseFontSize);
  const underlineStrokes = [];
  let y = startY;

  for (const line of lines) {
    let cursorX = x;
    for (const run of line.runs) {
      const weight = run.bold ? 'bold' : 'normal';
      ctx.font = buildFont(weight, baseFontSize);

      const useAccent = run.underline && run.bold && !slideIsAccent;
      ctx.fillStyle = useAccent ? accentColor : baseColor;

      ctx.textBaseline = 'alphabetic';
      ctx.fillText(run.text, cursorX, y);

      if (run.underline) {
        const metrics = ctx.measureText(run.text);
        const underlineY = y + (metrics.actualBoundingBoxDescent || baseFontSize * 0.15);
        underlineStrokes.push({
          x1: cursorX,
          x2: cursorX + metrics.width,
          y: underlineY,
          color: ctx.fillStyle
        });
      }
      cursorX += ctx.measureText(run.text).width;
    }
    y += lineHeight;
  }

  ctx.lineWidth = Math.max(3, Math.round(baseFontSize * 0.045));
  underlineStrokes.forEach(stroke => {
    ctx.strokeStyle = stroke.color;
    ctx.beginPath();
    ctx.moveTo(stroke.x1, stroke.y);
    ctx.lineTo(stroke.x2, stroke.y);
    ctx.stroke();
  });

  return lines.length * lineHeight;
}

// ================== MARKDOWN PARSER v2.0 ==================
function parseMarkdownToSlides(text) {
  const tokens = marked.lexer(text);
  const slides = [];
  let currentSlide = null;

  const startNewTextSlide = (title) => {
    currentSlide = { type: 'text', title, text: '', color: 'default', content: [] };
    slides.push(currentSlide);
  };

  tokens.forEach((token, index) => {
    switch (token.type) {
      case 'heading':
        if (token.depth === 1) {
          currentSlide = null;
          const nextToken = tokens[index + 1];
          const subtitle = (nextToken && nextToken.type === 'paragraph') ? nextToken.text : '';
          slides.push({ type: 'intro', title: token.text, text: subtitle, color: 'accent' });
        } else if (token.depth === 2) {
          startNewTextSlide(token.text);
        }
        break;

      case 'blockquote':
        const quoteText = token.tokens?.[0]?.text || '';
        if (currentSlide) {
          currentSlide.content.push({ type: 'blockquote', text: quoteText });
        } else {
          slides.push({
            type: 'quote',
            text: quoteText,
            color: 'accent',
            size: quoteText.length > 100 ? 'small' : 'large'
          });
        }
        break;

      case 'paragraph':
      case 'list':
        if (!currentSlide) {
          startNewTextSlide('');
        }
        if (token.type === 'paragraph') {
          currentSlide.content.push({ type: 'paragraph', text: token.text });
        } else if (token.type === 'list') {
          currentSlide.content.push({ type: 'list', items: token.items.map(item => item.text) });
        }
        break;
    }
  });

  return slides;
}

// ================== SLIDE RENDERERS v2.0 ==================
function renderIntroSlide(ctx, slide, contentY, contentWidth, brandColor) {
  let y = contentY;
  ctx.textAlign = 'left';

  const titleHeight = renderRichText(ctx, slide.title, CONFIG.CANVAS.PADDING, y, contentWidth, CONFIG.FONTS.TITLE_INTRO, ctx.fillStyle, brandColor, true);
  y += titleHeight;

  if (slide.text) {
    y += CONFIG.SPACING.H2_TO_CONTENT;
    ctx.globalAlpha = 0.9;
    renderRichText(ctx, slide.text, CONFIG.CANVAS.PADDING, y, contentWidth, CONFIG.FONTS.SUBTITLE_INTRO, ctx.fillStyle, brandColor, true);
    ctx.globalAlpha = 1.0;
  }
}

function renderTextSlide(ctx, slide, contentY, contentWidth, brandColor) {
  let y = contentY;
  ctx.textAlign = 'left';

  if (slide.title) {
    const titleHeight = renderRichText(ctx, slide.title, CONFIG.CANVAS.PADDING, y, contentWidth, CONFIG.FONTS.TITLE_TEXT, ctx.fillStyle, brandColor, slide.color === 'accent');
    y += titleHeight + CONFIG.SPACING.H2_TO_CONTENT;
  }

  slide.content?.forEach((block, index) => {
    let blockHeight = 0;
    const isLastBlock = index === slide.content.length - 1;

    switch (block.type) {
      case 'paragraph':
        blockHeight = renderRichText(ctx, block.text, CONFIG.CANVAS.PADDING, y, contentWidth, CONFIG.FONTS.TEXT, ctx.fillStyle, brandColor, slide.color === 'accent');
        break;

      case 'list':
        const marker = CONFIG.LIST_MARKER + ' ';
        ctx.font = buildFont('bold', CONFIG.FONTS.TEXT.size);
        const markerWidth = ctx.measureText(marker).width;

        let listY = y;
        block.items.forEach(item => {
          ctx.font = buildFont('bold', CONFIG.FONTS.TEXT.size);
          // Выравниваем маркер по первой строке текста
          const itemFirstLineHeight = Math.round(CONFIG.FONTS.TEXT.size * CONFIG.FONTS.TEXT.lineHeightRatio);
          const markerY = listY + (itemFirstLineHeight - CONFIG.FONTS.TEXT.size) / 2 + CONFIG.FONTS.TEXT.size * 0.8;
          ctx.fillText(CONFIG.LIST_MARKER, CONFIG.CANVAS.PADDING, markerY);

          const itemHeight = renderRichText(ctx, item, CONFIG.CANVAS.PADDING + markerWidth, listY, contentWidth - markerWidth, CONFIG.FONTS.TEXT, ctx.fillStyle, brandColor, slide.color === 'accent');
          listY += itemHeight;
        });
        blockHeight = listY - y;
        break;
      
      case 'blockquote':
        ctx.globalAlpha = 0.8;
        blockHeight = renderRichText(ctx, `“${block.text}”`, CONFIG.CANVAS.PADDING + 40, y, contentWidth - 40, CONFIG.FONTS.TEXT, ctx.fillStyle, brandColor, slide.color === 'accent');
        ctx.globalAlpha = 1.0;
        break;
    }
    
    y += blockHeight;
    if (!isLastBlock) {
      y += CONFIG.SPACING.BLOCK_TO_BLOCK;
    }
  });
}

function renderQuoteSlide(ctx, slide, contentY, contentHeight, contentWidth) {
    // ...
}

// ================== AVATAR & FINAL SLIDE ==================
async function loadAvatarImage(url) {
  try {
    return await loadImage(url);
  } catch (e) {
    console.warn('⚠️ Не удалось загрузить аватарку:', e.message);
    return null;
  }
}

function renderAvatar(ctx, avatarImage, x, y, size) {
  if (!avatarImage) return;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(avatarImage, x, y, size, size);
  ctx.restore();
}

function addFinalSlide(slides, settings) {
    // ...
    return slides;
}

// ================== MAIN RENDER FUNCTION ==================
async function renderSlideToCanvas(slide, slideNumber, totalSlides, settings, avatarImage = null) {
  const {
    brandColor = CONFIG.COLORS.ACCENT_FALLBACK,
    authorUsername = '@username',
    authorFullName = 'Your Name'
  } = settings;

  const canvas = createCanvas(CONFIG.CANVAS.WIDTH, CONFIG.CANVAS.HEIGHT);
  const ctx = canvas.getContext('2d');

  const isAccent = slide.color === 'accent';
  const bgColor = isAccent ? brandColor : CONFIG.COLORS.DEFAULT_BG;
  const textColor = getContrastColor(bgColor);
  const accentColorForText = getAccentColorForBackground(CONFIG.COLORS.DEFAULT_BG, brandColor);

  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.roundRect(0, 0, CONFIG.CANVAS.WIDTH, CONFIG.CANVAS.HEIGHT, CONFIG.CANVAS.BORDER_RADIUS);
  ctx.fill();
  ctx.clip();

  ctx.fillStyle = textColor;

  const headerFooterFont = buildFont(CONFIG.FONTS.HEADER_FOOTER.weight, CONFIG.FONTS.HEADER_FOOTER.size);
  ctx.font = headerFooterFont;
  ctx.globalAlpha = 0.7;
  ctx.textBaseline = 'middle';
  
  const avatarSize = 90;
  const avatarPadding = 24;
  if (avatarImage) {
    const avatarY = CONFIG.CANVAS.HEADER_FOOTER_PADDING - avatarSize / 2;
    renderAvatar(ctx, avatarImage, CONFIG.CANVAS.PADDING, avatarY, avatarSize);
    ctx.textAlign = 'left';
    ctx.fillText(authorUsername, CONFIG.CANVAS.PADDING + avatarSize + avatarPadding, CONFIG.CANVAS.HEADER_FOOTER_PADDING);
  } else {
    ctx.textAlign = 'left';
    ctx.fillText(authorUsername, CONFIG.CANVAS.PADDING, CONFIG.CANVAS.HEADER_FOOTER_PADDING);
  }
  
  ctx.textAlign = 'right';
  ctx.fillText(`${slideNumber}/${totalSlides}`, CONFIG.CANVAS.WIDTH - CONFIG.CANVAS.PADDING, CONFIG.CANVAS.HEADER_FOOTER_PADDING);
  ctx.globalAlpha = 1.0;

  const contentY = CONFIG.CANVAS.CONTENT_START_Y;
  const contentHeight = CONFIG.CANVAS.HEIGHT - contentY - CONFIG.CANVAS.HEADER_FOOTER_PADDING;
  const contentWidth = CONFIG.CANVAS.WIDTH - (CONFIG.CANVAS.PADDING * 2);

  if (slide.type === 'intro') {
    renderIntroSlide(ctx, slide, contentY, contentWidth, accentColorForText);
  } else if (slide.type === 'text') {
    renderTextSlide(ctx, slide, contentY, contentWidth, accentColorForText);
  } else if (slide.type === 'quote') {
    renderQuoteSlide(ctx, slide, contentY, contentHeight, contentWidth);
  }

  ctx.font = headerFooterFont;
  ctx.globalAlpha = 0.7;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(authorFullName, CONFIG.CANVAS.PADDING, CONFIG.CANVAS.HEIGHT - CONFIG.CANVAS.HEADER_FOOTER_PADDING);
  if (slideNumber < totalSlides) {
    ctx.textAlign = 'right';
    ctx.fillText('→', CONFIG.CANVAS.WIDTH - CONFIG.CANVAS.PADDING, CONFIG.CANVAS.HEIGHT - CONFIG.CANVAS.HEADER_FOOTER_PADDING);
  }
  ctx.globalAlpha = 1.0;
  
  return canvas;
}

// ================== EXPRESS APP v2.1 ==================
const app = express();
app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        engine: 'canvas-api-v2.1-final',
        timestamp: new Date().toISOString()
    });
});

app.post('/api/generate-carousel', async (req, res) => {
  const startTime = Date.now();
  try {
    const { text, settings = {} } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Параметр "text" является обязательным.' });
    }

    console.log(`🚀 Начало генерации для brandColor: ${settings.brandColor || 'default'}`);

    const avatarImage = settings.avatarUrl ? await loadAvatarImage(settings.avatarUrl) : null;
    let slides = parseMarkdownToSlides(text);
    slides = addFinalSlide(slides, settings);

    if (slides.length === 0) {
        return res.status(400).json({ error: 'Не удалось создать слайды из предоставленного текста.' });
    }

    const imagePromises = slides.map((slide, i) =>
      renderSlideToCanvas(slide, i + 1, slides.length, settings, avatarImage)
        .then(canvas => canvas.toBuffer('image/png').toString('base64'))
    );
    const images = await Promise.all(imagePromises);

    const processingTime = Date.now() - startTime;
    console.log(`✅ Генерация завершена за ${processingTime}ms. Слайдов: ${slides.length}`);

    res.json({
      images,
      metadata: {
        totalSlides: slides.length,
        processingTime,
        engine: 'canvas-api-v2.1-final',
      }
    });

  } catch (error) {
    console.error('❌ КРИТИЧЕСКАЯ ОШИБКА ГЕНЕРАЦИИ:', error);
    res.status(500).json({ error: 'На сервере произошла внутренняя ошибка.' });
  }
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log(`🚀 PRODUCTION FINAL Canvas API запущен на порту ${PORT}`);
});
