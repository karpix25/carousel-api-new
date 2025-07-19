console.log('🚀 Запуск сервера с генерацией изображений...');

const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', features: ['image-generation'] });
});

app.post('/api/generate-carousel', async (req, res) => {
  console.log('🎨 Начинаем генерацию изображений...');
  
  try {
    const { text = 'Тестовый текст' } = req.body;
    
    // Создаем HTML для слайда
    function createSlideHTML(content, slideNum, total, bgColor = '#ffffff', textColor = '#000000') {
      return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            width: 1080px;
            height: 1080px;
            background: ${bgColor};
            color: ${textColor};
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            padding: 60px;
        }
        .header { 
            display: flex; 
            justify-content: space-between; 
            align-items: center;
            font-size: 14px;
            opacity: 0.8;
        }
        .content { 
            flex-grow: 1; 
            display: flex; 
            align-items: center; 
            justify-content: center;
            text-align: center;
        }
        .footer { 
            display: flex; 
            justify-content: space-between; 
            align-items: center;
            font-size: 14px;
            opacity: 0.8;
        }
        h1 { 
            font-size: 56px; 
            font-weight: 700;
            line-height: 1.1;
            margin-bottom: 20px;
        }
        .quote { 
            font-size: 36px; 
            font-weight: 500;
            line-height: 1.3;
            font-style: italic;
            max-width: 800px;
        }
        .text-content {
            font-size: 28px;
            line-height: 1.4;
            max-width: 900px;
        }
    </style>
</head>
<body>
    <div class="header">
        <span>@carousel_api</span>
        <span>${slideNum}/${total}</span>
    </div>
    <div class="content">
        ${content}
    </div>
    <div class="footer">
        <span>Carousel API Demo</span>
        <span>${slideNum < total ? '→' : '🎉'}</span>
    </div>
</body>
</html>`;
    }

    // Создаем разные типы слайдов
    const slides = [
      {
        html: createSlideHTML('<h1>🎠 Carousel API</h1><div class="text-content">Генерация красивых карточек из текста</div>', 1, 3),
        type: 'intro'
      },
      {
        html: createSlideHTML(`<div class="text-content">📝 Ваш текст:<br/><br/><strong>"${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"</strong></div>`, 2, 3),
        type: 'text'
      },
      {
        html: createSlideHTML('<div class="quote">"Каждый текст может стать красивой презентацией"</div>', 3, 3, '#2F00FF', '#ffffff'),
        type: 'quote'
      }
    ];

    console.log('📸 Запускаем браузер...');
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security'
      ]
    });

    const images = [];

    for (let i = 0; i < slides.length; i++) {
      console.log(`🖼️ Рендерим слайд ${i + 1}/${slides.length}...`);
      
      const page = await browser.newPage();
      await page.setViewport({ 
        width: 1080, 
        height: 1080,
        deviceScaleFactor: 2 // Для лучшего качества
      });
      
      await page.setContent(slides[i].html, { 
        waitUntil: 'domcontentloaded'
      });
      
      // Небольшая пауза для рендеринга
      await page.waitForTimeout(500);
      
      const screenshot = await page.screenshot({
        type: 'png',
        encoding: 'base64',
        fullPage: false
      });
      
      images.push(screenshot);
      await page.close();
      
      console.log(`✅ Слайд ${i + 1} готов (${Math.round(Buffer.from(screenshot, 'base64').length / 1024)}KB)`);
    }

    await browser.close();
    console.log('🎉 Все изображения сгенерированы!');

    res.json({
      slides: slides.map((slide, i) => ({
        type: slide.type,
        slideNumber: i + 1,
        size: `${Math.round(Buffer.from(images[i], 'base64').length / 1024)}KB`
      })),
      images,
      metadata: {
        totalSlides: slides.length,
        generatedAt: new Date().toISOString(),
        inputText: text.substring(0, 50) + '...'
      }
    });

  } catch (error) {
    console.error('❌ Ошибка генерации:', error);
    res.status(500).json({
      error: 'Ошибка генерации изображений',
      details: error.message
    });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🚀 Сервер с изображениями запущен на http://localhost:${PORT}`);
  console.log(`🎨 Готов к генерации карточек!`);
});
