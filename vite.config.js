import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 3000
  },
  define: {
    'process.env': {},
    'process.browser': true,
    'process': {
      browser: true,
      version: '...',
      nextTick: () => {}
    }
  }
}) 