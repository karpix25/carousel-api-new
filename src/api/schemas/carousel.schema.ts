import { z } from 'zod';

// Available style options
export const StyleEnum = z.enum(['default', 'bright', 'elegant']);

// Available color options for slides
export const ColorEnum = z.enum(['default', 'accent']);

// Slide type enum
export const SlideTypeEnum = z.enum(['intro', 'text', 'quote']);

// Settings schema
export const SettingsSchema = z.object({
  style: StyleEnum.default('default'),
  brandColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color').default('#2F00FF'),
  authorUsername: z.string().min(1).max(50).default('@username'),
  authorFullName: z.string().min(1).max(100).default('Full Name'),
  maxSlides: z.union([z.number().int().min(3).max(20), z.literal('auto')]).default('auto'),
  format: z.literal('png').default('png'),
  quality: z.enum(['standard', 'high']).default('high'),
});

// Request schema
export const GenerateCarouselSchema = z.object({
  text: z.string().min(1, 'Text cannot be empty').max(50000, 'Text is too long'),
  settings: SettingsSchema.optional().default({}),
});

// Slide data schema
export const SlideSchema = z.object({
  type: SlideTypeEnum,
  title: z.string().optional(),
  text: z.string(),
  color: ColorEnum.default('default'),
  showAbstraction: z.boolean().optional(),
  size: z.enum(['small', 'medium', 'large', 'auto']).optional(),
});

// Response schema
export const CarouselResponseSchema = z.object({
  slides: z.array(SlideSchema),
  images: z.array(z.string()), // base64 encoded PNG images
  metadata: z.object({
    totalSlides: z.number(),
    generatedAt: z.string(),
    processingTime: z.number(),
    settings: SettingsSchema,
  }),
});

// Export types
export type StyleType = z.infer<typeof StyleEnum>;
export type ColorType = z.infer<typeof ColorEnum>;
export type SlideType = z.infer<typeof SlideTypeEnum>;
export type SettingsType = z.infer<typeof SettingsSchema>;
export type GenerateCarouselRequest = z.infer<typeof GenerateCarouselSchema>;
export type SlideData = z.infer<typeof SlideSchema>;
export type CarouselResponse = z.infer<typeof CarouselResponseSchema>;

// Available styles with their descriptions
export const AVAILABLE_STYLES = [
  {
    id: 'default' as StyleType,
    name: 'Минималистичный',
    description: 'Чистый и современный дизайн с мягкими формами',
    patternConfig: { size: 480, growth: 3, edges: 18 },
  },
  {
    id: 'bright' as StyleType,
    name: 'Яркий',
    description: 'Динамичный стиль с выразительными элементами',
    patternConfig: { size: 480, growth: 7, edges: 14 },
  },
  {
    id: 'elegant' as StyleType,
    name: 'Элегантный',
    description: 'Изысканный дизайн с балансированными пропорциями',
    patternConfig: { size: 480, growth: 5, edges: 17 },
  },
] as const;