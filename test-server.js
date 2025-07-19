console.log('Попытка запуска сервера...');

try {
  const express = require('express');
  console.log('✅ Express найден');
  
  const app = express();
  app.use(express.json());
  
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });
  
  app.post('/api/generate-carousel', (req, res) => {
    console.log('📡 Получен запрос на генерацию');
    res.json({
      slides: [{ type: 'test', text: 'Тест' }],
      images: ['test_base64_data'],
      metadata: { totalSlides: 1 }
    });
  });
  
  const PORT = 3001;
  app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
    console.log(`🏥 Проверьте: curl http://localhost:${PORT}/health`);
  });
  
} catch (error) {
  console.error('❌ Ошибка запуска:', error.message);
  console.log('💡 Попробуйте: npm install express');
}
