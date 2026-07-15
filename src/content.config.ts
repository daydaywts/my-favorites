import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
});

const works = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/works' }),
  schema: z.object({
    title: z.string(),
    category: z.enum(['movie', 'manga', 'game']),
    originalTitle: z.string().optional(),
    releaseDate: z.string(),
    meta: z.string().default(''),
    summary: z.string().default(''),
    date: z.string(),
    tags: z.array(z.string()).default([]),
    introduction: z.string(),
    images: z.object({
      cover: z.string().optional(),
      banner: z.string().optional(),
      gallery: z.array(z.object({
        src: z.string(),
        caption: z.string().optional(),
      })).default([]),
    }).default({ gallery: [] }),
  }),
});

export const collections = { articles, works };
