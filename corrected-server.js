console.log('🔧 Исправленная версия с правильной версткой и умными переносами...');

const express = require('express');
const puppeteer = require('puppeteer');
const { marked } = require('marked');

const app = express();
app.use(express.json());

// Функция для умных переносов строк
function intelligentTextWrap(text, maxWidth = 35, preserveGroups = true) {
  if (!text || text.length <= maxWidth) return text;
  
  // Группы слов, которые нужно держать вместе
  const keepTogether = [
    /\d+\s*(час|часа|часов|минут|минуты|секунд|секунды|дня|дней|недель|недели|месяцев|месяца|лет|года|годов)/gi,
    /\d+%/g,
    /\d+\/\d+/g,
    /без\s+пропорционального/gi,
    /роста\s+штата/gi,
    /масштабирование\s+без/gi,
    /пропорционального\s+роста/gi,
    /\w+\s+практики/gi,
    /\w+\s+стратегии/gi,
    /\w+\s+качества/gi,
    /автоматизация\s+\w+/gi,
    /качественные\s+\w+/gi,
    /эффективные\s+\w+/gi
  ];
  
  // Маркируем группы специальными токенами
  let processedText = text;
  const tokens = [];
  
  keepTogether.forEach((pattern, index) => {
    processedText = processedText.replace(pattern, (match) => {
      const token = `__TOKEN${index}_${tokens.length}__`;
      tokens.push({ token, text: match });
      return token;
    });
  });
  
  // Разбиваем на слова
  const words = processedText.split(/\s+/);
  const lines = [];
  let currentLine = '';
  
  words.forEach(word => {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    
    if (testLine.length <= maxWidth || currentLine === '') {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  });
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  // Восстанавливаем токены
  let result = lines.join('\n');
  tokens.forEach(({ token, text }) => {
    result = result.replace(new RegExp(token, 'g'), text);
  });
  
  return result;
}

// Функция для обработки текста слайдов с умными переносами
function processSlideText(text, slideType = 'text') {
  if (!text) return '';
  
  const lines = text.split('\n');
  const processedLines = lines.map(line => {
    if (line.trim().startsWith('•')) {
      // Элемент списка
      const itemText = line.replace(/^•\s*/, '');
      const wrappedText = intelligentTextWrap(itemText, 32);
      return `<div class="list-item">• ${parseWithCorrectAccents(wrappedText)}</div>`;
    } else if (line.trim()) {
      // Обычный текст с умными переносами
      const wrappedText = intelligentTextWrap(line.trim(), 35);
      return `<div class="text-line">${parseWithCorrectAccents(wrappedText)}</div>`;
    } else {
      return '<div class="text-spacer"></div>';
    }
  });
  
  return processedLines.join('');
}

// Исправленный парсер с правильными подчеркиваниями
function parseWithCorrectAccents(text) {
  let html = marked(text);
  
  // Убираем лишние <p> теги из marked для лучшего контроля
  html = html.replace(/<\/?p>/g, '');
  
  // Цветовые акценты для чисел и времени
  html = html.replace(/(\d+%|\d+\/\d+|\d+\s*(час|часа|минут|секунд|дня?|недел|месяц|год))/gi, '<span class="accent-blue">$1</span>');
  
  // Специальные ключевые слова с подчеркиванием
  html = html.replace(/(практики|стратегии|качества)/gi, '<span class="accent-blue underline-double">$1</span>');
  
  // Обычные ключевые слова без подчеркивания
  html = html.replace(/(автоматизация|автоматизацию|необходимость)/gi, '<span class="accent-blue">$1</span>');
  
  return html;
}

function generateSmoothShape(style = 'default') {
  const paths = {
    default: `M 100,25 Q 200,50 300,75 Q 350,100 380,150 Q 350,200 300,275 Q 200,350 100,325 Q 50,250 25,175 Q 50,100 100,25`,
    bright: `M 80,80 Q 180,40 280,80 Q 330,120 360,160 Q 320,220 260,280 Q 180,340 100,320 Q 40,260 60,200 Q 80,140 80,80`,
    elegant: `M 90,60 Q 190,80 290,70 Q 340,110 370,150 Q 330,210 270,270 Q 190,330 110,310 Q 60,260 80,200 Q 100,140 90,60`
  };
  return paths[style] || paths.default;
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
        color: 'accent',
        showAbstraction: true
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
      const textLength = quoteText.length;
      
      let size = 'large';
      if (textLength > 140) size = 'small';
      else if (textLength > 100) size = 'medium';
      
      slides.push({
        type: 'quote',
        text: quoteText,
        color: 'accent',
        showAbstraction: true,
        size
      });
    } 
    else if (currentSlide && (token.type === 'paragraph' || token.type === 'list')) {
      if (token.type === 'paragraph') {
        currentSlide.content.push({
          type: 'paragraph',
          text: token.text
        });
      } else if (token.type === 'list') {
        currentSlide.content.push({
          type: 'list',
          items: token.items.map(item => item.text),
          ordered: token.ordered
        });
      }
    }
  });

  // Правильно объединяем контент
  slides.forEach(slide => {
    if (slide.content) {
      const paragraphs = slide.content.filter(c => c.type === 'paragraph').map(c => c.text);
      const lists = slide.content.filter(c => c.type === 'list');
      
      let fullText = '';
      
      // Добавляем параграфы
      if (paragraphs.length > 0) {
        fullText += paragraphs.join('\n\n');
      }
      
      // Добавляем списки
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

function createCorrectedHTML(slide, slideNumber, totalSlides, settings) {
  const {
    style = 'default',
    brandColor = '#6366F1',
    authorUsername = '@username',
    authorFullName = 'Твоё имя или подпись'
  } = settings;
  
  const colors = slide.color === 'accent' 
    ? { bg: brandColor, text: '#ffffff' }
    : { bg: '#ffffff', text: '#000000' };
  
  const shapePath = generateSmoothShape(style);
  const showShape = (slide.type === 'intro' || slide.type === 'quote') && slide.showAbstraction;
  
  // Правильные размеры заголовков
  let titleSize, textSize;
  
  if (slide.type === 'text') {
    if (slide.text && slide.text.trim()) {
      titleSize = '24px';
      textSize = '14px';
    } else {
      titleSize = '34px';
      textSize = '16px';
    }
  }
  
  let content = '';
  switch (slide.type) {
    case 'intro':
      content = `
        ${slide.title ? `<h1>${slide.title}</h1>` : ''}
        ${slide.text ? `<p class="intro-subtitle">${slide.text}</p>` : ''}
      `;
      break;
    case 'text':
      const processedTitle = slide.title ? intelligentTextWrap(parseWithCorrectAccents(slide.title), 40) : '';
      
      // Используем новую функцию для обработки текста с умными переносами
      let processedText = '';
      if (slide.text) {
        processedText = processSlideText(slide.text, 'text');
      }
      
      content = `
        ${slide.title ? `<h2 style="font-size: ${titleSize}; margin-bottom: ${slide.text ? '16px' : '0'};">${processedTitle}</h2>` : ''}
        ${slide.text ? `<div class="text-content" style="font-size: ${textSize};">${processedText}</div>` : ''}
      `;
      break;
    case 'quote':
      const quoteClass = slide.size ? `quote--${slide.size}` : 'quote--large';
      content = `<div class="quote-content ${quoteClass}">${parseWithCorrectAccents(slide.text || '')}</div>`;
      break;
  }

  return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * {
            box-sizing: border-box;
            -webkit-font-smoothing: antialiased;
            margin: 0;
            padding: 0;
        }

        html, body {
            width: 400px;
            height: 500px;
            overflow: hidden;
        }

        .slide-wrapper {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            padding: 24px;
            font-family: 'Inter', sans-serif;
            overflow: hidden;
            height: 500px;
            width: 400px;
            position: relative;
            background: ${colors.bg};
            color: ${colors.text};
            border-radius: 16px;
        }

        .smooth-shape {
            position: absolute;
            top: 0;
            right: 0;
            width: 100%;
            height: 100%;
            opacity: 0.08;
            z-index: 1;
            overflow: hidden;
            border-radius: 16px;
        }

        .smooth-shape svg {
            width: 110%;
            height: 110%;
            transform: translate(20px, -20px);
        }

        .smooth-shape path {
            fill: none;
            stroke: ${colors.text};
            stroke-width: 2;
            opacity: 0.4;
        }

        .slide-content {
            position: relative;
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            z-index: 10;
        }

        .slide-header, .slide-footer {
            font-size: 10px;
            font-weight: 400;
            display: flex;
            justify-content: space-between;
            align-items: center;
            height: 16px;
            z-index: 10;
            opacity: 0.7;
        }

        /* Типографика для intro */
        .slide-content.intro h1 {
            font-size: 32px;
            font-weight: 700;
            line-height: 1.1;
            margin-bottom: 16px;
            letter-spacing: -0.02em;
        }

        .slide-content.intro .intro-subtitle {
            font-size: 16px;
            font-weight: 300;
            line-height: 1.4;
            opacity: 0.9;
        }

        /* Исправленная типографика для текстовых слайдов */
        .slide-content.text h2 {
            font-weight: 600;
            line-height: 1.2;
            letter-spacing: -0.01em;
            white-space: pre-line;
            word-wrap: break-word;
            hyphens: manual;
            overflow-wrap: break-word;
            word-break: keep-all;
        }

        .slide-content.text .text-content {
            font-weight: 400;
            line-height: 1.5;
            word-spacing: 0.05em;
        }

        /* Улучшенные стили для текста и списков с умными переносами */
        .text-line {
            margin-bottom: 8px;
            white-space: pre-line;
            word-wrap: break-word;
            hyphens: manual;
            overflow-wrap: break-word;
            word-break: keep-all;
        }

        .text-spacer {
            height: 8px;
        }

        .list-item {
            margin-bottom: 6px;
            line-height: 1.4;
            white-space: pre-line;
            word-wrap: break-word;
            hyphens: manual;
            overflow-wrap: break-word;
            word-break: keep-all;
        }

        /* Цитаты */
        .slide-content.quote {
            text-align: center;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .quote--large {
            font-size: 24px;
            line-height: 1.2;
            font-weight: 600;
            letter-spacing: -0.01em;
        }

        .quote--medium {
            font-size: 20px;
            line-height: 1.3;
            font-weight: 500;
        }

        .quote--small {
            font-size: 16px;
            line-height: 1.4;
            font-weight: 400;
        }

        /* Исправленные акценты с запретом переносов */
        .accent-blue {
            color: ${colors.bg === '#ffffff' ? brandColor : '#87CEEB'};
            font-weight: 600;
            white-space: nowrap;
        }

        /* Двойное подчеркивание с запретом переносов */
        .underline-double {
            position: relative;
            text-decoration: none;
            white-space: nowrap;
        }

        .underline-double:after {
            content: '';
            position: absolute;
            bottom: -2px;
            left: 0;
            right: 0;
            height: 2px;
            background: ${colors.bg === '#ffffff' ? brandColor : '#87CEEB'};
        }

        .underline-double:before {
            content: '';
            position: absolute;
            bottom: -5px;
            left: 0;
            right: 0;
            height: 1px;
            background: ${colors.bg === '#ffffff' ? brandColor : '#87CEEB'};
        }

        .arrow {
            font-size: 12px;
            font-weight: 300;
        }
    </style>
</head>
<body>
    <div class="slide-wrapper">
        ${showShape ? `
        <div class="smooth-shape">
            <svg viewBox="0 0 400 500">
                <path d="${shapePath}" />
            </svg>
        </div>` : ''}

        <div class="slide-header">
            <span>${authorUsername}</span>
            <span>${slideNumber}/${totalSlides}</span>
        </div>

        <div class="slide-content ${slide.type}">
            ${content}
        </div>

        <div class="slide-footer">
            <span>${authorFullName}</span>
            <span class="arrow">${slideNumber < totalSlides ? '→' : ''}</span>
        </div>
    </div>
</body>
</html>`;
}

app.get('/health', (req, res) => {
  res.json({ 
    status: 'corrected', 
    fixes: ['typography', 'double-underline', 'layout', 'spacing', 'intelligent-text-wrapping']
  });
});

app.post('/api/generate-carousel', async (req, res) => {
  console.log('🔧 Генерируем исправленную карусель с умными переносами...');
  
  try {
    const { text, settings = {} } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Требуется текст' });
    }

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

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const images = [];

    for (let i = 0; i < slides.length; i++) {
      console.log(`🖼️ Рендерим исправленный слайд ${i + 1}/${slides.length}`);
      
      const html = createCorrectedHTML(slides[i], i + 1, slides.length, settings);
      
      const page = await browser.newPage();
      await page.setViewport({ 
        width: 400, 
        height: 500,
        deviceScaleFactor: 4
      });
      
      await page.setContent(html, { waitUntil: 'networkidle0' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(500);
      
      const screenshot = await page.screenshot({
        type: 'png',
        encoding: 'base64',
        fullPage: false
      });
      
      images.push(screenshot);
      await page.close();
    }

    await browser.close();
    console.log('🎉 Исправленная карусель с умными переносами готова!');

    res.json({
      slides,
      images,
      metadata: {
        totalSlides: slides.length,
        generatedAt: new Date().toISOString(),
        settings,
        fixes: ['corrected-typography', 'double-underline', 'proper-spacing', 'intelligent-text-wrapping']
      }
    });

  } catch (error) {
    console.error('❌ Ошибка:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🚀 Исправленный сервер на http://localhost:${PORT}`);
  console.log(`🔧 Исправлено: верстка, подчеркивания, отступы, умные переносы`);
});