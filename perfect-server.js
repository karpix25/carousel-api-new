console.log('🎨 Создаем ИДЕАЛЬНУЮ карусель как в оригинале...');

const express = require('express');
const puppeteer = require('puppeteer');
const { marked } = require('marked');

const app = express();
app.use(express.json());

// Генератор плавных градиентных линий (как в оригинале)
function generateSmoothShape(style = 'default') {
  const paths = {
    default: `M 200,50 Q 400,100 600,150 Q 800,200 1000,250 Q 800,400 600,550 Q 400,700 200,650 Q 100,500 50,350 Q 100,200 200,50`,
    bright: `M 100,100 Q 300,50 500,100 Q 700,150 900,200 Q 800,350 600,500 Q 400,650 200,600 Q 50,450 100,300 Q 150,150 100,100`,
    elegant: `M 150,80 Q 350,120 550,100 Q 750,180 950,220 Q 850,380 650,520 Q 450,680 250,620 Q 80,480 120,320 Q 180,160 150,80`
  };
  
  return paths[style] || paths.default;
}

// Улучшенный парсер с цветовыми акцентами
function parseWithAccents(text) {
  // Выделяем числа синим цветом
  text = text.replace(/(\d+\s*(час|минут|секунд|дня?|недел|месяц|год))/gi, '<span class="accent-blue">$1</span>');
  
  // Выделяем ключевые слова
  text = text.replace(/(автоматизация|роскошь|реальной|практики|необходимость)/gi, '<span class="accent-blue">$1</span>');
  
  // Подчеркиваем важные слова
  text = text.replace(/\b(не\s+роскошь)\b/gi, '<span class="underline">$1</span>');
  
  return marked(text);
}

function createPerfectHTML(slide, slideNumber, totalSlides, settings) {
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
        ${slide.title ? `<h2>${parseWithAccents(slide.title)}</h2>` : ''}
        ${slide.text ? `<div class="text-content">${parseWithAccents(slide.text)}</div>` : ''}
      `;
      break;
    case 'quote':
      const quoteClass = slide.size ? `quote--${slide.size}` : 'quote--large';
      content = `<div class="quote-content ${quoteClass}">${parseWithAccents(slide.text || '')}</div>`;
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
            width: 1080px;
            height: 1080px;
            overflow: hidden;
        }

        .slide-wrapper {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            padding: 60px;
            font-family: 'Inter', sans-serif;
            overflow: hidden;
            height: 1080px;
            width: 1080px;
            position: relative;
            background: ${colors.bg};
            color: ${colors.text};
        }

        /* Плавные абстрактные формы */
        .smooth-shape {
            position: absolute;
            top: 0;
            right: 0;
            width: 100%;
            height: 100%;
            opacity: 0.1;
            z-index: 1;
            overflow: hidden;
        }

        .smooth-shape svg {
            width: 120%;
            height: 120%;
            transform: translate(50px, -50px);
        }

        .smooth-shape path {
            fill: none;
            stroke: ${colors.text};
            stroke-width: 3;
            opacity: 0.3;
        }

        .slide-content {
            position: relative;
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            z-index: 10;
            max-width: 900px;
        }

        .slide-header, .slide-footer {
            font-size: 16px;
            font-weight: 400;
            display: flex;
            justify-content: space-between;
            align-items: center;
            height: 24px;
            z-index: 10;
            opacity: 0.8;
        }

        /* Идеальная типографика */
        .slide-content.intro h1 {
            font-size: 72px;
            font-weight: 700;
            line-height: 1.1;
            margin-bottom: 40px;
            letter-spacing: -0.02em;
        }

        .slide-content.intro .intro-subtitle {
            font-size: 32px;
            font-weight: 300;
            line-height: 1.4;
            opacity: 0.9;
        }

        .slide-content.text h2 {
            font-size: 48px;
            font-weight: 600;
            line-height: 1.2;
            margin-bottom: 40px;
            letter-spacing: -0.01em;
        }

        .slide-content.text .text-content {
            font-size: 24px;
            font-weight: 400;
            line-height: 1.5;
        }

        .slide-content.text .text-content p {
            margin-bottom: 24px;
        }

        .slide-content.quote {
            text-align: center;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .quote--large {
            font-size: 56px;
            line-height: 1.2;
            font-weight: 600;
            letter-spacing: -0.01em;
        }

        .quote--medium {
            font-size: 42px;
            line-height: 1.3;
            font-weight: 500;
        }

        .quote--small {
            font-size: 32px;
            line-height: 1.4;
            font-weight: 400;
        }

        /* Цветовые акценты */
        .accent-blue {
            color: ${colors.bg === '#ffffff' ? brandColor : '#87CEEB'};
            font-weight: 600;
        }

        .underline {
            text-decoration: underline;
            text-decoration-thickness: 3px;
            text-underline-offset: 8px;
        }

        /* Стрелка */
        .arrow {
            font-size: 24px;
            font-weight: 300;
        }
    </style>
</head>
<body>
    <div class="slide-wrapper">
        ${showShape ? `
        <div class="smooth-shape">
            <svg viewBox="0 0 1080 1080">
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
  res.json({ status: 'perfect', version: 'original-style' });
});

app.post('/api/generate-carousel', async (req, res) => {
  console.log('🎨 Генерируем ИДЕАЛЬНУЮ карусель...');
  
  try {
    const { text, settings = {} } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Требуется текст' });
    }

    // Умный парсинг
    const tokens = marked.lexer(text);
    const slides = [];
    
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
      } else if (token.type === 'heading' && token.depth === 2) {
        slides.push({
          type: 'text',
          title: token.text,
          text: '',
          color: 'default'
        });
      } else if (token.type === 'blockquote') {
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
        slides[slides.length - 1].text = token.text;
      }
    });

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const images = [];

    for (let i = 0; i < slides.length; i++) {
      console.log(`🖼️ Создаем ИДЕАЛЬНЫЙ слайд ${i + 1}/${slides.length}`);
      
      const html = createPerfectHTML(slides[i], i + 1, slides.length, settings);
      
      const page = await browser.newPage();
      await page.setViewport({ 
        width: 1080, 
        height: 1080,
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
    console.log('🎉 ИДЕАЛЬНАЯ карусель готова!');

    res.json({
      slides,
      images,
      metadata: {
        totalSlides: slides.length,
        generatedAt: new Date().toISOString(),
        settings,
        version: 'perfect-original-style'
      }
    });

  } catch (error) {
    console.error('❌ Ошибка:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`�� ИДЕАЛЬНЫЙ сервер запущен на http://localhost:${PORT}`);
  console.log(`✨ Стиль: точь-в-точь как оригинал`);
});
