const testWithLists = `# Что даёт правильная автоматизация бизнеса

## Основные преимущества

- Экономия до 40% времени на рутинных операциях
- Снижение количества человеческих ошибок  
- Возможность работать 24/7 без выходных
- Масштабирование без пропорционального роста штата
- Фокус на стратегии вместо операционки
- Улучшение качества обслуживания клиентов

> Автоматизация — это не роскошь, а необходимость

## Простой пример из практики

Вместо того чтобы вручную обрабатывать каждую заявку:
- Настройте автоматическую сортировку по критериям
- Система сама определяет приоритет
- Назначает ответственного  
- Отправляет уведомления

Результат: то, что раньше занимало 2 часа, теперь происходит за 5 минут.`;

fetch('http://localhost:3001/api/generate-carousel', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: testWithLists,
    settings: {
      brandColor: '#6366F1',
      authorUsername: '@business_guru',
      authorFullName: 'Эксперт по автоматизации'
    }
  })
}).then(r => r.json()).then(result => {
  const fs = require('fs');
  const path = require('path');
  
  const outputDir = path.join(__dirname, 'enhanced-carousel');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  result.images.forEach((image, i) => {
    const filename = `enhanced_slide_${i + 1}_${result.slides[i].type}.png`;
    fs.writeFileSync(path.join(outputDir, filename), Buffer.from(image, 'base64'));
    console.log(`💾 ${filename}`);
  });

  console.log(`✅ Создано ${result.metadata.totalSlides} слайдов с поддержкой списков!`);
}).catch(console.error);
