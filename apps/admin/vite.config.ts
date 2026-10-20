import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
    // Monorepo'da tek React kopyası (mobil ile aynı sürüm); iki kopya "Invalid hook call" verir.
    dedupe: ['react', 'react-dom'],
  },
  // 3000: Supabase Auth'un varsayılan Site URL'i; giriş bağlantısı ek ayar olmadan buraya döner.
  server: { port: 3000, strictPort: true },
})
