import { expect, test } from '@playwright/test';

// Runs against the local stack (e2e/stack.sh): Hardhat + CoFHE mocks + dev wallet.
test('mint a cat, peek at it privately, then reveal it on-chain', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('fhecat.lang', 'en'));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Pixel cats born encrypted.' })).toBeVisible();

  await page.getByRole('button', { name: 'Connect wallet' }).first().click();
  await page.getByRole('button', { name: 'Dev wallet' }).click();

  const mint = page.locator('#mint .btn-big');
  await expect(mint).toHaveText(/Mint 1 cat/);
  await mint.click();
  await expect(page.locator('#mint .note.ok')).toBeVisible();

  const card = page.locator('.cat-card', { has: page.getByRole('button', { name: 'Peek' }) }).first();
  const token = await card.getAttribute('data-token');
  const byToken = page.locator(`.cat-card[data-token="${token}"]`);

  await byToken.getByRole('button', { name: 'Peek' }).click();
  await expect(byToken).toHaveClass(/is-private/);
  await expect(byToken.locator('.traits li')).toHaveCount(8);
  const peeked = await byToken.locator('.traits li').allTextContents();

  await byToken.getByRole('button', { name: 'Reveal' }).click();
  await expect(byToken.locator('.chip-ok')).toHaveText('Revealed', { timeout: 60_000 });
  expect(await byToken.locator('.traits li').allTextContents()).toEqual(peeked);

  await page.getByRole('button', { name: 'Türkçeye geç' }).click();
  await expect(page.getByRole('heading', { name: 'Kedilerim' })).toBeVisible();
});
