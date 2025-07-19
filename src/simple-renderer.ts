import fs from 'fs';
import path from 'path';

interface SlideData {
  type: string;
  title?: string;
  text: string;
  color: string;
}

export class SimpleRenderer {
  generateSlideHTML(slide: SlideData, slideNumber: number, totalSlides: number): string {
    const content = this.generateContent(slide);
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            width: 1080px;
            height: 1080px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: ${slide.color === 'accent' ? '#2F00FF' : '#ffffff'};
            color: ${slide.color === 'accent' ? '#ffffff' : '#000000'};
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            padding: 48px;
        }
        .header { font-size: 12px; display: flex; justify-content: space-between; }
        .content { flex-grow: 1; display: flex; flex-direction: column; justify-content: center; }
        .footer { font-size: 12px; display: flex; justify-content: space-between; }
        h1 { font-size: 48px; text-align: center; margin-bottom: 24px; }
        h2 { font-size: 32px; margin-bottom: 20px; }
        p { font-size: 18px; line-height: 1.4; margin-bottom: 16px; }
        .quote { font-size: 32px; text-align: center; font-style: italic; }
    </style>
</head>
<body>
    <div class="header">
        <span>@username</span>
        <span>${slideNumber}/${totalSlides}</span>
    </div>
    <div class="content">
        ${content}
    </div>
    <div class="footer">
        <span>Full Name</span>
        <span>${slideNumber < totalSlides ? '→' : ''}</span>
    </div>
</body>
</html>`;
  }

  generateContent(slide: SlideData): string {
    switch (slide.type) {
      case 'intro':
        return `<h1>${slide.title || ''}</h1><p style="text-align: center; font-size: 24px;">${slide.text}</p>`;
      case 'text':
        return `<h2>${slide.title || ''}</h2><p>${slide.text}</p>`;
      case 'quote':
        return `<div class="quote">"${slide.text}"</div>`;
      default:
        return `<p>${slide.text}</p>`;
    }
  }
}
