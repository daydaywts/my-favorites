import { getCollection, type CollectionEntry } from 'astro:content';
import type { Category, LibraryItem } from '../types';

export type WorkEntry = CollectionEntry<'works'>;

export const getReleaseYear = (releaseDate: string) =>
  releaseDate.match(/\d{4}/)?.[0] ?? releaseDate;

export const toLibraryItem = (entry: WorkEntry): LibraryItem => ({
  slug: entry.id.split('/').at(-1) ?? entry.id,
  ...entry.data,
});

export const getLibrary = async () =>
  (await getCollection('works'))
    .map(toLibraryItem)
    .sort((a, b) => b.date.localeCompare(a.date));

export const getByCategory = async (category: Category) =>
  (await getLibrary()).filter((item) => item.category === category);

export const getLibraryMeta = async () => {
  const library = await getLibrary();
  const byCategory = (category: Category) => library.filter((item) => item.category === category);
  const allTags = [...new Set(library.flatMap((item) => item.tags))]
    .sort((a, b) => a.localeCompare(b, 'zh-CN'));

  return {
    library,
    counts: {
      all: library.length,
      movie: byCategory('movie').length,
      manga: byCategory('manga').length,
      game: byCategory('game').length,
    },
    allTags,
    tagCounts: Object.fromEntries(
      allTags.map((tag) => [tag, library.filter((item) => item.tags.includes(tag)).length]),
    ),
  };
};
