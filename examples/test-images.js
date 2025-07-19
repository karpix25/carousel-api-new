const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3001'; // Изменили порт

const testMarkdown = `# Моя презентация

Добро пожаловать в мир карусельного контента

## Основные принципы

В этом разделе мы рассмотрим ключевые аспекты создания качественного контента для социальных сетей.

> Хороший контент — это мост между брендом и аудиторией`;

async function testImageGeneration() {
  console.log('🖼️ Testing image generation...\n');

  try {
    console.log('📝 Generating carousel with images...');
    const startTime = Date.now();

    const response = await fetch(`${API_URL}/api/generate-carousel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: testMarkdown,
        settings: {
          style: 'default',
          brandColor: '#2F00FF'
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`API Error: ${error.error}`);
    }

    const result = await response.json();
    const processingTime = Date.now() - startTime;

    console.log('✅ Carousel generated successfully!');
    console.log(`📊 Slides: ${result.metadata.totalSlides}`);
    console.log(`⏱️ Processing time: ${processingTime}ms`);

    // Create output directory
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save images
    result.images.forEach((imageBase64, index) => {
      const filename = `slide_${index + 1}.png`;
      const filepath = path.join(outputDir, filename);
      
      const buffer = Buffer.from(imageBase64, 'base64');
      fs.writeFileSync(filepath, buffer);
      
      console.log(`💾 Saved: ${filename} (${Math.round(buffer.length / 1024)}KB)`);
    });

    console.log(`\n📁 All files saved to: ${outputDir}`);
    console.log(`🖼️ Open the PNG files to see your carousel!`);

    return result;

  } catch (error) {
    console.error('❌ Image generation failed:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Make sure the API server is running on port 3001:');
      console.log('   npm run dev');
    }
  }
}

testImageGeneration();
