/**
 * Canvas Carousel API (improved underline + wrapping + auto contrast)
 * CommonJS version
 */
console.log('🎯 ФИНАЛЬНАЯ ПРОДАКШН ВЕРСИЯ - Canvas API (auto contrast engine)');

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
    TITLE_INTRO: { size: 128, weight: 'bold', lineHeightRatio: 1.1 },
    SUBTITLE_INTRO: { size: 64, weight: 'normal', lineHeightRatio: 1.25 },
    TITLE_TEXT_WITH_CONTENT: { size: 96, weight: 'bold', lineHeightRatio: 1.2 },
    TITLE_TEXT_ONLY: { size: 136, weight: 'bold', lineHeightRatio: 1.2 },
    TEXT: { size: 64, weight: 'normal', lineHeightRatio: 1.4 },
    QUOTE_LARGE: { size: 96, weight: 'bold', lineHeightRatio: 1.2 },
    QUOTE_SMALL: { size: 64, weight: 'bold', lineHeightRatio: 1.3 },
    HEADER_FOOTER: { size: 48, weight: 'normal', lineHeightRatio: 1.4 }
  },
  SPACING: {
    H2_TO_P: 80,   // 20px × 4 = 80px (margin-bottom h2)
    P_TO_P: 64     // 16px × 4 = 64px (margin-bottom p) - ИСПРАВЛЕНО!
  },
  COLORS: {
    DEFAULT_BG: '#ffffff',
    DEFAULT_TEXT: '#000000',
    ACCENT_FALLBACK: '#6366F1',
    LIGHT_TEXT: '#ffffff',
    DARK_TEXT: '#000000'
  }
};

// ================== COLOR CONTRAST HELPERS ==================
/**
 * Конвертирует HEX цвет в RGB
 */
function hexToRgb(hex) {
  // Убираем # если есть
  hex = hex.replace('#', '');
  
  // Поддержка 3-символьного HEX (#fff → #ffffff)
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  return { r, g, b };
}

/**
 * Вычисляет яркость цвета по формуле относительной яркости
 * Использует коэффициенты восприятия человеческого глаза
 */
function getLuminance(r, g, b) {
  // Нормализуем значения RGB к 0-1
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  
  // Формула относительной яркости
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Определяет контрастный цвет текста для заданного фона
 * Возвращает белый или черный цвет в зависимости от яркости фона
 */
function getContrastColor(backgroundColor) {
  try {
    const { r, g, b } = hexToRgb(backgroundColor);
    const luminance = getLuminance(r, g, b);
    
    // Если яркость больше 0.5 → темный текст, иначе → светлый текст
    return luminance > 0.5 ? CONFIG.COLORS.DARK_TEXT : CONFIG.COLORS.LIGHT_TEXT;
  } catch (error) {
    console.warn('Ошибка определения контраста для цвета:', backgroundColor);
    // Fallback на черный текст
    return CONFIG.COLORS.DARK_TEXT;
  }
}

/**
 * Определяет оптимальный цвет акцента для подчеркивания
 * На светлых фонах возвращает brandColor, на темных - белый
 */
function getAccentColorForBackground(backgroundColor, brandColor) {
  try {
    const { r, g, b } = hexToRgb(backgroundColor);
    const luminance = getLuminance(r, g, b);
    
    // На темных фонах акцент должен быть светлым
    return luminance > 0.5 ? brandColor : CONFIG.COLORS.LIGHT_TEXT;
  } catch (error) {
    console.warn('Ошибка определения акцентного цвета:', backgroundColor);
    return brandColor;
  }
}

// ================== HELPERS ==================
function getFontStyle(fontConfig) {
  const fontCSS = `${fontConfig.weight} ${fontConfig.size}px Arial`;
  const lineHeight = Math.round(fontConfig.size * fontConfig.lineHeightRatio);
  return { fontCSS, lineHeight };
}

function buildFont(weight, size) {
  return `${weight} ${size}px Arial`;
}

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
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(avatarImage, x, y, size, size);
  ctx.restore();
}

// ================== HANGING WORDS PROCESSOR ==================
/**
 * Обрабатывает висячие предлоги в тексте, заменяя обычные пробелы 
 * после них на неразрывные пробелы
 */
function fixHangingWords(text) {
  if (!text) return text;
  
  const hangingWords = [
    'и', 'а', 'но', 'да', 'или', 'либо', 'то', 'не', 'ни', 
    'за', 'для', 'без', 'при', 'про', 'под', 'над', 'через', 'между', 
    'из', 'от', 'до', 'на', 'в', 'с', 'у', 'о', 'об', 'во', 'со', 'ко',
    'что', 'как', 'где', 'когда', 'если', 'чтобы', 'который', 'которая'
  ];
  
  let result = text;
  
  hangingWords.forEach(word => {
    // Ищем предлог + пробел + следующее слово
    // \b - граница слова, \s+ - один или более пробелов
    const regex = new RegExp(`\\b${word}\\s+`, 'gi');
    result = result.replace(regex, `${word}\u00A0`); // \u00A0 = неразрывный пробел
  });
  
  return result;
}
/**
 * Поддержка:
 * __подчеркнуто__
 * **жирно**
 * __**жирно+подчеркнуто**__
 * Остальное — plain
 */
function parseInline(raw) {
  if (!raw) return [];
  const tokens = [];
  // Группа: __**...**__ | __...__ | **...** | обычный текст (без *_ )
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
/**
 * wrapSegments:
 * - Получает массив сегментов [{text, bold, underline}]
 * - Возвращает массив lines: [{runs: [segments], width}]
 * - Разбивает превышающие слова посимвольно
 */
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

  // Собираем все слова из всех сегментов
  const allWords = [];
  for (const seg of segments) {
    // ИЗМЕНЕНО: разбиваем по обычным пробелам, но НЕ по неразрывным (\u00A0)
    const words = seg.text.split(/[ \t\n]+/).filter(w => w.trim());
    words.forEach(word => {
      allWords.push({ ...seg, text: word });
    });
  }

  for (let i = 0; i < allWords.length; i++) {
    const word = allWords[i];
    ctx.font = buildFont(word.bold ? 'bold' : 'normal', baseFontSize);
    const wordWidth = ctx.measureText(word.text).width;
    const spaceWidth = ctx.measureText(' ').width;

    // Проверяем поместится ли слово
    const needSpace = currentRuns.length > 0;
    const totalWidth = currentWidth + (needSpace ? spaceWidth : 0) + wordWidth;

    if (totalWidth <= maxWidth) {
      // Помещается - добавляем
      if (needSpace) {
        currentRuns.push({ ...word, text: ' ' });
        currentWidth += spaceWidth;
      }
      currentRuns.push(word);
      currentWidth += wordWidth;
    } else {
      // Не помещается
      if (wordWidth > maxWidth) {
        // Слово слишком длинное - дробим по символам (но сохраняем неразрывные пробелы)
        let chunk = '';
        for (const ch of word.text) {
          const chWidth = ctx.measureText(ch).width;
          if (currentWidth + chWidth > maxWidth && chunk) {
            currentRuns.push({ ...word, text: chunk });
            pushLine();
            chunk = ch;
            currentWidth = chWidth;
          } else {
            chunk += ch;
            currentWidth += chWidth;
          }
        }
        if (chunk) {
          currentRuns.push({ ...word, text: chunk });
        }
      } else {
        // Переносим на новую строку
        pushLine();
        currentRuns.push(word);
        currentWidth = wordWidth;
      }
    }
  }

  pushLine();
  return lines;
}

// ================== RICH TEXT RENDER ==================
/**
 * renderRichText:
 *  - rawText: строка
 *  - возвращает количество строк (для смещения y)
 */
function renderRichText(ctx, rawText, x, startY, maxWidth, fontConf, baseColor, accentColor, slideIsAccent) {
  if (!rawText) return 0;

  // НОВОЕ: Обрабатываем висячие предлоги ДО parsing
  const processedText = fixHangingWords(rawText);

  const { size: baseFontSize, lineHeightRatio } = fontConf;
  const lineHeight = Math.round(baseFontSize * lineHeightRatio);

  const segments = parseInline(processedText);
  ctx.font = buildFont('normal', baseFontSize);
  const lines = wrapSegments(ctx, segments, maxWidth, baseFontSize);

  const underlineStrokes = [];
  let y = startY;

  for (const line of lines) {
    let cursorX = x;

    for (const run of line.runs) {
      let txt = run.text;
      // НОВОЕ: Преобразуем неразрывные пробелы обратно в обычные для отображения
      txt = txt.replace(/\u00A0/g, ' ');
      
      const isSpace = /^\s+$/.test(txt);
      const weight = run.bold ? 'bold' : 'normal';
      ctx.font = buildFont(weight, baseFontSize);

      // УЛУЧШЕННАЯ ЛОГИКА: акцентный цвет только для __**текста**__ на белых слайдах
      const useAccent = run.underline && run.bold && !slideIsAccent;
      ctx.fillStyle = useAccent ? accentColor : baseColor;

      if (!isSpace) {
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(txt, cursorX, y);
        // Подчёркивание
        if (run.underline) {
          const metrics = ctx.measureText(txt);
          const underlineY = y + (metrics.actualBoundingBoxDescent || baseFontSize * 0.15) - 2;
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

  // Отрисовываем подчеркивания поверх
  ctx.lineWidth = Math.max(3, Math.round(baseFontSize * 0.045));
  underlineStrokes.forEach(st => {
    ctx.strokeStyle = st.color;
    ctx.beginPath();
    ctx.moveTo(st.x1, st.y);
    ctx.lineTo(st.x2, st.y);
    ctx.stroke();
  });

  return lines.length;
}

// ================== MARKDOWN PARSE ==================
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

  // Объединяем
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

  return slides;
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
function renderIntroSlide(ctx, slide, contentY, contentWidth) {
  const titleStyle = getFontStyle(CONFIG.FONTS.TITLE_INTRO);
  ctx.font = titleStyle.fontCSS;
  ctx.textAlign = 'left';
  const titleLines = wrapPlainForIntro(ctx, slide.title || '', contentWidth);
  let y = contentY;

  titleLines.forEach(line => {
    ctx.fillText(line, CONFIG.CANVAS.PADDING, y);
    y += titleStyle.lineHeight;
  });

  if (slide.text) {
    const subtitleStyle = getFontStyle(CONFIG.FONTS.SUBTITLE_INTRO);
    ctx.font = subtitleStyle.fontCSS;
    ctx.globalAlpha = 0.9;
    y += CONFIG.SPACING.H2_TO_P;
    const lines = wrapPlainForIntro(ctx, slide.text, contentWidth);
    lines.forEach(line => {
      ctx.fillText(line, CONFIG.CANVAS.PADDING, y);
      y += subtitleStyle.lineHeight;
    });
    ctx.globalAlpha = 1;
  }
}

function wrapPlainForIntro(ctx, text, maxWidth) {
  if (!text) return [];
  
  // НОВОЕ: Обрабатываем висячие предлоги и для intro слайдов
  const processedText = fixHangingWords(text);
  const cleanText = processedText.replace(/[*_]/g, '');
  
  // Разбиваем по обычным пробелам, НЕ по неразрывным
  const words = cleanText.split(/[ \t\n]+/).filter(w => w.trim());
  const lines = [];
  let line = '';
  
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    const testForMeasure = test.replace(/\u00A0/g, ' '); // Заменяем для измерения
    
    if (ctx.measureText(testForMeasure).width <= maxWidth) {
      line = test;
    } else {
      if (line) {
        // Преобразуем неразрывные пробелы обратно для отображения
        lines.push(line.replace(/\u00A0/g, ' '));
      }
      line = w;
    }
  }
  if (line) {
    lines.push(line.replace(/\u00A0/g, ' '));
  }
  return lines;
}

function renderTextSlide(ctx, slide, contentY, contentWidth, brandColor) {
  let y = contentY;
  // Title
  if (slide.title) {
    const titleStyle = getFontStyle(CONFIG.FONTS.TITLE_TEXT_WITH_CONTENT);
    ctx.font = titleStyle.fontCSS;
    ctx.textAlign = 'left';
    const lines = wrapPlainForIntro(ctx, slide.title, contentWidth);
    lines.forEach(l => {
      ctx.fillText(l, CONFIG.CANVAS.PADDING, y);
      y += titleStyle.lineHeight;
    });
    y += CONFIG.SPACING.H2_TO_P;
  }

  if (slide.text) {
    const baseFont = CONFIG.FONTS.TEXT;
    const paragraphs = slide.text.split('\n').filter(l => l.trim());

    paragraphs.forEach((rawLine, idx) => {
      const isBullet = rawLine.trim().startsWith('•');
      let lineText = rawLine.trim();
      let x = CONFIG.CANVAS.PADDING;
      let maxW = contentWidth;

      if (isBullet) {
        // Рендер маркера
        const marker = '→';
        ctx.font = buildFont('bold', baseFont.size);
        ctx.fillText(marker, x, y);
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
        slide.color === 'accent'
      );

      y += usedLines * Math.round(baseFont.size * baseFont.lineHeightRatio);
      if (idx !== paragraphs.length - 1) {
        y += CONFIG.SPACING.P_TO_P;
      }
    });
  }
}

function renderQuoteSlide(ctx, slide, contentY, contentHeight, contentWidth) {
  ctx.textAlign = 'left';
  const isSmall = slide.size === 'small';
  const quoteFont = isSmall ? CONFIG.FONTS.QUOTE_SMALL : CONFIG.FONTS.QUOTE_LARGE;
  const { fontCSS, lineHeight } = getFontStyle(quoteFont);
  ctx.font = fontCSS;

  const lines = wrapPlainForIntro(ctx, slide.text || '', contentWidth);
  let y = contentY + (contentHeight - lines.length * lineHeight) / 2;
  lines.forEach(l => {
    ctx.fillText(l, CONFIG.CANVAS.PADDING, y);
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

  const canvas = createCanvas(CONFIG.CANVAS.WIDTH, CONFIG.CANVAS.HEIGHT);
  const ctx = canvas.getContext('2d');

  // Background
  const isAccent = slide.color === 'accent';
  const bgColor = isAccent ? brandColor : CONFIG.COLORS.DEFAULT_BG;
  
  // 🎨 НОВАЯ ЛОГИКА: автоматический контраст
  const textColor = isAccent ? getContrastColor(brandColor) : CONFIG.COLORS.DEFAULT_TEXT;
  const accentColorForText = getAccentColorForBackground(CONFIG.COLORS.DEFAULT_BG, brandColor);

  console.log(`🎨 Слайд ${slideNumber}: фон=${bgColor}, текст=${textColor}, акцент=${accentColorForText}`);

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
  const headerFooter = getFontStyle(CONFIG.FONTS.HEADER_FOOTER);
  ctx.font = headerFooter.fontCSS;
  ctx.globalAlpha = 0.7;
  ctx.textAlign = 'left';

  const avatarSize = 100;
  const avatarPadding = 16;

  if (avatarImage) {
    const textBaseline = CONFIG.CANVAS.HEADER_FOOTER_PADDING;
    const avatarY = textBaseline - avatarSize / 2 - 9;
    renderAvatar(ctx, avatarImage, CONFIG.CANVAS.PADDING, avatarY, avatarSize);
    ctx.fillText(authorUsername, CONFIG.CANVAS.PADDING + avatarSize + avatarPadding, CONFIG.CANVAS.HEADER_FOOTER_PADDING);
  } else {
    ctx.fillText(authorUsername, CONFIG.CANVAS.PADDING, CONFIG.CANVAS.HEADER_FOOTER_PADDING);
  }

  ctx.textAlign = 'right';
  ctx.fillText(`${slideNumber}/${totalSlides}`, CONFIG.CANVAS.WIDTH - CONFIG.CANVAS.PADDING, CONFIG.CANVAS.HEADER_FOOTER_PADDING);
  ctx.globalAlpha = 1;

  // Content
  const contentY = CONFIG.CANVAS.CONTENT_START_Y;
  const contentHeight = CONFIG.CANVAS.HEIGHT - contentY - CONFIG.CANVAS.HEADER_FOOTER_PADDING;
  const contentWidth = CONFIG.CANVAS.WIDTH - (CONFIG.CANVAS.PADDING * 2);

  if (slide.type === 'intro') {
    renderIntroSlide(ctx, slide, contentY, contentWidth);
  } else if (slide.type === 'text') {
    renderTextSlide(ctx, slide, contentY, contentWidth, accentColorForText);
  } else if (slide.type === 'quote') {
    renderQuoteSlide(ctx, slide, contentY, contentHeight, contentWidth);
  }

  // Footer
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

// ================== EXPRESS APP ==================
const app = express();
app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => {
  res.json({
    status: 'production-ready',
    engine: 'canvas-api-auto-contrast',
    performance: 'optimized',
    memory: 'efficient'
  });
});

app.post('/api/generate-carousel', async (req, res) => {
  const startTime = Date.now();
  try {
    const { text, settings = {} } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Требуется текст' });
    }

    // Логирование входящего brandColor для дебага
    console.log('🎨 Входящий brandColor:', settings.brandColor);

    // Аватарка (один раз)
    let avatarImage = null;
    if (settings.avatarUrl) {
      avatarImage = await loadAvatarImage(settings.avatarUrl);
    }

    // Парсинг + финальный слайд
    let slides = parseMarkdownToSlides(text);
    slides = addFinalSlide(slides, settings);

    if (!slides.length) {
      slides.push({
        type: 'text',
        title: 'Ваш контент',
        text: text.substring(0, 200),
        color: 'default'
      });
    }

    const images = [];
    for (let i = 0; i < slides.length; i++) {
      const canvas = await renderSlideToCanvas(slides[i], i + 1, slides.length, settings, avatarImage);
      images.push(canvas.toBuffer('image/png').toString('base64'));
    }

    const processingTime = Date.now() - startTime;
    res.json({
      slides,
      images,
      metadata: {
        totalSlides: slides.length,
        generatedAt: new Date().toISOString(),
        processingTime,
        settings,
        engine: 'canvas-api-auto-contrast'
      }
    });
  } catch (e) {
    console.error('Ошибка генерации:', e);
    res.status(500).json({ error: e.message });
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
  console.log(`🎨 Автоматический контраст текста готов!`);
});
