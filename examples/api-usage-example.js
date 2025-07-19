/**
 * Example of using the Carousel API
 * This script demonstrates how to generate a carousel from markdown text
 */

const fs = require('fs');
const path = require('path');

// Configuration
const API_BASE_URL = 'http://localhost:3000/api';

// Sample markdown content
const sampleMarkdown = `# Добро пожаловать в мой блог

Это введение в серию статей о разработке

## Глава 1: Основы

В этой главе мы рассмотрим основные принципы современной разработки:

- Чистый код
- Тестирование
- Документация
- Командная работа

## Глава 2: Практические советы

> Лучший код — это тот, который не нужно писать

Практические рекомендации для ежедневной работы разработчика.

## Заключение

Надеюсь, эта информация будет полезной для вашего развития!`;

/**
 * Generate carousel from markdown
 */
async function generateCarousel() {
  try {
    console.log('🚀 Generating carousel...');
    
    const response = await fetch(`${API_BASE_URL}/generate-carousel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: sampleMarkdown,
        settings: {
          style: 'default',
          brandColor: '#2F00FF',
          authorUsername: '@developer',
          authorFullName: 'Amazing Developer',
          maxSlides: 'auto',
          quality: 'high'
        }
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`API Error: ${error.error?.message || 'Unknown error'}`);
    }

    const result = await response.json();
    
    console.log('✅ Carousel generated successfully!');
    console.log(`📊 Generated ${result.metadata.totalSlides} slides`);
    console.log(`⏱️  Processing time: ${result.metadata.processingTime}ms`);
    
    // Save images to files
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    result.images.forEach((imageBase64, index) => {
      const filename = `slide_${index + 1}.png`;
      const filepath = path.join(outputDir, filename);
      
      // Convert base64 to buffer and save
      const buffer = Buffer.from(imageBase64, 'base64');
      fs.writeFileSync(filepath, buffer);
      
      console.log(`💾 Saved: ${filename}`);
    });

    // Save slide data as JSON
    const slidesData = {
      slides: result.slides,
      metadata: result.metadata
    };
    
    fs.writeFileSync(
      path.join(outputDir, 'slides_data.json'),
      JSON.stringify(slidesData, null, 2)
    );

    console.log(`📁 All files saved to: ${outputDir}`);
    return result;

  } catch (error) {
    console.error('❌ Error generating carousel:', error.message);
    throw error;
  }
}

/**
 * Preview slides without generating images (faster)
 */
async function previewSlides() {
  try {
    console.log('👀 Previewing slides...');
    
    const response = await fetch(`${API_BASE_URL}/preview-slides`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: sampleMarkdown,
        settings: {
          maxSlides: 'auto'
        }
      }),
    });

    const result = await response.json();
    
    console.log('📋 Slide preview:');
    result.slides.forEach((slide, index) => {
      console.log(`\n${index + 1}. ${slide.type.toUpperCase()} SLIDE`);
      if (slide.title) console.log(`   Title: "${slide.title}"`);
      console.log(`   Text: "${slide.text.substring(0, 50)}..."`);
      console.log(`   Color: ${slide.color}`);
    });

    console.log(`\n📊 Statistics:`);
    console.log(`   Total words: ${result.stats.wordCount}`);
    console.log(`   Total characters: ${result.stats.charCount}`);
    console.log(`   Block types:`, result.stats.blockTypes);

    return result;

  } catch (error) {
    console.error('❌ Error previewing slides:', error.message);
    throw error;
  }
}

/**
 * Get available styles
 */
async function getAvailableStyles() {
  try {
    const response = await fetch(`${API_BASE_URL}/styles`);
    const result = await response.json();
    
    console.log('🎨 Available styles:');
    result.styles.forEach(style => {
      console.log(`\n• ${style.name} (${style.id})`);
      console.log(`  ${style.description}`);
    });

    return result;

  } catch (error) {
    console.error('❌ Error fetching styles:', error.message);
    throw error;
  }
}

/**
 * Test pattern generation
 */
async function testPatterns() {
  try {
    console.log('🔮 Testing pattern generation...');
    
    const styles = ['default', 'bright', 'elegant'];
    
    for (const style of styles) {
      const response = await fetch(`${API_BASE_URL}/test-pattern/${style}`);
      const result = await response.json();
      
      console.log(`\n${style.toUpperCase()} style patterns:`);
      result.patterns.forEach((pattern, index) => {
        console.log(`  Pattern ${index + 1}: seed ${pattern.seed}`);
      });
    }

  } catch (error) {
    console.error('❌ Error testing patterns:', error.message);
    throw error;
  }
}

/**
 * Main function - demonstrates all API features
 */
async function main() {
  console.log('🎠 Carousel API Example\n');

  try {
    // 1. Check available styles
    await getAvailableStyles();
    console.log('\n' + '='.repeat(50) + '\n');

    // 2. Preview slides structure
    await previewSlides();
    console.log('\n' + '='.repeat(50) + '\n');

    // 3. Test pattern generation
    await testPatterns();
    console.log('\n' + '='.repeat(50) + '\n');

    // 4. Generate full carousel
    await generateCarousel();

    console.log('\n🎉 Example completed successfully!');

  } catch (error) {
    console.error('\n💥 Example failed:', error.message);
    process.exit(1);
  }
}

// Run example if called directly
if (require.main === module) {
  main();
}

module.exports = {
  generateCarousel,
  previewSlides,
  getAvailableStyles,
  testPatterns,
};