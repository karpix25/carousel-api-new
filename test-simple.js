console.log('�� Тестируем API...');

async function test() {
  try {
    console.log('📡 Отправляем запрос...');
    
    const response = await fetch('http://localhost:3001/api/generate-carousel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Тестовый текст' })
    });
    
    console.log('📨 Статус ответа:', response.status);
    
    const result = await response.json();
    console.log('✅ Результат:', result);
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
}

test();
