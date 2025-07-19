const fs = require('fs');
const path = require('path');

async function testStyledCarousel() {
  console.log('🎨 Тестируем стилизованную карусель...');
  
  const richText = `# Секреты продуктивности

Как достичь больших результатов с меньшими усилиями

## Принцип 80/20

20% усилий дают 80% результата. Найдите эти ключевые 20% в своей работе.

## Метод помидора

- Работайте 25 минут без отвлечений
- Делайте 5-минутные перерывы
- После 4 циклов — длинный перерыв

> "Совершенство — это не когда уже нечего добавить, а когда уже нечего убрать"

## Планирование дня

Начинайте с самых важных задач, когда энергия на пике.`;

  try {
    const response = await fetch('http://localhost:3001/api/generate-carousel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: richText,
        settings: {
          style: 'default',
          brandColor: '#6366F1',
          authorUsername: '@productivity_guru',
          authorFullName: 'Эксперт по продуктивности'
        }
      })
    });

    const result = await response.json();
    
    console.log(`✅ Создано ${result.metadata.totalSlides} стилизованных слайдов`);
    
    // Сохраняем
    const outputDir = path.join(__dirname, 'styled-carousel');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    result.images.forEach((image, i) => {
      const filename = `styled_slide_${i + 1}_${result.slides[i].type}.png`;
      fs.writeFileSync(path.join(outputDir, filename), Buffer.from(image, 'base64'));
      console.log(`💾 ${filename}`);
    });

    console.log(`\n🎉 Стилизованная карусель в папке: styled-carousel`);

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
}

testStyledCarousel();
