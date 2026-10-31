import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [
    react(),
    tailwindcss(),
    // App instalável no celular. O service worker só guarda o "casco" do app (HTML/JS/CSS):
    // chamadas à API nunca passam por cache, então agenda e login sempre refletem o servidor.
    // Fica desligado em `vite dev`, onde roda o modo mock.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Meu Barbeiro',
        short_name: 'Meu Barbeiro',
        description: 'Agendamento online e gestão para barbearias.',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#15140f',
        theme_color: '#15140f',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/auth\//, /^\/dev\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})
