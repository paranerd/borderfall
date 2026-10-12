import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ command, isPreview }) => {
  const base = command === 'serve' && !isPreview ? '/' : '/borderfall/';
  return {
    base,
    build: { target: ['es2022', 'safari17'] },
    plugins: [
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: ['icons/*.png', 'icons/*.svg'],
        manifest: {
          id: base,
          name: 'Borderfall',
          short_name: 'Borderfall',
          description: 'Dein Zug. Deine Welt. Ein Strategiespiel für Weltkarte und Europa.',
          lang: 'de',
          start_url: base,
          scope: base,
          display: 'standalone',
          background_color: '#e5ece6',
          theme_color: '#e5ece6',
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            {
              src: 'icons/maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{html,js,css,woff2,png,svg,webmanifest}'],
          cleanupOutdatedCaches: true,
          navigateFallback: `${base}index.html`,
        },
      }),
    ],
  };
});
