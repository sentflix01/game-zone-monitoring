import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

// Use './' base for Electron (file:// protocol), '/' for web and Capacitor
const isElectronBuild = process.env.BUILD_TARGET === 'electron';
// Only load Cloudflare plugin when deploying to Cloudflare Pages
const isCloudflare = process.env.CF_PAGES === '1' || process.env.DEPLOY_TARGET === 'cloudflare';

export default defineConfig(async () => {
  const plugins = [react(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
    manifest: {
      name: 'Game Zone',
      short_name: 'Game Zone',
      description: 'PlayStation game zone manager — track consoles, sessions, and earnings',
      theme_color: '#0f172a',
      background_color: '#0f172a',
      display: 'standalone',
      orientation: 'portrait-primary',
      scope: '/',
      start_url: '/',
      icons: [
        {
          src: 'icon-192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: 'icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable',
        },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
          handler: 'CacheFirst',
          options: { cacheName: 'google-fonts-cache' },
        },
      ],
    },
    devOptions: {
      enabled: true,
      type: 'module',
    },
  })];

  // Only add Cloudflare plugin when deploying — not during local dev/test/build
  if (isCloudflare) {
    const { cloudflare } = await import('@cloudflare/vite-plugin');
    plugins.push(cloudflare());
  }

  return {
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: [],
      pool: 'threads',
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/cypress/**',
        '**/.{idea,git,cache,output,temp}/**',
        '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
        '**/e2e/**',
      ],
    },
    base: isElectronBuild ? './' : '/',
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'charts': ['recharts'],
            'ui': ['@radix-ui/react-dialog', '@radix-ui/react-select', '@radix-ui/react-dropdown-menu'],
          },
        },
      },
    },
  };
});