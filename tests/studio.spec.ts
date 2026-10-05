import { test, expect } from '@playwright/test';

test('desktop Studio focuses on customization and keeps connections in settings', async ({ page }) => {
  await page.addInitScript(() => {
    (window as typeof window & { isTauri?: boolean }).isTauri = true;
    (window as typeof window & { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__ = {
      transformCallback: () => 1,
      invoke: async (command: string) => {
        if (command === 'media_sessions') return [];
        if (command === 'find_lyrics') return [];
        if (command === 'plugin:event|listen') return 1;
        if (command === 'browser_pairing') return { endpoint: 'http://127.0.0.1:1', token: 'test', error: null };
        return null;
      },
    };
    (window as typeof window & { __TAURI_EVENT_PLUGIN_INTERNALS__?: object }).__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
    localStorage.setItem('floating:tour:v1', 'done');
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Make the lyrics yours.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show overlay' })).toBeVisible();
  await expect(page.getByTestId('lyrics-surface')).toHaveClass(/preset-caption/);
  await expect(page.locator('.native-controls, .feature-strip, .download-section, .site-header')).toHaveCount(0);
  await page.getByRole('button', { name: 'Behavior' }).click();
  const connections = page.getByText('Playback & connections');
  await connections.click();
  await expect(page.getByRole('checkbox', { name: 'Open overlay at startup' })).toBeChecked();
  await expect(page.getByLabel('Playback source')).toBeVisible();
  await page.getByLabel('Playback source').selectOption('demo');
  await expect(page.getByLabel('Try a different mood')).toBeVisible();
  await page.screenshot({ path: 'test-results/studio.png', fullPage: true });
});
