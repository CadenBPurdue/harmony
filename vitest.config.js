import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',         // So we can render components in a DOM-like environment
    setupFiles: './src/setupTests.js' // If you have any global setup (e.g. jest-dom matchers)
  }
});
