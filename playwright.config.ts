import { defineConfig, devices } from '@playwright/test';

// Run with `npm run test:e2e` (builds in emulator mode and starts the emulators first).
export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: true,
  workers: 3,
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
  },
  webServer: {
    command: 'npx vite preview --mode emulator --port 4173 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  },
  projects: [
    { name: 'phone-small', use: { ...devices['Galaxy S8'], viewport: { width: 360, height: 740 }, browserName: 'chromium' } },
    { name: 'phone', use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 }, browserName: 'chromium' } },
    { name: 'laptop', use: { viewport: { width: 1280, height: 800 }, browserName: 'chromium' } },
  ],
});
