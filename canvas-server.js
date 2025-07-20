/**
 * Улучшенный Canvas Carousel API 
 * Фиксированные размеры + умная обработка переполнения контента
 */
console.log('🎯 УЛУЧШЕННАЯ ПРОДАКШН ВЕРСИЯ - Canvas API (smart overflow handling)');

const express = require('express');
const { marked } = require('marked');
const { createCanvas, loadImage } = require('canvas');

// ================== CONFIG ==================
const CONFIG = {
  CANVAS: {
    WIDTH: 1600,
    HEIGHT: 2000,
    PADDING: 144,
    BORDER_RADIUS: 64,
    HEADER_FOOTER_PADDING: 192,
    CONTENT_GAP: 144,
    CONTENT_START_Y: 420
  },
  FONTS: {
    TITLE_INTRO: { size: 128, weight: 'bold', lineHeightRatio: 1.1, minSize: 80 },
    SUBTITLE_INTRO: { size: 64, weight: 'normal', lineHeightRatio: 1.25, minSize: 40 },
    TITLE_TEXT_WITH_CONTENT: { size: 96, weight: 'bold', lineHeightRatio: 1.2, minSize: 60 },
    TITLE_TEXT_ONLY: { size: 136, weight: 'bold', lineHeightRatio: 1.2, minSize: 80 },
    TEXT: { size: 64, weight: 'normal', lineHeightRatio: 1.4, minSize: 40 },
    QUOTE_LARGE: { size: 96, weight: 'bold', lineHeightRatio: 1.2, minSize: 60 },
    QUOTE_SMALL: { size: 64, weight: 'bold', lineHeightRatio: 1.3, minSize: 40 },
    HEADER_FOOTER: { size: 48, weight: 'normal', lineHeightRatio: 1.4, minSize: 32 }
  },
  RESPONSIVE_SPACING: {
    getH2ToP: (contentDensity) => Math.max(40, 80 - contentDensity * 30),
    getPToP: (contentDensity) => Math.max(12, 24 - contentDensity * 8),
  },
  COLORS: {
    DEFAULT_BG: '#ffffff',
    DEFAULT_TEXT: '#000000',
    ACCENT_FALLBACK: '#6366F1',
    LIGHT_TEXT: '#ffffff',
    DARK_TEXT: '#000000'
  },
  LIMITS: {
    MAX_CHARS_PER_SLIDE: 600,
    MAX_WORD_LENGTH: 25,
    EMERGENCY_FONT_SCALE: 0.65
  }
};

// ================== FONT CACHE ==================
const fontCache = new Map();
function getCachedFont(weight, size) {
  const key = `${weight}-${size}`;
  if (!fontCache.has(key)) {
    fontCache.set(key, `${weight} ${size}px Arial`);
  }
  return fontCache.get(key);
}

// ================== VALIDATION ==================
function validateInput(data) {
  const errors = [];
  
  if (!data.text || typeof data.text !== 'string') {
    errors.push('text обязателен и должен быть строкой');
  }
  
  if (data.text && data.text.length > 50000) {
    errors.push('text слишком длинный (макс 50k символов)');
  }
  
  if (data.settings?.brandColor && !/^#[0-9A-Fa-f]{3,6}$/i.test(data.settings.brandColor)) {
    errors.push('brandColor должен быть валидным HEX цветом');
  }
  
  if (data.settings?.avatarUrl && !isValidUrl(data.settings.avatarUrl)) {
    errors.push('avatarUrl должен быть валидным URL');
  }
  
  return errors;
}

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .substring(0, 50000);
}

// ================== COLOR CONTRAST ==================
function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  return { r, g, b };
}

function getLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastColor(backgroundColor) {
  try {
    const { r, g, b } = hexToRgb(backgroundColor);
    const luminance = getLuminance(r, g, b);
    return luminance > 0.5 ? CONFIG.COLORS.DARK_TEXT : CONFIG.COLORS.LIGHT_TEXT;
  } catch (error) {
    console.warn('Ошибка определения контраста:', backgroundColor);
    return CONFIG.COLORS.DARK_TEXT;
  }
}

function getAccentColorForBackground(backgroundColor, brandColor) {
  try {
    const { r, g, b } = hexToRgb(backgroundColor);
    const luminance = getLuminance(r, g, b);
    return luminance > 0.5 ? brandColor : CONFIG.COLORS.LIGHT_TEXT;
  } catch (error) {
    return brandColor;
  }
}

// ================== CONTENT DENSITY & SCALING ==================
function calculateContentDensity(slides) {
  const totalChars = slides.reduce((sum, slide) => 
    sum + (slide.title?.length || 0) + (slide.text?.length || 0), 0
  );
  return Math.min(1, totalChars / 2000); // 0-1 scale
}

function getOptimalFontSize(ctx, text, maxWidth, maxHeight, baseFontSize, minFontSize) {
  let fontSize = baseFontSize;
  
  while (fontSize >= minFontSize) {
    ctx.font = getCachedFont('normal', fontSize);
    const lines = estimateTextLines(ctx, text, maxWidth);
    const estimatedHeight = lines * fontSize * 1.4; // approx line height
    
    if (estimatedHeight <= maxHeight) {
      return fontSize;
    }
    fontSize -= 4;
  }
  
  return minFontSize;
}

function estimateTextLines(ctx, text, maxWidth) {
  const words = text.split(' ');
  let lines = 1;
  let currentLine = '';
  
  for (const word of words) {
    const testLine = currentLine ? currentLine + ' ' + word : word;
    const width = ctx.measureText(testLine).width;
    
    if (width > maxWidth && currentLine) {
      lines++;
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  
  return lines;
}

// ================== SMART TEXT WRAPPING ==================
function forceWrapLongWords(text, maxWordLength = CONFIG.LIMITS.MAX_WORD_LENGTH) {
  return text.split(' ').map(word => {
    if (word.length <= maxWordLength) return word;
    
    // Разбиваем длинное слово
    const chunks = [];
    for (let i = 0; i < word.length; i += maxWordLength - 1) {
      const chunk = word.slice(i, i + maxWordLength - 1);
      chunks.push(i + maxWordLength - 1 < word.length ? chunk + '-' : chunk);
    }
    return chunks.join(' ');
  }).join(' ');
}

function smartSplitContent(text, maxCharsPerSlide = CONFIG.LIMITS.MAX_CHARS_PER_SLIDE) {
  const paragraphs = text.split('\n\n');
  const slides = [];
  let currentSlide = '';
  
  for (const paragraph of paragraphs) {
    const wrappedParagraph = forceWrapLongWords(paragraph);
    
    if ((currentSlide + wrappedParagraph).length > maxCharsPerSlide && currentSlide) {
      slides.push(currentSlide.trim());
      currentSlide = wrappedParagraph;
    } else {
      currentSlide += (currentSlide ? '\n\n' : '') + wrappedParagraph;
    }
  }
  
  if (currentSlide) slides.push(currentSlide.trim());
  return slides;
}

// ================== SAFE RENDERING ==================
function safeRenderText(ctx, text, x, y) {
  try {
    ctx.fillText(text, x, y);
    return true;
  } catch (error) {
    console.warn('Ошибка рендеринга текста:', error.message);
    return false;
  }
}

function createManagedCanvas() {
  const canvas = createCanvas(CONFIG.CANVAS.WIDTH, CONFIG.CANVAS.HEIGHT);
  const cleanup = () => {
    try {
      if (canvas && typeof canvas.destroy === 'function') {
        canvas.destroy();
      }
    } catch (e) {
      console.warn('Ошибка очистки canvas:', e.message);
    }
  };
  return { canvas, cleanup };
}

// ================== AVATAR LOADING ==================
async function loadAvatarImage(url) {
  try {
    const image = await loadImage(url);
    return image;
  } catch (e) {
    console.warn('Не удалось загрузить аватарку:', e.message);
    return null;
  }
}

function renderAvatar(ctx, avatarImage, x, y, size) {
  if (!avatarImage) return;
  try {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatarImage, x, y, size, size);
    ctx.restore();
  } catch (error) {
    console.warn('Ошибка рендеринга аватарки:', error.message);
    ctx.restore();
  }
}

// ================== INLINE PARSING ==================
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

  // Слияние смежных одинаковых стилей
  const merged = [];
  for (const t of tokens) {
    const last = merged[merged.length - 1];
    if (last && last.bold === t.bold && last.underline === t.underline) {
      last.text += t.text;
    } else {
      merged.push(t);
    }
  }
  return merged;
}

// ================== SEGMENT WRAPPING ==================
function wrapSegments(ctx, segments, maxWidth, baseFontSize) {
  const lines = [];
  let currentRuns = [];
  let currentWidth = 0;

  const pushLine = () => {
    if (currentRuns.length) {
      lines.push({ runs: currentRuns, width: currentWidth });
      currentRuns = [];
      currentWidth = 0;
    }
  };

  for (const seg of segments) {
    const parts = seg.text.split(/(\s+)/);
    for (const part of parts) {
      if (!part) continue;
      const isSpace = /^\s+$/.test(part);

      ctx.font = getCachedFont(seg.bold ? 'bold' : 'normal', baseFontSize);
      let partWidth = ctx.measureText(part).width;

      if (!isSpace && currentWidth + partWidth > maxWidth) {
        if (partWidth > maxWidth) {
          // Разбиваем по символам
          let chunk = '';
          for (const ch of part) {
            ctx.font = getCachedFont(seg.bold ? 'bold' : 'normal', baseFontSize);
            const chWidth = ctx.measureText(ch).width;

            if (currentWidth + chWidth > maxWidth && chunk) {
              currentRuns.push({ ...seg, text: chunk });
              pushLine();
              chunk = ch;
              currentWidth = chWidth;
              continue;
            }
            chunk += ch;
            currentWidth += chWidth;
          }
          if (chunk) {
            currentRuns.push({ ...seg, text: chunk });
          }
          continue;
        }

        pushLine();
        if (isSpace) continue;
        currentRuns.push({ ...seg, text: part });
        currentWidth = partWidth;
      } else {
        currentRuns.push({ ...seg, text: part });
        currentWidth += partWidth;
      }
    }
  }

  pushLine();
  return lines;
}

// ================== RICH TEXT RENDER ==================
function renderRichText(ctx, rawText, x, startY, maxWidth, fontConf, baseColor, accentColor, slideIsAccent, maxHeight = null) {
  if (!rawText) return 0;

  const { size: baseFontSize, lineHeightRatio, minSize } = fontConf;
  
  // Если есть ограничение по высоте, подбираем оптимальный размер шрифта
  let actualFontSize = baseFontSize;
  if (maxHeight) {
    actualFontSize = getOptimalFontSize(ctx, rawText, maxWidth, maxHeight, baseFontSize, minSize);
  }
  
  const lineHeight = Math.round(actualFontSize * lineHeightRatio);
  const segments = parseInline(rawText);
  
  ctx.font = getCachedFont('normal', actualFontSize);
  const lines = wrapSegments(ctx, segments, maxWidth, actualFontSize);

  const underlineStrokes = [];
  let y = startY;

  for (const line of lines) {
    // Проверка границ
    if (maxHeight && (y - startY + lineHeight) > maxHeight) {
      console.warn('🚨 Достигнута максимальная высота, обрезаем текст');
      break;
    }

    let cursorX = x;

    for (const run of line.runs) {
      const txt = run.text;
      const isSpace = /^\s+$/.test(txt);
      const weight = run.bold ? 'bold' : 'normal';
      ctx.font = getCachedFont(weight, actualFontSize);

      const useAccent = run.underline && run.bold && !slideIsAccent;
      ctx.fillStyle = useAccent ? accentColor : baseColor;

      if (!isSpace) {
        ctx.textBaseline = 'alphabetic';
        safeRenderText(ctx, txt, cursorX, y);
        
        if (run.underline) {
          const metrics = ctx.measureText(txt);
          const underlineY = y + (metrics.actualBoundingBoxDescent || actualFontSize * 0.15) - 2;
          underlineStrokes.push({
            x1: cursorX,
            x2: cursorX + metrics.width,
            y: underlineY,
            color: ctx.fillStyle
          });
        }
      }
      const w = ctx.measureText(txt).width;
      cursorX += w;
    }
    y += lineHeight;
  }

  // Отрисовываем подчеркивания
  ctx.lineWidth = Math.max(3, Math.round(actualFontSize * 0.045));
  underlineStrokes.forEach(st => {
    ctx.strokeStyle = st.color;
    ctx.beginPath();
    ctx.moveTo(st.x1, st.y);
    ctx.lineTo(st.x2, st.y);
    ctx.stroke();
  });

  return lines.length;
}

// ================== MARKDOWN PARSING ==================
function parseMarkdownToSlides(text) {
  const sanitizedText = sanitizeInput(text);
  const tokens = marked.lexer(sanitizedText);
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
    } else if (token.type === 'heading' && token.depth === 2) {
      currentSlide = {
        type: 'text',
        title: token.text,
        text: '',
        color: 'default',
        content: []
      };
      slides.push(currentSlide);
    } else if (token.type === 'blockquote') {
      const quoteText = token.tokens?.[0]?.text || '';
      slides.push({
        type: 'quote',
        text: quoteText,
        color: 'accent',
        size: quoteText.length > 100 ? 'small' : 'large'
      });
    } else if (currentSlide && (token.type === 'paragraph' || token.type === 'list')) {
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
      if (paragraphs.length) {
        fullText += paragraphs.join('\n\n');
      }
      if (lists.length) {
        if (fullText) fullText += '\n\n';
        lists.forEach(list => {
          fullText += list.items.map(item => `• ${item}`).join('\n');
        });
      }
      slide.text = fullText;
      delete slide.content;
    }
  });

  // Автоматическое разбиение слишком длинного контента
  const processedSlides = [];
  slides.forEach(slide => {
    if (slide.text && slide.text.length > CONFIG.LIMITS.MAX_CHARS_PER_SLIDE) {
      const splitContent = smartSplitContent(slide.text);
      splitContent.forEach((content, index) => {
        processedSlides.push({
          ...slide,
          title: index === 0 ? slide.title : `${slide.title} (${index + 1})`,
          text: content
        });
      });
    } else {
      processedSlides.push(slide);
    }
  });

  return processedSlides;
}

// ================== FINAL SLIDE ==================
function addFinalSlide(slides, settings) {
  const finalSlideConfig = settings.finalSlide;
  if (!finalSlideConfig || !finalSlideConfig.enabled) return slides;

  const templates = {
    cta: {
      title: 'Подписывайтесь!',
      text: 'Ставьте лайк если полезно\n\nБольше контента в профиле',
      color: 'accent'
    },
    contact: {
      title: 'Связаться со мной:',
      text: 'email@example.com\n\nTelegram: @username\n\nwebsite.com',
      color: 'default'
    },
    brand: {
      title: 'Спасибо за внимание!',
      text: 'Помогаю бизнесу расти\n\nКонсультации и стратегии',
      color: 'accent'
    }
  };

  let finalSlide;
  if (finalSlideConfig.type && templates[finalSlideConfig.type]) {
    finalSlide = {
      type: 'text',
      ...templates[finalSlideConfig.type],
      ...(finalSlideConfig.title && { title: finalSlideConfig.title }),
      ...(finalSlideConfig.text && { text: finalSlideConfig.text }),
      ...(finalSlideConfig.color && { color: finalSlideConfig.color })
    };
  } else {
    finalSlide = {
      type: 'text',
      title: finalSlideConfig.title || 'Спасибо за внимание!',
      text: finalSlideConfig.text || 'Больше контента в профиле',
      color: finalSlideConfig.color || 'accent'
    };
  }
  return [...slides, finalSlide];
}

// ================== SLIDE RENDERERS ==================
function wrapPlainForIntro(ctx, text, maxWidth) {
  if (!text) return [];
  const words = text.replace(/[*_]/g, '').split(/\s+/);
  const lines = [];
  let line = '';
  
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function renderIntroSlide(ctx, slide, contentY, contentWidth, maxHeight, contentDensity) {
  const titleStyle = CONFIG.FONTS.TITLE_INTRO;
  const subtitleStyle = CONFIG.FONTS.SUBTITLE_INTRO;
  
  // Адаптивный размер шрифта для заголовка
  const titleFontSize = getOptimalFontSize(
    ctx, 
    slide.title || '', 
    contentWidth, 
    maxHeight * 0.6, // 60% высоты для заголовка
    titleStyle.size, 
    titleStyle.minSize
  );
  
  ctx.font = getCachedFont(titleStyle.weight, titleFontSize);
  ctx.textAlign = 'left';
  const titleLines = wrapPlainForIntro(ctx, slide.title || '', contentWidth);
  let y = contentY;

  titleLines.forEach(line => {
    safeRenderText(ctx, line, CONFIG.CANVAS.PADDING, y);
    y += Math.round(titleFontSize * titleStyle.lineHeightRatio);
  });

  if (slide.text) {
    const spacing = CONFIG.RESPONSIVE_SPACING.getH2ToP(contentDensity);
    y += spacing;
    
    const subtitleFontSize = getOptimalFontSize(
      ctx,
      slide.text,
      contentWidth,
      maxHeight - (y - contentY),
      subtitleStyle.size,
      subtitleStyle.minSize
    );
    
    ctx.font = getCachedFont(subtitleStyle.weight, subtitleFontSize);
    ctx.globalAlpha = 0.9;
    const lines = wrapPlainForIntro(ctx, slide.text, contentWidth);
    lines.forEach(line => {
      safeRenderText(ctx, line, CONFIG.CANVAS.PADDING, y);
      y += Math.round(subtitleFontSize * subtitleStyle.lineHeightRatio);
    });
    ctx.globalAlpha = 1;
  }
}

function renderTextSlide(ctx, slide, contentY, contentWidth, brandColor, maxHeight, contentDensity) {
  let y = contentY;
  const remainingHeight = maxHeight;
  
  // Заголовок
  if (slide.title) {
    const titleStyle = CONFIG.FONTS.TITLE_TEXT_WITH_CONTENT;
    const titleFontSize = getOptimalFontSize(
      ctx,
      slide.title,
      contentWidth,
      remainingHeight * 0.3, // 30% для заголовка
      titleStyle.size,
      titleStyle.minSize
    );
    
    ctx.font = getCachedFont(titleStyle.weight, titleFontSize);
    ctx.textAlign = 'left';
    const lines = wrapPlainForIntro(ctx, slide.title, contentWidth);
    lines.forEach(l => {
      safeRenderText(ctx, l, CONFIG.CANVAS.PADDING, y);
      y += Math.round(titleFontSize * titleStyle.lineHeightRatio);
    });
    
    const spacing = CONFIG.RESPONSIVE_SPACING.getH2ToP(contentDensity);
    y += spacing;
  }

  // Контент
  if (slide.text) {
    const baseFont = CONFIG.FONTS.TEXT;
    const maxContentHeight = maxHeight - (y - contentY);
    const paragraphs = slide.text.split('\n').filter(l => l.trim());

    paragraphs.forEach((rawLine, idx) => {
      const isBullet = rawLine.trim().startsWith('•');
      let lineText = rawLine.trim();
      let x = CONFIG.CANVAS.PADDING;
      let maxW = contentWidth;

      if (isBullet) {
        const marker = '→';
        ctx.font = getCachedFont('bold', baseFont.size);
        safeRenderText(ctx, marker, x, y);
        const markerWidth = ctx.measureText(marker + ' ').width;
        x += markerWidth + 32;
        maxW -= (markerWidth + 32);
        lineText = lineText.replace(/^•\s*/, '');
      }

      const usedLines = renderRichText(
        ctx,
        lineText,
        x,
        y,
        maxW,
        baseFont,
        ctx.fillStyle,
        brandColor,
        slide.color === 'accent',
        maxContentHeight - (y - contentY) // Передаем оставшуюся высоту
      );

      y += usedLines * Math.round(baseFont.size * baseFont.lineHeightRatio);
      if (idx !== paragraphs.length - 1) {
        const spacing = CONFIG.RESPONSIVE_SPACING.getPToP(contentDensity);
        y += spacing;
      }
      
      // Проверка переполнения
      if (y > contentY + maxContentHeight) {
        console.warn('🚨 Достигнута максимальная высота контента');
        break;
      }
    });
  }
}

function renderQuoteSlide(ctx, slide, contentY, contentHeight, contentWidth) {
  ctx.textAlign = 'left';
  const isSmall = slide.size === 'small';
  const quoteFont = isSmall ? CONFIG.FONTS.QUOTE_SMALL : CONFIG.FONTS.QUOTE_LARGE;
  
  const quoteFontSize = getOptimalFontSize(
    ctx,
    slide.text || '',
    contentWidth,
    contentHeight,
    quoteFont.size,
    quoteFont.minSize
  );
  
  ctx.font = getCachedFont(quoteFont.weight, quoteFontSize);
  const lineHeight = Math.round(quoteFontSize * quoteFont.lineHeightRatio);

  const lines = wrapPlainForIntro(ctx, slide.text || '', contentWidth);
  let y = contentY + (contentHeight - lines.length * lineHeight) / 2;
  
  lines.forEach(l => {
    safeRenderText(ctx, l, CONFIG.CANVAS.PADDING, y);
    y += lineHeight;
  });
}

// ================== MAIN RENDER FUNCTION ==================
async function renderSlideToCanvas(slide, slideNumber, totalSlides, settings, avatarImage = null) {
  const {
    brandColor = CONFIG.COLORS.ACCENT_FALLBACK,
    authorUsername = '@username',
    authorFullName = 'Your Name'
  } = settings;

  const { canvas, cleanup } = createManagedCanvas();
  
  try {
    const ctx = canvas.getContext('2d');

    // Background
    const isAccent = slide.color === 'accent';
    const bgColor = isAccent ? brandColor : CONFIG.COLORS.DEFAULT_BG;
    const textColor = isAccent ? getContrastColor(brandColor) : CONFIG.COLORS.DEFAULT_TEXT;
    const accentColorForText = getAccentColorForBackground(CONFIG.COLORS.DEFAULT_BG, brandColor);

    ctx.fillStyle = bgColor;
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(0, 0, CONFIG.CANVAS.WIDTH, CONFIG.CANVAS.HEIGHT, CONFIG.CANVAS.BORDER_RADIUS);
      ctx.fill();
    } else {
      ctx.fillRect(0, 0, CONFIG.CANVAS.WIDTH, CONFIG.CANVAS.HEIGHT);
    }

    ctx.fillStyle = textColor;

    // Header
    const headerFooter = CONFIG.FONTS.HEADER_FOOTER;
    ctx.font = getCachedFont(headerFooter.weight, headerFooter.size);
    ctx.globalAlpha = 0.7;
    ctx.textAlign = 'left';

    const avatarSize = 100;
    const avatarPadding = 16;

    if (avatarImage) {
      const textBaseline = CONFIG.CANVAS.HEADER_FOOTER_PADDING;
      const avatarY = textBaseline - avatarSize / 2 - 9;
      renderAvatar(ctx, avatarImage, CONFIG.CANVAS.PADDING, avatarY, avatarSize);
      safeRenderText(ctx, authorUsername, CONFIG.CANVAS.PADDING + avatarSize + avatarPadding, CONFIG.CANVAS.HEADER_FOOTER_PADDING);
    } else {
      safeRenderText(ctx, authorUsername, CONFIG.CANVAS.PADDING, CONFIG.CANVAS.HEADER_FOOTER_PADDING);
    }

    ctx.textAlign = 'right';
    safeRenderText(ctx, `${slideNumber}/${totalSlides}`, CONFIG.CANVAS.WIDTH - CONFIG.CANVAS.PADDING, CONFIG.CANVAS.HEADER_FOOTER_PADDING);
    ctx.globalAlpha = 1;

    // Content area calculation
    const contentY = CONFIG.CANVAS.CONTENT_START_Y;
    const contentHeight = CONFIG.CANVAS.HEIGHT - contentY - CONFIG.CANVAS.HEADER_FOOTER_PADDING;
    const contentWidth = CONFIG.CANVAS.WIDTH - (CONFIG.CANVAS.PADDING * 2);
    
    // Calculate content density for responsive spacing
    const contentDensity = calculateContentDensity([slide]);

    // Render content based on slide type
    try {
      if (slide.type === 'intro') {
        renderIntroSlide(ctx, slide, contentY, contentWidth, contentHeight, contentDensity);
      } else if (slide.type === 'text') {
        renderTextSlide(ctx, slide, contentY, contentWidth, accentColorForText, contentHeight, contentDensity);
      } else if (slide.type === 'quote') {
        renderQuoteSlide(ctx, slide, contentY, contentHeight, contentWidth);
      }
    } catch (renderError) {
      console.warn('🚨 Ошибка рендеринга контента, применяем аварийный режим:', renderError.message);
      
      // Emergency fallback rendering
      renderEmergencySlide(ctx, slide, contentY, contentWidth, contentHeight);
    }

    // Footer
    ctx.font = getCachedFont(headerFooter.weight, headerFooter.size);
    ctx.globalAlpha = 0.7;
    ctx.textAlign = 'left';
    safeRenderText(ctx, authorFullName, CONFIG.CANVAS.PADDING, CONFIG.CANVAS.HEIGHT - CONFIG.CANVAS.HEADER_FOOTER_PADDING);
    ctx.textAlign = 'right';
    if (slideNumber < totalSlides) {
      safeRenderText(ctx, '→', CONFIG.CANVAS.WIDTH - CONFIG.CANVAS.PADDING, CONFIG.CANVAS.HEIGHT - CONFIG.CANVAS.HEADER_FOOTER_PADDING);
    }
    ctx.globalAlpha = 1;

    return canvas;
    
  } catch (error) {
    cleanup();
    throw error;
  }
}

// ================== EMERGENCY FALLBACK ==================
function renderEmergencySlide(ctx, slide, contentY, contentWidth, contentHeight) {
  console.log('🆘 Аварийный режим рендеринга');
  
  // Обрезаем контент до безопасных размеров
  const emergencySlide = {
    ...slide,
    title: slide.title?.substring(0, 50) + (slide.title?.length > 50 ? '...' : ''),
    text: slide.text?.substring(0, 300) + (slide.text?.length > 300 ? '...' : '')
  };
  
  const emergencyFontSize = Math.round(CONFIG.FONTS.TEXT.size * CONFIG.LIMITS.EMERGENCY_FONT_SCALE);
  
  ctx.font = getCachedFont('bold', emergencyFontSize);
  ctx.textAlign = 'left';
  let y = contentY;
  
  // Заголовок
  if (emergencySlide.title) {
    const titleLines = wrapPlainForIntro(ctx, emergencySlide.title, contentWidth);
    titleLines.forEach(line => {
      safeRenderText(ctx, line, CONFIG.CANVAS.PADDING, y);
      y += emergencyFontSize * 1.2;
    });
    y += 40;
  }
  
  // Текст
  if (emergencySlide.text) {
    ctx.font = getCachedFont('normal', emergencyFontSize);
    const textLines = wrapPlainForIntro(ctx, emergencySlide.text, contentWidth);
    textLines.forEach(line => {
      if (y < contentY + contentHeight - emergencyFontSize) {
        safeRenderText(ctx, line, CONFIG.CANVAS.PADDING, y);
        y += emergencyFontSize * 1.4;
      }
    });
  }
  
  // Предупреждение о том, что контент был обрезан
  ctx.font = getCachedFont('normal', 32);
  ctx.globalAlpha = 0.5;
  safeRenderText(ctx, '⚠ Контент адаптирован под размер слайда', CONFIG.CANVAS.PADDING, CONFIG.CANVAS.HEIGHT - 300);
  ctx.globalAlpha = 1;
}

// ================== PERFORMANCE METRICS ==================
const performanceMetrics = {
  textParsing: [],
  imageGeneration: [],
  totalRequests: 0,
  errors: 0,
  avgProcessingTime: 0
};

function trackMetric(operation, duration) {
  if (!performanceMetrics[operation]) {
    performanceMetrics[operation] = [];
  }
  
  performanceMetrics[operation].push(duration);
  
  // Храним только последние 100 измерений
  if (performanceMetrics[operation].length > 100) {
    performanceMetrics[operation].shift();
  }
  
  // Обновляем среднее время
  if (operation === 'totalProcessing') {
    const times = performanceMetrics[operation];
    performanceMetrics.avgProcessingTime = times.reduce((a, b) => a + b, 0) / times.length;
  }
}

function getPerformanceStats() {
  const stats = {};
  for (const [key, values] of Object.entries(performanceMetrics)) {
    if (Array.isArray(values) && values.length > 0) {
      stats[key] = {
        avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
        min: Math.min(...values),
        max: Math.max(...values),
        count: values.length
      };
    } else {
      stats[key] = values;
    }
  }
  return stats;
}

// ================== STRUCTURED LOGGING ==================
const logger = {
  info: (msg, meta = {}) => {
    console.log(JSON.stringify({
      level: 'info',
      message: msg,
      timestamp: new Date().toISOString(),
      ...meta
    }));
  },
  
  warn: (msg, meta = {}) => {
    console.warn(JSON.stringify({
      level: 'warn',
      message: msg,
      timestamp: new Date().toISOString(),
      ...meta
    }));
  },
  
  error: (msg, error, meta = {}) => {
    console.error(JSON.stringify({
      level: 'error',
      message: msg,
      error: error?.message || error,
      stack: error?.stack,
      timestamp: new Date().toISOString(),
      ...meta
    }));
  }
};

// ================== EXPRESS APP ==================
const app = express();

// Security middleware
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      res.status(400).json({ error: 'Невалидный JSON' });
    }
  }
}));

// Basic rate limiting
const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 минут
const MAX_REQUESTS_PER_WINDOW = 100;

function simpleRateLimit(req, res, next) {
  const clientIP = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  if (!requestCounts.has(clientIP)) {
    requestCounts.set(clientIP, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return next();
  }
  
  const clientData = requestCounts.get(clientIP);
  
  if (now > clientData.resetTime) {
    clientData.count = 1;
    clientData.resetTime = now + RATE_LIMIT_WINDOW;
    return next();
  }
  
  if (clientData.count >= MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({ 
      error: 'Слишком много запросов',
      retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
    });
  }
  
  clientData.count++;
  next();
}

app.use(simpleRateLimit);

// Health check endpoint
app.get('/health', (req, res) => {
  const stats = getPerformanceStats();
  
  res.json({
    status: 'healthy',
    engine: 'canvas-api-improved',
    performance: stats,
    memory: process.memoryUsage(),
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Performance metrics endpoint
app.get('/metrics', (req, res) => {
  res.json({
    performance: getPerformanceStats(),
    memory: process.memoryUsage(),
    fontCacheSize: fontCache.size,
    timestamp: new Date().toISOString()
  });
});

// Main carousel generation endpoint
app.post('/api/generate-carousel', async (req, res) => {
  const startTime = Date.now();
  let avatarImage = null;
  
  try {
    performanceMetrics.totalRequests++;
    
    // Validation
    const validationErrors = validateInput(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        error: 'Ошибки валидации',
        details: validationErrors 
      });
    }
    
    const { text, settings = {} } = req.body;
    
    logger.info('Начало генерации карусели', {
      textLength: text.length,
      hasAvatar: !!settings.avatarUrl,
      brandColor: settings.brandColor
    });

    // Avatar loading (single load per request)
    const avatarStartTime = Date.now();
    if (settings.avatarUrl) {
      avatarImage = await loadAvatarImage(settings.avatarUrl);
    }
    const avatarLoadTime = Date.now() - avatarStartTime;

    // Text parsing
    const parseStartTime = Date.now();
    let slides = parseMarkdownToSlides(text);
    slides = addFinalSlide(slides, settings);
    const parseTime = Date.now() - parseStartTime;
    trackMetric('textParsing', parseTime);

    if (!slides.length) {
      slides.push({
        type: 'text',
        title: 'Ваш контент',
        text: text.substring(0, 200),
        color: 'default'
      });
    }

    logger.info('Слайды созданы', {
      slideCount: slides.length,
      parseTime,
      avatarLoadTime
    });

    // Image generation
    const renderStartTime = Date.now();
    const images = [];
    
    for (let i = 0; i < slides.length; i++) {
      try {
        const canvas = await renderSlideToCanvas(slides[i], i + 1, slides.length, settings, avatarImage);
        const base64 = canvas.toBuffer('image/png').toString('base64');
        images.push(base64);
        
        // Очистка canvas после каждого слайда
        if (typeof canvas.destroy === 'function') {
          canvas.destroy();
        }
        
      } catch (slideError) {
        logger.error('Ошибка рендеринга слайда', slideError, { slideIndex: i });
        performanceMetrics.errors++;
        
        // Создаем заглушку для проблемного слайда
        const errorCanvas = createCanvas(CONFIG.CANVAS.WIDTH, CONFIG.CANVAS.HEIGHT);
        const errorCtx = errorCanvas.getContext('2d');
        errorCtx.fillStyle = '#f3f4f6';
        errorCtx.fillRect(0, 0, CONFIG.CANVAS.WIDTH, CONFIG.CANVAS.HEIGHT);
        errorCtx.fillStyle = '#374151';
        errorCtx.font = '48px Arial';
        errorCtx.textAlign = 'center';
        errorCtx.fillText('Ошибка рендеринга слайда', CONFIG.CANVAS.WIDTH / 2, CONFIG.CANVAS.HEIGHT / 2);
        
        const errorBase64 = errorCanvas.toBuffer('image/png').toString('base64');
        images.push(errorBase64);
      }
    }
    
    const renderTime = Date.now() - renderStartTime;
    trackMetric('imageGeneration', renderTime);

    const totalProcessingTime = Date.now() - startTime;
    trackMetric('totalProcessing', totalProcessingTime);

    logger.info('Карусель создана успешно', {
      slideCount: slides.length,
      totalProcessingTime,
      renderTime,
      avgTimePerSlide: Math.round(renderTime / slides.length)
    });

    res.json({
      slides,
      images,
      metadata: {
        totalSlides: slides.length,
        generatedAt: new Date().toISOString(),
        processingTime: totalProcessingTime,
        performance: {
          parsing: parseTime,
          rendering: renderTime,
          avatarLoading: avatarLoadTime,
          avgPerSlide: Math.round(renderTime / slides.length)
        },
        settings,
        engine: 'canvas-api-improved-v2'
      }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    performanceMetrics.errors++;
    
    logger.error('Критическая ошибка генерации', error, {
      processingTime,
      textLength: req.body?.text?.length,
      hasAvatar: !!req.body?.settings?.avatarUrl
    });

    // Очистка ресурсов в случае ошибки
    if (avatarImage && typeof avatarImage.destroy === 'function') {
      try {
        avatarImage.destroy();
      } catch (cleanupError) {
        logger.warn('Ошибка очистки аватарки', { error: cleanupError.message });
      }
    }

    if (error.message?.includes('timeout')) {
      return res.status(408).json({
        error: 'Превышено время ожидания',
        message: 'Контент слишком сложный или сервер перегружен'
      });
    }

    if (error.message?.includes('memory')) {
      return res.status(507).json({
        error: 'Недостаточно памяти',
        message: 'Попробуйте сократить объем контента'
      });
    }

    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Попробуйте позже',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Preview endpoint (без генерации изображений)
app.post('/api/preview-slides', async (req, res) => {
  try {
    const validationErrors = validateInput(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        error: 'Ошибки валидации',
        details: validationErrors 
      });
    }

    const { text, settings = {} } = req.body;
    
    let slides = parseMarkdownToSlides(text);
    slides = addFinalSlide(slides, settings);
    
    const contentDensity = calculateContentDensity(slides);

    res.json({
      slides,
      analysis: {
        totalSlides: slides.length,
        contentDensity: Math.round(contentDensity * 100) / 100,
        estimatedProcessingTime: slides.length * 800, // примерная оценка
        warnings: slides.map((slide, i) => {
          const warnings = [];
          if (slide.title && slide.title.length > 60) {
            warnings.push('Длинный заголовок может не поместиться');
          }
          if (slide.text && slide.text.length > CONFIG.LIMITS.MAX_CHARS_PER_SLIDE) {
            warnings.push('Слишком много текста, может потребоваться масштабирование');
          }
          return { slideIndex: i, warnings };
        }).filter(item => item.warnings.length > 0)
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        settings
      }
    });

  } catch (error) {
    logger.error('Ошибка предварительного просмотра', error);
    res.status(500).json({ error: error.message });
  }
});

// Graceful shutdown
function gracefulShutdown() {
  logger.info('Начало graceful shutdown');
  
  // Очистка кэшей
  fontCache.clear();
  requestCounts.clear();
  
  logger.info('Graceful shutdown завершен', {
    finalStats: getPerformanceStats()
  });
  
  process.exit(0);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Memory monitoring
setInterval(() => {
  const memUsage = process.memoryUsage();
  const memMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  
  if (memMB > 512) { // Предупреждение при превышении 512MB
    logger.warn('Высокое потребление памяти', {
      heapUsedMB: memMB,
      fontCacheSize: fontCache.size
    });
  }
  
  // Очистка старых метрик
  if (performanceMetrics.totalRequests % 1000 === 0) {
    requestCounts.clear();
    logger.info('Очистка кэша rate limiting');
  }
}, 60000); // Каждую минуту

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  logger.info('Сервер запущен', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    engine: 'canvas-api-improved-v2'
  });
});
