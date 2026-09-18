import { defineConfig } from 'vite';

// `base: './'` keeps the production build fully relocatable: the static
// output in dist/ can be served from a domain root, a GitHub Pages project
// path (/repo-name/), or any sub-folder without touching this config.
export default defineConfig({
  base: './',
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    assetsInlineLimit: 4096,
  },
});
