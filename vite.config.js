import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  build: {
    target: 'es6',
    assetsInlineLimit: 0, //disable
    cssTarget: 'chrome61',
  },
  define: {
    APP_VERSION: JSON.stringify(process.env.npm_package_version),
    APP_STAGE: JSON.stringify(process.env.APP_ENV || 'unk'),
  },
});