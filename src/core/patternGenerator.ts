import { StyleType } from '../api/schemas/carousel.schema';

interface PatternConfig {
  size: number;
  growth: number;
  edges: number;
  seed?: number | null;
}

interface PatternResult {
  path: string;
  seedValue: number;
}

export class PatternGenerator {
  private static STYLE_CONFIGS: Record<StyleType, PatternConfig> = {
    default: { size: 480, growth: 3, edges: 18 },
    bright: { size: 480, growth: 7, edges: 14 },
    elegant: { size: 480, growth: 5, edges: 17 },
  };

  /**
   * Generate SVG pattern for given style
   */
  public static generatePattern(style: StyleType, seed?: number | null): string {
    const config = this.STYLE_CONFIGS[style];
    const result = this.createPattern({ ...config, seed });
    
    return `<svg viewBox="0 0 ${config.size} ${config.size}"><path d="${result.path}" /></svg>`;
  }

  /**
   * Create pattern with specified configuration
   */
  private static createPattern(config: PatternConfig): PatternResult {
    const { destPoints, seedValue } = this.generatePoints(
      config.size,
      config.growth,
      config.edges,
      config.seed
    );
    
    const path = this.createSmoothPath(destPoints);
    
    return { path, seedValue };
  }

  /**
   * Convert degrees to radians
   */
  private static degreesToRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Generate evenly distributed angles
   */
  private static generateAngles(edgeCount: number): number[] {
    const angleStep = 360 / edgeCount;
    return Array(edgeCount).fill(0).map((_, index) => index * angleStep);
  }

  /**
   * Create seeded random number generator
   */
  private static createSeededRandom(seed: number) {
    const mask = 0xffffffff;
    let m_w = (123456789 + seed) & mask;
    let m_z = (987654321 - seed) & mask;

    return function(): number {
      m_z = (36969 * (m_z & 65535) + (m_z >>> 16)) & mask;
      m_w = (18000 * (m_w & 65535) + (m_w >>> 16)) & mask;

      let result = ((m_z << 16) + (m_w & 65535)) >>> 0;
      result /= 4294967296;
      return result;
    };
  }

  /**
   * Generate random variation within bounds
   */
  private static randomVariation(
    randomFn: () => number,
    growthFactor: number,
    baseRadius: number
  ): number {
    const variation = growthFactor * (baseRadius / 10);
    let result = baseRadius + randomFn() * variation;
    
    // Keep within reasonable bounds
    if (result > baseRadius) {
      result = result - baseRadius;
    } else if (result < baseRadius) {
      result = result + baseRadius;
    }
    
    return result;
  }

  /**
   * Convert polar coordinates to cartesian
   */
  private static polarToCartesian(
    centerX: number,
    radius: number,
    angleInDegrees: number
  ): [number, number] {
    const x = centerX + radius * Math.cos(this.degreesToRadians(angleInDegrees));
    const y = centerX + radius * Math.sin(this.degreesToRadians(angleInDegrees));
    
    return [Math.round(x), Math.round(y)];
  }

  /**
   * Shuffle array randomly
   */
  private static shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Generate points for pattern
   */
  private static generatePoints(
    size: number,
    growth: number,
    edges: number,
    seed: number | null
  ): { destPoints: [number, number][]; seedValue: number } {
    const radius = size / 2;
    const growthVariation = growth * (radius / 10);
    const centerX = size / 2;
    
    const angles = this.generateAngles(edges);
    const randomSeedPool = this.shuffleArray([99, 999, 9999, 99999, 999999]);
    const randomSeed = Math.floor(Math.random() * randomSeedPool[0]);
    const actualSeed = seed || randomSeed;
    
    const randomFn = this.createSeededRandom(actualSeed);
    const destPoints: [number, number][] = [];

    angles.forEach(angle => {
      const variationRadius = this.randomVariation(randomFn, growth, radius);
      const point = this.polarToCartesian(centerX, variationRadius, angle);
      destPoints.push(point);
    });

    return { destPoints, seedValue: actualSeed };
  }

  /**
   * Create smooth SVG path from points using quadratic curves
   */
  private static createSmoothPath(points: [number, number][]): string {
    if (points.length < 3) {
      return '';
    }

    let path = '';
    
    // Start with midpoint between first and second point
    const startMidpoint: [number, number] = [
      (points[0][0] + points[1][0]) / 2,
      (points[0][1] + points[1][1]) / 2,
    ];
    
    path += `M${startMidpoint[0]},${startMidpoint[1]}`;

    // Create quadratic curves between each set of points
    for (let i = 0; i < points.length; i++) {
      const currentPoint = points[i];
      const nextPoint = points[(i + 1) % points.length];
      const nextNextPoint = points[(i + 2) % points.length];
      
      // Control point is the next point
      // End point is midpoint between next and next-next points
      const endMidpoint: [number, number] = [
        (nextPoint[0] + nextNextPoint[0]) / 2,
        (nextPoint[1] + nextNextPoint[1]) / 2,
      ];
      
      path += `Q${nextPoint[0]},${nextPoint[1]},${endMidpoint[0]},${endMidpoint[1]}`;
    }

    // Close the path
    path += 'Z';

    return path;
  }

  /**
   * Generate multiple patterns for testing
   */
  public static generateMultiplePatterns(
    style: StyleType,
    count: number = 5
  ): { svg: string; seed: number }[] {
    const patterns: { svg: string; seed: number }[] = [];
    
    for (let i = 0; i < count; i++) {
      const config = this.STYLE_CONFIGS[style];
      const result = this.createPattern({ ...config, seed: null });
      const svg = `<svg viewBox="0 0 ${config.size} ${config.size}"><path d="${result.path}" /></svg>`;
      
      patterns.push({
        svg,
        seed: result.seedValue,
      });
    }
    
    return patterns;
  }

  /**
   * Get pattern configuration for style
   */
  public static getStyleConfig(style: StyleType): PatternConfig {
    return { ...this.STYLE_CONFIGS[style] };
  }
}