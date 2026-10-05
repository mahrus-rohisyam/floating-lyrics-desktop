import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests', timeout: 30000, fullyParallel: false, workers: 1,
  use: { baseURL: 'http://127.0.0.1:1420', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: process.env.E2E_ALL_BROWSERS ? [
    {name:'chromium',use:{...devices['Desktop Chrome']}},
    {name:'firefox',use:{...devices['Desktop Firefox']}},
    {name:'webkit',use:{...devices['Desktop Safari']}},
  ] : [{ name: 'edge', use: { ...devices['Desktop Edge'], channel: process.platform==='win32'?'msedge':undefined } }],
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:1420', reuseExistingServer: !process.env.CI },
  reporter: [['list'], ['html', { open: 'never' }]]
});
