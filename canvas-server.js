console.log('🎯 ФИНАЛЬНАЯ ПРОДАКШН ВЕРСИЯ - Canvas API с эмодзи');

const express = require('express');
const { marked } = require('marked');
const { createCanvas, registerFont } = require('canvas');

const app = express();
app.use(express.json({ limit: '10mb' }));

// Конфигурация
const CONFIG = {
  CANVAS: {
    WIDTH: 1600,
    HEIGHT: 2000,
    PADDING: 96,
    BORDER_RADIUS: 64
  },
  FONTS: {
    TITLE_INTRO: 'bold 128px "DejaVu Sans", "Liberation Sans", "Noto Color Emoji", ui-sans-serif, system-ui, sans-serif',
    SUBTITLE_INTRO: '64px "DejaVu Sans", "Liberation Sans", "Noto Color Emoji", ui-sans-serif, system-ui, sans-serif',
    TITLE_TEXT_WITH_CONTENT: 'bold 96px "DejaVu Sans", "Liberation Sans", "Noto Color Emoji", ui-sans-serif, system-ui, sans-serif',
    TITLE_TEXT_ONLY: 'bold 136px "DejaVu Sans", "Liberation Sans", "Noto Color Emoji", ui-sans-serif, system-ui, sans-serif',
    TEXT: '56px "DejaVu Sans", "Liberation Sans", "Noto Color Emoji", ui-sans-serif, system-ui, sans-serif',
    QUOTE_LARGE: 'bold 96px "DejaVu Sans", "Liberation Sans", "Noto Color Emoji", ui-sans-serif, system-ui, sans-serif',
    QUOTE_SMALL: 'bold 64px "DejaVu Sans", "Liberation Sans", "Noto Color Emoji", ui-sans-serif, system-ui, sans-serif',
    HEADER_FOOTER: '40px "DejaVu Sans", "Liberation Sans", "Noto Color Emoji", ui-sans-serif, system-ui, sans-serif'
  },
  COLORS: {
    DEFAULT_BG: '#ffffff',
    DEFAULT_TEXT: '#000000',
    ACCENT_FALLBACK: '#6366F1'
  }
};

// Утилита для проверки эмодзи
function isEmoji(char) {
  const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
  return emojiRegex.test(char);
}

// УЛУЧШЕННАЯ функция переносов с поддержкой эмодзи и висячих предлогов
function wrapText(ctx, text, maxWidth, isListItem = false) {
  if (!text) return [];
  
  // Убираем лишние пробелы
  text = text.trim().replace(/\s+/g, ' ');
  
  // ТОКЕНИЗАЦИЯ: Защищаем все фразы которые нельзя разрывать
  const protectedPhrases = [];
  
  // Защищаем ВСЕ цифры с любыми символами (включая разорванные пробелами)
  text = text.replace(/(\d+)\s*([%₽$€£¥]+)/gi, (match, num, symbol) => {
    const token = `__TOKEN${protectedPhrases.length}__`;
    protectedPhrases.push(`${num}${symbol}`);
    return token;
  });
  
  // Защищаем разорванные цифры "9 5 %" 
  text = text.replace(/(\d+)\s+(\d+)\s*([%₽$€£¥]+)/gi, (match, num1, num2, symbol) => {
    const token = `__TOKEN${protectedPhrases.length}__`;
    protectedPhrases.push(`${num1}${num2}${symbol}`);
    return token;
  });
  
  // Защищаем цифры с единицами времени/измерения
  text = text.replace(/(\d+)\s+(час|часа|часов|минут|минуты|секунд|секунды|дня|дней|недель|недели|месяцев|месяца|лет|года|годов|км|м|см|мм|кг|г|мг)/gi, (match, num, unit) => {
    const token = `__TOKEN${protectedPhrases.length}__`;
    protectedPhrases.push(`${num} ${unit}`);
    return token;
  });
  
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  // Расширенный список висячих предлогов
  const hangingWords = [
    'и', 'а', 'но', 'да', 'или', 'либо', 'то', 'не', 'ни', 
    'за', 'для', 'без', 'при', 'про', 'под', 'над', 'через', 'между', 
    'из', 'от', 'до', 'на', 'в', 'с', 'у', 'о', 'об', 'во', 'со', 'ко',
    'что', 'как', 'где', 'когда', 'если', 'чтобы', 'который', 'которая'
  ];
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const nextWord = words[i + 1];
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    
    // Проверяем ширину с учетом эмодзи
    let width;
    try {
      // Временно восстанавливаем токены для точного измерения
      let measureText = testLine;
      protectedPhrases.forEach((phrase, index) => {
        measureText = measureText.replace(new RegExp(`__TOKEN${index}__`, 'g'), phrase);
      });
      width = ctx.measureText(measureText).width;
    } catch (e) {
      width = testLine.length * 30;
    }
    
    if (width <= maxWidth) {
      currentLine = testLine;
      
      // Проверка висячих предлогов
      if (nextWord && hangingWords.includes(word.toLowerCase())) {
        // Если текущее слово висячее - пытаемся забрать следующие слова
        let wordsToTake = 1;
        let testWithMultiple = currentLine;
        
        // Пытаемся взять до 3 следующих слов, пока помещается
        for (let j = 1; j <= Math.min(3, words.length - i - 1); j++) {
          const nextWords = words.slice(i + 1, i + 1 + j);
          const testMultiple = `${currentLine} ${nextWords.join(' ')}`;
          
          let widthMultiple;
          try {
            let measureTextMultiple = testMultiple;
            protectedPhrases.forEach((phrase, index) => {
              measureTextMultiple = measureTextMultiple.replace(new RegExp(`__TOKEN${index}__`, 'g'), phrase);
            });
            widthMultiple = ctx.measureText(measureTextMultiple).width;
          } catch (e) {
            widthMultiple = testMultiple.length * 30;
          }
          
          if (widthMultiple <= maxWidth) {
            testWithMultiple = testMultiple;
            wordsToTake = j;
          } else {
            break;
          }
        }
        
        if (wordsToTake > 0) {
          currentLine = testWithMultiple;
          i += wordsToTake; // Пропускаем взятые слова
        }
      }
    } else {
      // НЕ помещается - но проверяем принудительный перенос висячих слов
      if (currentLine) {
        const lastWord = currentLine.split(' ').pop();
        
        // Если последнее слово в строке висячее - переносим его
        if (lastWord && hangingWords.includes(lastWord.toLowerCase())) {
          const wordsInLine = currentLine.split(' ');
          const withoutLastWord = wordsInLine.slice(0, -1).join(' ');
          
          if (withoutLastWord) {
            lines.push(withoutLastWord);
            currentLine = `${lastWord} ${word}`; // Начинаем новую строку с висячего слова
          } else {
            lines.push(currentLine);
            currentLine = word;
          }
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      } else {
        // Очень длинное слово
        if (word.length > 25) {
          const chunks = word.match(/.{1,20}/g) || [word];
          lines.push(...chunks.slice(0, -1));
          currentLine = chunks[chunks.length - 1];
        } else {
          lines.push(word);
          currentLine = '';
        }
      }
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  // ВОССТАНАВЛИВАЕМ ТОКЕНЫ в финальных строках
  return lines.map(line => {
    let finalLine = line;
    protectedPhrases.forEach((phrase, index) => {
      finalLine = finalLine.replace(new RegExp(`__TOKEN${index}__`, 'g'), phrase);
    });
    
    return finalLine
      .replace(/\s{2,}/g, ' ')
      .trim();
  });
}

function parseMarkdownToSlides(text) {
  // Исправляем разорванные цифры СРАЗУ в исходном тексте
  text = text
    .replace(/(\d+)\s+(\d+)\s*([%₽$€£¥])/gi, '$1$2$3') // "9 5 %" → "95%"
    .replace(/(\d+)\s+([%₽$€£¥])/gi, '$1$2');           // "95 %" → "95%"
  
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

  // Объединяем контент И исправляем цифры в каждом слайде
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
    
    // Дополнительная очистка для каждого слайда
    if (slide.title) {
      slide.title = slide.title
        .replace(/(\d+)\s+(\d+)\s*([%₽$€£¥])/gi, '$1$2$3')
        .replace(/(\d+)\s+([%₽$€£¥])/gi, '$1$2');
    }
    if (slide.text) {
      slide.text = slide.text
        .replace(/(\d+)\s+(\d+)\s*([%₽$€£¥])/gi, '$1$2$3')
        .replace(/(\d+)\s+([%₽$€£¥])/gi, '$1$2');
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
  
  // Включаем сглаживание для лучшего качества эмодзи
  ctx.textRenderingOptimization = 'optimizeQuality';
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
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
  
  // Header
  ctx.font = CONFIG.FONTS.HEADER_FOOTER;
  ctx.globalAlpha = 0.7;
  ctx.textAlign = 'left';
  ctx.fillText(authorUsername, CONFIG.CANVAS.PADDING, CONFIG.CANVAS.PADDING + 40);
  ctx.textAlign = 'right';
  ctx.fillText(`${slideNumber}/${totalSlides}`, CONFIG.CANVAS.WIDTH - CONFIG.CANVAS.PADDING, CONFIG.CANVAS.PADDING + 40);
  ctx.globalAlpha = 1;

  // Content area
  const contentY = 300;
  const contentHeight = 1400;
  const contentWidth = CONFIG.CANVAS.WIDTH - (CONFIG.CANVAS.PADDING * 2);
  
  if (slide.type === 'intro') {
    renderIntroSlide(ctx, slide, contentY, contentHeight, contentWidth);
  } else if (slide.type === 'text') {
    renderTextSlide(ctx, slide, contentY, contentWidth);
  } else if (slide.type === 'quote') {
    renderQuoteSlide(ctx, slide, contentY, contentHeight, contentWidth);
  }

  // Footer
  ctx.font = CONFIG.FONTS.HEADER_FOOTER;
  ctx.globalAlpha = 0.7;
  ctx.textAlign = 'left';
  ctx.fillText(authorFullName, CONFIG.CANVAS.PADDING, CONFIG.CANVAS.HEIGHT - CONFIG.CANVAS.PADDING);
  ctx.textAlign = 'right';
  if (slideNumber < totalSlides) {
    ctx.fillText('→', CONFIG.CANVAS.WIDTH - CONFIG.CANVAS.PADDING, CONFIG.CANVAS.HEIGHT - CONFIG.CANVAS.PADDING);
  }
  ctx.globalAlpha = 1;

  return canvas;
}

function renderIntroSlide(ctx, slide, contentY, contentHeight, contentWidth) {
  ctx.textAlign = 'center';
  
  // Заголовок
  ctx.font = CONFIG.FONTS.TITLE_INTRO;
  const titleLines = wrapText(ctx, slide.title || '', contentWidth);
  let y = contentY + (contentHeight - titleLines.length * 140 - (slide.text ? 120 : 0)) / 2;
  
  titleLines.forEach(line => {
    ctx.fillText(line, CONFIG.CANVAS.WIDTH / 2, y);
    y += 140;
  });

  // Подзаголовок
  if (slide.text) {
    ctx.font = CONFIG.FONTS.SUBTITLE_INTRO;
    ctx.globalAlpha = 0.9;
    y += 64;
    const subtitleLines = wrapText(ctx, slide.text, contentWidth);
    subtitleLines.forEach(line => {
      ctx.fillText(line, CONFIG.CANVAS.WIDTH / 2, y);
      y += 80;
    });
    ctx.globalAlpha = 1;
  }
}

function renderTextSlide(ctx, slide, contentY, contentWidth) {
  let y = contentY;
  
  // Заголовок (БЕЗ extremeCleanText)
  if (slide.title) {
    const hasText = slide.text && slide.text.trim();
    ctx.font = hasText ? CONFIG.FONTS.TITLE_TEXT_WITH_CONTENT : CONFIG.FONTS.TITLE_TEXT_ONLY;
    ctx.textAlign = 'left';
    
    const titleLines = wrapText(ctx, slide.title, contentWidth);
    titleLines.forEach(line => {
      ctx.fillText(line, CONFIG.CANVAS.PADDING, y);
      y += hasText ? 120 : 160;
    });
    
    if (hasText) y += 64;
  }

  // Текст (БЕЗ extremeCleanText)
  if (slide.text) {
    ctx.font = CONFIG.FONTS.TEXT;
    ctx.textAlign = 'left';
    
    const textLines = slide.text.split('\n');
    
    textLines.forEach(line => {
      if (line.trim().startsWith('•')) {
        // Логика для списков
        const itemText = line.replace(/^•\s*/, '');
        
        // Рендерим буллет
        const bulletX = CONFIG.CANVAS.PADDING;
        ctx.fillText('•', bulletX, y);
        
        // Вычисляем отступ для текста
        const bulletWidth = ctx.measureText('• ').width;
        const textX = bulletX + bulletWidth;
        const availableWidth = contentWidth - bulletWidth;
        
        const wrappedLines = wrapText(ctx, itemText, availableWidth, true);
        
        wrappedLines.forEach((wrappedLine, index) => {
          ctx.fillText(wrappedLine, textX, y + (index * 72));
        });
        
        y += wrappedLines.length * 72;
        
      } else if (line.trim()) {
        // Обычный текст
        const wrappedLines = wrapText(ctx, line.trim(), contentWidth);
        wrappedLines.forEach(wrappedLine => {
          ctx.fillText(wrappedLine, CONFIG.CANVAS.PADDING, y);
          y += 72;
        });
      } else {
        // Пустая строка
        y += 32;
      }
    });
  }
}

function renderQuoteSlide(ctx, slide, contentY, contentHeight, contentWidth) {
  ctx.textAlign = 'center';
  
  const isSmall = slide.size === 'small';
  ctx.font = isSmall ? CONFIG.FONTS.QUOTE_SMALL : CONFIG.FONTS.QUOTE_LARGE;
  
  const quoteLines = wrapText(ctx, slide.text || '', contentWidth);
  const lineHeight = isSmall ? 84 : 120;
  let y = contentY + (contentHeight - quoteLines.length * lineHeight) / 2;
  
  quoteLines.forEach(line => {
    ctx.fillText(line, CONFIG.CANVAS.WIDTH / 2, y);
    y += lineHeight;
  });
}

// API Routes
app.get('/health', (req, res) => {
  res.json({ 
    status: 'production-ready',
    engine: 'canvas-api-with-emoji',
    performance: 'optimized',
    memory: 'efficient',
    features: ['emoji-support', 'smart-wrapping', 'hanging-prevention']
  });
});

app.post('/api/generate-carousel', async (req, res) => {
  const startTime = Date.now();
  console.log('🎯 Генерация через Canvas API с поддержкой эмодзи...');
  
  try {
    const { text, settings = {} } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Требуется текст' });
    }

    // Проверяем наличие эмодзи в тексте
    const hasEmoji = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(text);
    console.log(`📝 Обнаружены эмодзи: ${hasEmoji ? 'да' : 'нет'}`);

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
      try {
        const canvas = renderSlideToCanvas(slides[i], i + 1, slides.length, settings);
        const base64 = canvas.toBuffer('image/png').toString('base64');
        images.push(base64);
        console.log(`✅ Слайд ${i + 1} готов`);
      } catch (slideError) {
        console.error(`❌ Ошибка при рендеринге слайда ${i + 1}:`, slideError.message);
        // Создаем fallback слайд при ошибке
        const fallbackCanvas = createCanvas(CONFIG.CANVAS.WIDTH, CONFIG.CANVAS.HEIGHT);
        const fallbackCtx = fallbackCanvas.getContext('2d');
        fallbackCtx.fillStyle = '#ffffff';
        fallbackCtx.fillRect(0, 0, CONFIG.CANVAS.WIDTH, CONFIG.CANVAS.HEIGHT);
        fallbackCtx.fillStyle = '#000000';
        fallbackCtx.font = '48px Arial';
        fallbackCtx.textAlign = 'center';
        fallbackCtx.fillText('Ошибка рендеринга', CONFIG.CANVAS.WIDTH / 2, CONFIG.CANVAS.HEIGHT / 2);
        const fallbackBase64 = fallbackCanvas.toBuffer('image/png').toString('base64');
        images.push(fallbackBase64);
      }
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
        engine: 'canvas-api-production-emoji',
        features: {
          emojiSupport: true,
          smartWrapping: true,
          hangingPrevention: true,
          hasEmoji
        }
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

// Дополнительный endpoint для тестирования эмодзи
app.post('/api/test-emoji', async (req, res) => {
  try {
    const testText = "🚀 Тест эмодзи: 🎯 💪 ✨ 📱 🔥 💡 🎨 ⚡";
    
    const canvas = createCanvas(800, 200);
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 800, 200);
    
    ctx.fillStyle = '#000000';
    ctx.font = '48px "DejaVu Sans", "Liberation Sans", "Noto Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(testText, 400, 100);
    
    const base64 = canvas.toBuffer('image/png').toString('base64');
    
    res.json({
      success: true,
      testText,
      image: base64,
      message: 'Эмодзи тест завершен'
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
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
  console.log(`🚀 PRODUCTION Canvas API с эмодзи на порту ${PORT}`);
  console.log(`⚡ Готов к высоким нагрузкам`);
  console.log(`🎯 Фичи: эмодзи, умные переносы, предотвращение висячих предлогов`);
});
