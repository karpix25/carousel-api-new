const fs = require('fs');
const path = require('path');

console.log('🖼️ Тестируем генерацию реальных изображений...');

async function testRealImages() {
  try {
    const testText = `# Моя первая карусель

Это демонстрация API для создания красивых карточек из обычного текста.

## Возможности системы

- Автоматическая верстка контента
- Красивая типографика  
- Разные стили слайдов
- Высокое качество изображений

> "Хороший дизайн говорит сам за себя"

Попробуйте создать свои карточки!`;

    console.log('📡 Отправляем запрос с текстом...');
    const startTime = Date.now();

    const response = await fetch('http://localhost:3001/api/generate-carousel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: testText })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    const processingTime = Date.now() - startTime;

    console.log('✅ Карточки сгенерированы!');
    console.log(`📊 Слайдов: ${result.metadata.totalSlides}`);
    console.log(`⏱️ Время: ${processingTime}мс`);

    // Создаем папку для сохранения
    const outputDir = path.join(__dirname, 'generated-images');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Сохраняем каждое изображение
    result.images.forEach((imageBase64, index) => {
      const filename = `carousel_slide_${index + 1}.png`;
      const filepath = path.join(outputDir, filename);
      
      const buffer = Buffer.from(imageBase64, 'base64');
      fs.writeFileSync(filepath, buffer);
      
      const sizeKB = Math.round(buffer.length / 1024);
      console.log(`💾 Сохранен: ${filename} (${sizeKB}KB)`);
    });

    console.log(`\n🎉 Готово! Откройте папку: generated-images`);
    console.log('📱 Ваши карточки готовы!');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
}

testRealImages();
