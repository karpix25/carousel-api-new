console.log('🎨 Запуск сервера с оригинальными стилями...');

const express = require('express');
const puppeteer = require('puppeteer');
const { marked } = require('marked');

const app = express();
app.use(express.json());

// Генератор абстрактных паттернов (как в оригинале)
function generatePattern(style = 'default') {
  const configs = {
    default: { size: 480, growth: 3, edges: 18 },
    bright: { size: 480, growth: 7, edges: 14 },
    elegant: { size: 480, growth: 5, edges: 17 }
  };
  
  const config = configs[style];
  const points = [];
  const centerX = config.size / 2;
  const radius = config.size / 2;
  
  // Генерируем точки для плавной формы
  for (let i = 0; i < config.edges; i++) {
    const angle = (i * 360) / config.edges;
    const variation = (Math.random() - 0.5) * config.growth * 10;
    const r = radius + variation;
    const x = centerX + r * Math.cos((angle * Math.PI) / 180);
    const y = centerX + r * Math.sin((angle * Math.PI) / 180);
    points.push([x, y]);
  }
  
  // Создаем SVG путь с плавными кривыми
  let path = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    const nextNext = points[(i + 2) % points.length];
    
    const midX = (next[0] + nextNext[0]) / 2;
    const midY = (next[1] + nextNext[1]) / 2;
    
    path += `Q${next[0]},${next[1]},${midX},${midY}`;
  }
  path += 'Z';
  
  return `<svg viewBox="0 0 ${config.size} ${config.size}"><path d="${path}" /></svg>`;
}

// Умный парсер markdown (как в оригинале)
function parseMarkdownToSlides(text) {
  const tokens = marked.lexer(text);
  const slides = [];
  
  tokens.forEach((token, index) => {
    if (token.type === 'heading' && token.depth === 1) {
      // Intro слайд
      const nextToken = tokens[index + 1];
      const subtitle = (nextToken && nextToken.type === 'paragraph') ? nextToken.text : '';
      
      slides.push({
        type: 'intro',
        title: token.text,
        text: subtitle,
        color: 'default',
        showAbstraction: true
      });
    } else if (token.type === 'heading' && token.depth === 2) {
      // Текстовый слайд
      slides.push({
        type: 'text',
        title: token.text,
        text: '',
        color: 'default'
      });
    } else if (token.type === 'blockquote') {
      // Цитата
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
    } else if (token.type === 'paragraph' && slides.length > 0) {
      // Добавляем текст к последнему слайду
      slides[slides.length - 1].text = token.text;
    }
  });
  
  return slides;
}

// HTML генератор с правильной типографикой
function createSlideHTML(slide, slideNumber, totalSlides, settings) {
  const {
    style = 'default',
    brandColor = '#2F00FF',
    authorUsername = '@carousel_api',
    authorFullName = 'Carousel API'
  } = settings;
  
  // Цветовые схемы
  const colorSchemes = {
    default: { bg: '#ffffff', text: '#000000' },
    accent: { bg: brandColor, text: '#ffffff' }
  };
  
  const colors = colorSchemes[slide.color] || colorSchemes.default;
  
  // Генерируем абстрактные формы
  const showShapeOne = (slide.type === 'intro' || slide.type === 'quote') && slide.showAbstraction;
  const showShapeTwo = showShapeOne && style === 'bright';
  
  const shapeOne = showShapeOne ? generatePattern(style) : '';
  const shapeTwo = showShapeTwo ? generatePattern(style) : '';
  
  // Контент в зависимости от типа слайда
  let content = '';
  switch (slide.type) {
    case 'intro':
      content = `
        ${slide.title ? `<h1>${slide.title}</h1>` : ''}
        ${slide.text ? `<p class="intro-subtitle">${slide.text}</p>` : ''}
      `;
      break;
    case 'text':
      content = `
        ${slide.title ? `<h2>${slide.title}</h2>` : ''}
        ${slide.text ? `<div class="text-content">${marked(slide.text)}</div>` : ''}
      `;
      break;
    case 'quote':
      const quoteClass = slide.size ? `quote--${slide.size}` : 'quote--large';
      content = `<div class="quote-content ${quoteClass}">${marked(slide.text || '')}</div>`;
      break;
  }
  
  return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
        * {
            box-sizing: border-box;
            -webkit-font-smoothing: antialiased;
            margin: 0;
            padding: 0;
        }

        html, body {
            width: 1080px;
            height: 1080px;
            overflow: hidden;
        }

        .slide-wrapper {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            gap: 36px;
            padding: 48px 36px;
            font-family: 'Inter', sans-serif;
            overflow: hidden;
            height: 1080px;
            width: 1080px;
            position: relative;
            background: ${colors.bg};
            color: ${colors.text};
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
            font-size: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            height: 20px;
            max-height: 20px;
            z-index: 10;
        }

        /* Типографика как в оригинале */
        .slide-content.intro h1 {
            font-size: 56px;
            font-weight: 600;
            text-align: center;
            line-height: 1.1;
            margin-bottom: 24px;
        }

        .slide-content.intro .intro-subtitle {
            font-size: 24px;
            text-align: center;
            opacity: 0.8;
            line-height: 1.4;
        }

        .slide-content.text h2 {
            font-size: 32px;
            font-weight: 600;
            line-height: 1.2;
            margin-bottom: 20px;
        }

        .slide-content.text .text-content {
            font-size: 18px;
            line-height: 1.4;
        }

        .slide-content.text .text-content p {
            margin-bottom: 16px;
        }

        .slide-content.text .text-content p:last-child {
            margin-bottom: 0;
        }

        .slide-content.text .text-content ul, 
        .slide-content.text .text-content ol {
            font-size: 18px;
            padding-left: 20px;
            margin: 16px 0;
        }

        .slide-content.text .text-content li {
            margin-bottom: 12px;
            line-height: 1.4;
        }

        .slide-content.quote {
            text-align: center;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .quote-content {
            max-width: 800px;
        }

        .quote--large {
            font-size: 42px;
            line-height: 1.2;
            font-weight: 500;
        }

        .quote--medium {
            font-size: 32px;
            line-height: 1.3;
            font-weight: 500;
        }

        .quote--small {
            font-size: 24px;
            line-height: 1.4;
            font-weight: 400;
        }

        /* Абстрактные формы как в оригинале */
        .slide-shape {
            position: absolute;
            opacity: 0.1;
            z-index: 1;
            pointer-events: none;
        }

        .slide-shape svg {
            width: 100%;
            height: 100%;
        }

        .slide-shape svg path {
            fill: ${colors.text};
        }

        .slide-shape--one {
            top: -240px;
            right: -240px;
            width: 480px;
            height: 480px;
        }

        .slide-shape--two {
            bottom: -240px;
            left: -240px;
            width: 480px;
            height: 480px;
            opacity: 0.05;
        }

        .style--bright .slide-shape {
            opacity: 0.15;
        }

        .style--bright .slide-shape--two {
            opacity: 0.08;
        }

        .style--elegant .slide-shape {
            opacity: 0.08;
        }
    </style>
</head>
<body>
    <div class="slide-wrapper style--${style}">
        ${showShapeOne ? `<div class="slide-shape slide-shape--one">${shapeOne}</div>` : ''}
        ${showShapeTwo ? `<div class="slide-shape slide-shape--two">${shapeTwo}</div>` : ''}

        <div class="slide-header">
            <span>${authorUsername}</span>
            <span>${slideNumber}/${totalSlides}</span>
        </div>

        <div class="slide-content ${slide.type}">
            ${content}
        </div>

        <div class="slide-footer">
            <span>${authorFullName}</span>
            <span>${slideNumber < totalSlides ? '→' : '🎉'}</span>
        </div>
    </div>
</body>
</html>`;
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', features: ['typography', 'patterns', 'smart-parsing'] });
});

app.post('/api/generate-carousel', async (req, res) => {
  console.log('🎨 Генерируем карусель с оригинальными стилями...');
  
  try {
    const { text, settings = {} } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Требуется текст' });
    }

    // Парсим markdown в слайды
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

    // Запускаем браузер
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const images = [];

    for (let i = 0; i < slides.length; i++) {
      console.log(`🖼️ Рендерим слайд ${i + 1}/${slides.length} (${slides[i].type})`);
      
      const html = createSlideHTML(slides[i], i + 1, slides.length, settings);
      
      const page = await browser.newPage();
      await page.setViewport({ 
        width: 1080, 
        height: 1080,
        deviceScaleFactor: 4 // Высокое качество
      });
      
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      // Ждем загрузки шрифтов
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(500);
      
      const screenshot = await page.screenshot({
        type: 'png',
        encoding: 'base64',
        fullPage: false
      });
      
      images.push(screenshot);
      await page.close();
      
      console.log(`✅ Слайд ${i + 1} готов`);
    }

    await browser.close();
    console.log('🎉 Карусель сгенерирована с оригинальными стилями!');

    res.json({
      slides,
      images,
      metadata: {
        totalSlides: slides.length,
        generatedAt: new Date().toISOString(),
        settings,
        features: ['smart-parsing', 'typography', 'patterns', 'color-schemes']
      }
    });

  } catch (error) {
    console.error('❌ Ошибка:', error);
    res.status(500).json({
      error: 'Ошибка генерации',
      details: error.message
    });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🚀 Стилизованный сервер запущен на http://localhost:${PORT}`);
  console.log(`🎨 Включены: типографика, паттерны, умный парсинг`);
});
