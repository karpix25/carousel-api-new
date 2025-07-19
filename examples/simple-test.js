const API_URL = 'http://localhost:3000';

const testMarkdown = `# Добро пожаловать

Это тестовая карусель

## Первый слайд

Содержимое первого слайда с текстом.

> Это цитата для проверки

## Второй слайд

Еще один слайд с информацией.`;

async function testAPI() {
  console.log('🧪 Testing Carousel API...\n');

  try {
    // Health check
    console.log('1. Health check...');
    const healthResponse = await fetch(`${API_URL}/health`);
    const health = await healthResponse.json();
    console.log('✅ Health:', health.status);

    // Get styles
    console.log('\n2. Getting available styles...');
    const stylesResponse = await fetch(`${API_URL}/api/styles`);
    const styles = await stylesResponse.json();
    console.log('✅ Styles:', styles.styles.map(s => s.name).join(', '));

    // Preview slides
    console.log('\n3. Previewing slides...');
    const previewResponse = await fetch(`${API_URL}/api/preview-slides`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: testMarkdown })
    });
    const preview = await previewResponse.json();
    console.log('✅ Generated slides:');
    preview.slides.forEach((slide, i) => {
      console.log(`   ${i + 1}. ${slide.type}: "${slide.title || slide.text.substring(0, 30)}..."`);
    });

    console.log('\n🎉 All tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Make sure the API server is running:');
      console.log('   npm run dev');
    }
  }
}

testAPI();
