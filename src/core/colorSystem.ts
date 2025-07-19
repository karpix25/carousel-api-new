import { StyleType } from '../api/schemas/carousel.schema';

interface ColorScheme {
  background: string;
  text: string;
  accent: string;
  textOnAccent: string;
}

interface HSL {
  h: number;
  s: number;
  l: number;
}

export class ColorSystem {
  /**
   * Convert hex color to HSL
   */
  private static hexToHsl(hex: string): HSL {
    // Remove # if present
    const cleanHex = hex.replace('#', '');
    
    // Parse RGB values
    const r = parseInt(cleanHex.substr(0, 2), 16) / 255;
    const g = parseInt(cleanHex.substr(2, 2), 16) / 255;
    const b = parseInt(cleanHex.substr(4, 2), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h /= 6;
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100),
    };
  }

  /**
   * Convert HSL to hex color
   */
  private static hslToHex(h: number, s: number, l: number): string {
    h = h / 360;
    s = s / 100;
    l = l / 100;

    const hue2rgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    let r: number, g: number, b: number;

    if (s === 0) {
      r = g = b = l; // achromatic
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }

    const toHex = (c: number): string => {
      const hex = Math.round(c * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  /**
   * Calculate luminance of a color
   */
  private static getLuminance(hex: string): number {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substr(0, 2), 16) / 255;
    const g = parseInt(cleanHex.substr(2, 2), 16) / 255;
    const b = parseInt(cleanHex.substr(4, 2), 16) / 255;

    // Apply gamma correction
    const gamma = (c: number): number => {
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };

    return 0.2126 * gamma(r) + 0.7152 * gamma(g) + 0.0722 * gamma(b);
  }

  /**
   * Calculate contrast ratio between two colors
   */
  private static getContrastRatio(color1: string, color2: string): number {
    const lum1 = this.getLuminance(color1);
    const lum2 = this.getLuminance(color2);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    
    return (brightest + 0.05) / (darkest + 0.05);
  }

  /**
   * Determine if white or black text has better contrast
   */
  public static getContrastingTextColor(backgroundColor: string): string {
    const whiteContrast = this.getContrastRatio(backgroundColor, '#ffffff');
    const blackContrast = this.getContrastRatio(backgroundColor, '#000000');
    
    return whiteContrast > blackContrast ? '#ffffff' : '#000000';
  }

  /**
   * Generate a lighter version of a color
   */
  public static lightenColor(hex: string, amount: number = 20): string {
    const hsl = this.hexToHsl(hex);
    const newLightness = Math.min(100, hsl.l + amount);
    
    return this.hslToHex(hsl.h, hsl.s, newLightness);
  }

  /**
   * Generate a darker version of a color
   */
  public static darkenColor(hex: string, amount: number = 20): string {
    const hsl = this.hexToHsl(hex);
    const newLightness = Math.max(0, hsl.l - amount);
    
    return this.hslToHex(hsl.h, hsl.s, newLightness);
  }

  /**
   * Generate color scheme based on brand color and style
   */
  public static generateColorScheme(brandColor: string, style: StyleType): ColorScheme {
    const hsl = this.hexToHsl(brandColor);
    
    let backgroundColor: string;
    let textColor: string;
    let accentColor: string;
    let textOnAccent: string;

    switch (style) {
      case 'default':
        // Minimal style: light background, dark text
        backgroundColor = '#ffffff';
        textColor = '#000000';
        accentColor = brandColor;
        textOnAccent = this.getContrastingTextColor(brandColor);
        break;

      case 'bright':
        // Bright style: brand color background, contrasting text
        backgroundColor = brandColor;
        textColor = this.getContrastingTextColor(brandColor);
        accentColor = this.lightenColor(brandColor, 30);
        textOnAccent = this.getContrastingTextColor(accentColor);
        break;

      case 'elegant':
        // Elegant style: dark background, light text, muted accent
        backgroundColor = '#1a1a1a';
        textColor = '#ffffff';
        accentColor = this.lightenColor(brandColor, 15);
        textOnAccent = this.getContrastingTextColor(accentColor);
        break;

      default:
        backgroundColor = '#ffffff';
        textColor = '#000000';
        accentColor = brandColor;
        textOnAccent = this.getContrastingTextColor(brandColor);
    }

    return {
      background: backgroundColor,
      text: textColor,
      accent: accentColor,
      textOnAccent,
    };
  }

  /**
   * Generate CSS variables object for given colors
   */
  public static generateCSSVariables(
    brandColor: string,
    style: StyleType,
    authorUsername: string,
    authorFullName: string
  ): Record<string, string> {
    const colorScheme = this.generateColorScheme(brandColor, style);
    const lightBrandColor = this.lightenColor(brandColor, 40);
    
    return {
      '--brandColor': brandColor,
      '--brandColorLight': lightBrandColor,
      '--backgroundColor': colorScheme.background,
      '--textColor': colorScheme.text,
      '--accentColor': colorScheme.accent,
      '--textOnAccent': colorScheme.textOnAccent,
      '--authorUsername': `"${authorUsername}"`,
      '--authorFullName': `"${authorFullName}"`,
    };
  }

  /**
   * Validate hex color format
   */
  public static isValidHexColor(hex: string): boolean {
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    return hexRegex.test(hex);
  }

  /**
   * Generate harmonious color palette
   */
  public static generateHarmoniousPalette(baseColor: string): {
    primary: string;
    secondary: string;
    tertiary: string;
    accent: string;
  } {
    const hsl = this.hexToHsl(baseColor);
    
    return {
      primary: baseColor,
      secondary: this.hslToHex((hsl.h + 30) % 360, hsl.s, hsl.l),
      tertiary: this.hslToHex((hsl.h + 60) % 360, hsl.s, hsl.l),
      accent: this.hslToHex((hsl.h + 180) % 360, hsl.s, hsl.l),
    };
  }

  /**
   * Check if color meets WCAG accessibility standards
   */
  public static meetsWCAGStandards(
    backgroundColor: string,
    textColor: string,
    level: 'AA' | 'AAA' = 'AA'
  ): boolean {
    const contrast = this.getContrastRatio(backgroundColor, textColor);
    const requiredContrast = level === 'AAA' ? 7 : 4.5;
    
    return contrast >= requiredContrast;
  }
}