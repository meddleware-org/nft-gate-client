import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // Offline unit suite.
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules/**'],
  },
})
