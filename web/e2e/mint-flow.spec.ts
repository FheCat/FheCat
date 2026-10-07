import { expect, test, type Locator, type Page } from '@playwright/test';

// Runs against the local stack (e2e/stack.sh): Hardhat + CoFHE mocks + dev wallet.

async function connect(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'FheCat' })).toBeVisible();
  await page.getByRole('button', { name: 'Connect wallet' }).first().click();
  await page.getByRole('button', { name: 'Dev wallet' }).click();
}

/** Mints `n` cats and returns their cards, newest first. */
async function mint(page: Page, n: number): Promise<Locator[]> {
  const before = await page.locator('#cats .cat-card').count();
  for (let i = 1; i < n; i++) await page.locator('#mint').getByRole('button', { name: 'One more' }).click();
  const button = page.locator('#mint .btn-mint');
  await expect(button).toHaveText(new RegExp(`Mint ${n} cat`));
  await button.click();
  await expect(page.locator('#mint .note.ok')).toBeVisible();
  await expect(page.locator('#cats .cat-card')).toHaveCount(before + n);
  const tokens = await page.locator('#cats .cat-card').evaluateAll((els) => els.map((e) => e.getAttribute('data-token')!));
  return tokens
    .map(Number)
    .sort((a, b) => b - a)
    .slice(0, n)
    .map((id) => page.locator(`#cats .cat-card[data-token="${id}"]`));
}

test('a cat is born unopened, can be peeked in private and revealed with its own proof', async ({ page }) => {
  await connect(page);
  const [card] = await mint(page, 1);
  await expect(card.locator('.chip')).toHaveText('Unopened');
  await expect(card.locator('.traits')).toHaveCount(0);

  await card.getByRole('button', { name: 'Peek' }).click();
  await expect(card).toContainText('marks this cat as Peeked for good');
  await card.getByRole('button', { name: 'Peek in private' }).click();
  await expect(card).toHaveClass(/is-private/);
  await expect(card.locator('.traits li')).toHaveCount(8);
  await expect(card.locator('.chip')).toHaveText('Peeked');
  const peeked = await card.locator('.traits li').allTextContents();

  await card.getByRole('button', { name: 'Hide' }).click();
  await expect(card.locator('.traits')).toHaveCount(0);
  await card.getByRole('button', { name: 'Peek' }).click(); // already allowed: no transaction, no warning
  await expect(card.locator('.traits li')).toHaveCount(8);

  await card.getByRole('button', { name: 'Reveal' }).click();
  await expect(card.locator('.chip-ok')).toHaveText('Revealed', { timeout: 60_000 });
  expect(await card.locator('.traits li').allTextContents()).toEqual(peeked);
});

test('a holder can open the box for everyone, and the cat is revealed', async ({ page }) => {
  await connect(page);
  const [card] = await mint(page, 1);
  await card.getByRole('button', { name: 'Open the box' }).click();
  await expect(card).toContainText('cannot be undone');
  await card.getByRole('button', { name: 'Open for everyone' }).click();
  await expect(card.locator('.chip-ok')).toHaveText('Revealed', { timeout: 60_000 });
  await expect(card.locator('.traits li')).toHaveCount(8);
});

test('sealed cats fight blind in the arena and prove a tier', async ({ page }) => {
  await connect(page);
  const cards = await mint(page, 2);
  const ids = await Promise.all(cards.map((c) => c.getAttribute('data-token')));
  const [a, b] = ids.map((id) => page.locator(`#arena .arena-cat[data-token="${id}"]`));

  for (const cat of [a, b]) {
    await cat.getByRole('button', { name: 'Enter arena' }).click();
    await expect(cat.getByRole('button', { name: 'Challenge' })).toBeVisible({ timeout: 30_000 });
  }

  // An open challenge from A, accepted by B.
  await a.getByRole('button', { name: 'Challenge' }).click();
  await a.getByRole('button', { name: 'Send' }).click();
  const duel = page.locator('#arena .arena-row', { hasText: `#${ids[0]} vs anyone` });
  await expect(duel).toBeVisible({ timeout: 30_000 });
  await duel.locator('select').selectOption(ids[1]!);
  await duel.getByRole('button', { name: 'Accept' }).click();
  await expect(page.locator('#arena .note.ok')).toContainText(/#\d+ beat #\d+/, { timeout: 60_000 });
  await expect(page.locator('#arena .arena-results')).toContainText(/#\d+ beat #\d+/);

  // A tier proof for A.
  await a.getByRole('button', { name: 'Prove tier' }).click();
  await a.getByRole('button', { name: 'Prove tier' }).last().click();
  await expect(page.locator('#arena .note.ok')).toContainText(new RegExp(`#${ids[0]} is (not )?Rare`), { timeout: 60_000 });

  // Neither cat was opened to fight.
  for (const card of cards) await expect(card.locator('.chip')).toHaveText('Unopened');
  const record = await a.locator('.arena-info').textContent();
  expect(record).toMatch(/[01]W · [01]L/);
});

test('the owner runs the sale from the site', async ({ page }) => {
  await connect(page); // the dev wallet deployed the contract, so it owns it
  const owner = page.locator('#owner');
  const done = (text: string) => expect(owner.locator('.note.ok')).toContainText(text, { timeout: 30_000 });

  await owner.getByRole('button', { name: 'Closed' }).click();
  await done('Sale phase: Closed');
  await expect(page.locator('#mint .btn')).toContainText('Sale is closed');
  await owner.getByRole('button', { name: 'Public' }).click();
  await done('Sale phase: Public');

  const prices = owner.locator('.owner-box', { hasText: 'Prices' });
  await prices.getByLabel('Public').fill('0.01');
  await prices.getByRole('button', { name: 'Save prices' }).click();
  await done('Prices saved');
  // Earlier tests paid the launch price into the contract, so check what this mint adds.
  const funds = owner.locator('.owner-box', { hasText: 'Funds' }).locator('.panel-head .mono');
  const eth = async () => Number((await funds.textContent())!.replace(/[^\d.]/g, ''));
  const before = await eth();
  await mint(page, 1); // pays 0.01
  await expect.poll(eth).toBeCloseTo(before + 0.01, 6);

  const reserve = owner.locator('.owner-box', { hasText: 'Team reserve' });
  await reserve.getByLabel('How many (1-10)').fill('2');
  await reserve.getByRole('button', { name: 'Mint' }).click();
  await done('Minted 2 to');

  await owner.locator('.owner-box', { hasText: 'Funds' }).getByRole('button', { name: 'Withdraw all' }).click();
  await done('Funds withdrawn');

  // Leave the sale as the other tests expect it: public and free.
  await prices.getByLabel('Public').fill('0');
  await prices.getByRole('button', { name: 'Save prices' }).click();
  await done('Prices saved');
});
