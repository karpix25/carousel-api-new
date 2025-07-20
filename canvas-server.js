/**
 * Canvas Carousel API
 * Continuous underline across spaces (lower typographic position)
 * CommonJS version
 */
console.log('🎯 ФИНАЛЬНАЯ ПРОДАКШН ВЕРСИЯ - Canvas API (continuous underline across spaces)');

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
    H2_TO_P: 80,
    P_TO_P: 24
  },
  COLORS: {
    DEFAULT_BG: '#ffffff',
    DEFAULT_TEXT: '#000000',
    ACCENT_FALLBACK: '#6366F1'
  }
};

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

// ================== INLINE PARSER ==================
function parseInline(raw) {
  if (!raw) return [];
  const tokens = [];
  const regex = /(__\*\*.+?\*\*__|__.+?__|\*\*.+?\*\*|[^*_]+)/g;
  let m;
  while ((m = regex.exec(raw)) !== null) {
    let chunk = m[0];
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
  // Merge смежных одинаковых
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

// ================== WRAP ==================
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
      ctx.font = buildFont(seg.bold ? 'bold' : 'normal', baseFontSize);
      const w = ctx.measureText(part).width;

      if (!isSpace && currentWidth + w > maxWidth) {
        if (w > maxWidth) {
          // посимвольное разбиение очень длинного слова
          let chunk = '';
          for (const ch of part) {
            const chW = ctx.measureText(ch).width;
            if (currentWidth + chW > maxWidth && chunk) {
              currentRuns.push({ ...seg, text: chunk });
              pushLine();
              chunk = ch;
              continue;
            }
            chunk += ch;
            currentWidth += chW;
          }
          if (chunk) currentRuns.push({ ...seg, text: chunk });
          continue;
        }
        pushLine();
        if (isSpace) continue;
        currentRuns.push({ ...seg, text: part });
        currentWidth = w;
      } else {
        currentRuns.push({ ...seg, text: part });
        currentWidth += w;
      }
    }
  }
  pushLine();
  return lines;
}

// ================== RICH TEXT (continuous underline across spaces) ==================
function renderRichText(ctx, rawText, x, startY, maxWidth, fontConf, baseColor, accentColor, slideIsAccent) {
  if (!rawText) return 0;
  const { size: baseFontSize, lineHeightRatio } = fontConf;
  const lineHeight = Math.round(baseFontSize * lineHeightRatio);

  const segments = parseInline(rawText);
  ctx.font = buildFont('normal', baseFontSize);
  const lines = wrapSegments(ctx, segments, maxWidth, baseFontSize);

  const underlineStrokes = [];
  let y = startY;

  for (const line of lines) {
    let cursorX = x;
    let activeSpan = null; // {x1,x2,y,color}
    let maxDescentInSpan = 0;

    for (const run of line.runs) {
      const txt = run.text;
      const isSpace = /^\s+$/.test(txt);
      ctx.font = buildFont(run.bold ? 'bold' : 'normal', baseFontSize);

      const useAccent = run.underline && run.bold && !slideIsAccent;
      ctx.fillStyle = useAccent ? accentColor : baseColor;
      ctx.textBaseline = 'alphabetic';

      if (!isSpace) {
        ctx.fillText(txt, cursorX, y);
      }

      const metrics = ctx.measureText(txt);
      const segWidth = metrics.width;
      const descent = metrics.actualBoundingBoxDescent || baseFontSize * 0.25;

      if (run.underline) {
        if (!activeSpan) {
          // начинаем новый непрерывный span
          maxDescentInSpan = descent;
          activeSpan = {
            x1: cursorX,
            x2: cursorX + segWidth,
            y: null,          // позже установим
            color: ctx.fillStyle
          };
        } else {
          // продолжаем span
          activeSpan.x2 = cursorX + segWidth;
          if (descent > maxDescentInSpan) maxDescentInSpan = descent;
          // если цвет сменился — закрываем прошлый и начинаем новый
          if (activeSpan.color !== ctx.fillStyle) {
            // финализируем старый с его вычисленным y
            activeSpan.y = y + maxDescentInSpan * 0.75;
            underlineStrokes.push(activeSpan);
            // новый
            activeSpan = {
              x1: cursorX,
              x2: cursorX + segWidth,
              y: null,
              color: ctx.fillStyle
            };
            maxDescentInSpan = descent;
          }
        }
      } else {
        // закрываем текущий span если был
        if (activeSpan) {
          activeSpan.y = y + maxDescentInSpan * 0.75; // 0.75 — коэффициент глубины
          underlineStrokes.push(activeSpan);
          activeSpan = null;
          maxDescentInSpan = 0;
        }
      }

      cursorX += segWidth;
    }

    if (activeSpan) {
      activeSpan.y = y + maxDescentInSpan * 0.75;
      underlineStrokes.push(activeSpan);
      activeSpan = null;
    }

    y += lineHeight;
  }

  // Рисуем
  const thickness = Math.min(10, Math.max(3, Math.round(baseFontSize * 0.055)));
  ctx.lineWidth = thickness;
  ctx.lineCap = 'round';

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

  tokens.forEach((token, idx) => {
    if (token.type === 'heading' && token.depth === 1) {
      const next = tokens[idx + 1];
      const subtitle = (next && next.type === 'paragraph') ? next.text : '';
      slides.push({ type: 'intro', title: token.text, text: subtitle, color: 'accent' });
    } else if (token.type === 'heading' && token.depth === 2) {
      currentSlide = { type: 'text', title: token.text, text: '', color: 'default', content: [] };
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
        currentSlide.content.push({ type: 'list', items: token.items.map(i => i.text) });
      }
    }
  });

  slides.forEach(slide => {
    if (slide.content) {
      const paragraphs = slide.content.filter(c => c.type === 'paragraph').map(c => c.text);
      const lists = slide.content.filter(c => c.type === 'list');
      let fullText = '';
      if (paragraphs.length) fullText += paragraphs.join('\n\n');
      if (lists.length) {
        if (fullText) fullText += '\n\n';
        lists.forEach(list => {
          fullText += list.items.map(it => `• ${it}`).join('\n');
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
  const cfg = settings.finalSlide;
  if (!cfg || !cfg.enabled) return slides;

  const templates = {
    cta: { title: 'Подписывайтесь!', text: 'Ставьте лайк если полезно\n\nБольше контента в профиле', color: 'accent' },
    contact: { title: 'Связаться со мной:', text: 'email@example.com\n\nTelegram: @username\n\nwebsite.com', color: 'default' },
    brand: { title: 'Спасибо за внимание!', text: 'Помогаю бизнесу расти\n\nКонсультации и стратегии', color: 'accent' }
  };

  let finalSlide;
  if (cfg.type && templates[cfg.type]) {
    finalSlide = {
      type: 'text',
      ...templates[cfg.type],
      ...(cfg.title && { title: cfg.title }),
      ...(cfg.text && { text: cfg.text }),
      ...(cfg.color && { color: cfg.color })
    };
  } else {
    finalSlide = {
      type: 'text',
      title: cfg.title || 'Спасибо за внимание!',
      text: cfg.text || 'Больше контента в профиле',
      color: cfg.color || 'accent'
    };
  }

  return [...slides, finalSlide];
}

// ================== SIMPLE WRAP FOR TITLES ==================
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

function renderTextSlide(ctx, slide, contentY, contentWidth, brandColor) {
  let y = contentY;
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

// ================== MAIN RENDER ==================
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
  const textColor = isAccent ? CONFIG.COLORS.DEFAULT_BG : CONFIG.COLORS.DEFAULT_TEXT;

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
  const contentWidth = CONFIG.CANVAS.WIDTH - CONFIG.CANVAS.PADDING * 2;

  if (slide.type === 'intro') {
    renderIntroSlide(ctx, slide, contentY, contentWidth);
  } else if (slide.type === 'text') {
    renderTextSlide(ctx, slide, contentY, contentWidth, brandColor);
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

// ================== EXPRESS ==================
const app = express();
app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => {
  res.json({
    status: 'production-ready',
    engine: 'canvas-api-underline-continuous',
    performance: 'optimized',
    memory: 'efficient'
  });
});

app.post('/api/generate-carousel', async (req, res) => {
  const startTime = Date.now();
  try {
    const { text, settings = {} } = req.body;
    if (!text) return res.status(400).json({ error: 'Требуется текст' });

    let avatarImage = null;
    if (settings.avatarUrl) {
      avatarImage = await loadAvatarImage(settings.avatarUrl);
    }

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
        engine: 'canvas-api-underline-continuous'
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
  console.log(`🎨 Continuous underline (across spaces) ready.`);
});
