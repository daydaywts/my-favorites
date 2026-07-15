import { defineConfig } from 'astro/config';

const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];
const isProjectPage = process.env.GITHUB_ACTIONS === 'true' && repo && !repo.endsWith('.github.io');

export default defineConfig({
  output: 'static',
  site: 'https://daydaywts.github.io',
  base: isProjectPage ? `/${repo}/` : '/',
});
