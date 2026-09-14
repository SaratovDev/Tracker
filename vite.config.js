import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { devApiPlugin } from './server/dev-api-plugin.js'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    // base из VITE_BASE_PATH — нужен только при деплое в подпапку (по умолчанию '/')
    base: process.env.VITE_BASE_PATH || env.VITE_BASE_PATH || '/',
    plugins: [vue(), devApiPlugin({ passwordHash: env.ADMIN_PASSWORD_HASH })],
    test: {
      environment: 'node',
      include: ['src/**/*.test.js', 'server/**/*.test.js', 'api/**/*.test.js']
    }
  }
})
