import { expect, test, type Locator, type Page } from '@playwright/test';

// Runs against the local stack (e2e/stack.sh): Hardhat + CoFHE mocks + dev wallet.

/** `?dev=1` connects Hardhat's second dev account: a second holder. */
async function connect(page: Page, path = '/') {
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1, name: 'FheCat' })).toBeVisible();
  await page.getByRole('button', { name: 'Connect wallet' }).first().click();
  await page.getByRole('button', { name: 'Dev wallet' }).click();
}

/** Mints `n` cats and returns their cards, newest first. */
async function mint(page: Page, n: number): Promise<Locator[]> {
  // Count only once the wallet's cats have loaded (the empty box shows only then).
  await expect(page.locator('#cats .cat-card').first().or(page.locator('#cats').getByText('No cats yet'))).toBeVisible();
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

test('two sealed cats duel blind: tactics stay hidden, the winner tops the week', async ({ page, browser }) => {
  // The arena never lets a holder fight itself, so the rival plays from a second wallet and browser.
  const rival = await (await browser.newContext()).newPage();
  await connect(page);
  await connect(rival, '/?dev=1');
  const [cardA] = await mint(page, 1);
  const [cardB] = await mint(rival, 1);
  const idA = (await cardA.getAttribute('data-token'))!;
  const idB = (await cardB.getAttribute('data-token'))!;
  const a = page.locator(`#arena .arena-cat[data-token="${idA}"]`);
  const b = rival.locator(`#arena .arena-cat[data-token="${idB}"]`);
  for (const cat of [a, b]) {
    await cat.getByRole('button', { name: 'Enter arena' }).click();
    await expect(cat.getByRole('button', { name: 'Challenge' })).toBeVisible();
  }

  // A locks a Pounce and challenges anyone.
  await a.getByRole('button', { name: 'Challenge' }).click();
  await expect(a.getByRole('button', { name: 'Lock & challenge' })).toBeDisabled(); // no tactic yet
  await a.getByRole('radio', { name: 'Pounce' }).click();
  await a.getByRole('button', { name: 'Lock & challenge' }).click();
  await expect(page.locator('#arena .note.ok')).toContainText(`#${idA} is waiting for a rival. Your Pounce is locked and sealed.`);
  await expect(a.locator('.waiting')).toBeVisible();

  // B finds a sealed box and answers with Guard, which beats Pounce.
  const duel = rival.locator('#arena .duel-open').filter({ has: rival.locator('.duel-title', { hasText: new RegExp(`^#${idA}\\s*vs\\s*anyone$`) }) });
  await expect(duel).toContainText('A sealed box: it wins the ties.');
  await duel.getByLabel('Accept with').selectOption(idB);
  await duel.getByRole('radio', { name: 'Guard' }).click();
  await duel.getByRole('button', { name: 'Lock & fight' }).click();
  const told = rival.locator('#arena .note.ok');
  await expect(told).toContainText(/You (won|lost): #\d+ beat #\d+\. They played Pounce, you played Guard\./, { timeout: 60_000 });
  const winner = (await told.textContent())!.match(/#(\d+) beat/)![1]!;
  const loser = winner === idA ? idB : idA;
  expect([idA, idB]).toContain(winner);

  // Both holders see who won; the tactics open only for the two of them, the winner's first.
  const result = (p: Page) => p.locator('#arena .arena-results li').filter({ hasText: new RegExp(`#${winner} beat #${loser} sealed`) });
  const tactics = winner === idA ? 'Pounce vs Guard' : 'Guard vs Pounce';
  await expect(result(rival)).toContainText(tactics);
  await expect(result(page)).toBeVisible();
  await expect(result(page)).not.toContainText('Pounce');
  await result(page).getByRole('button', { name: 'Tactics' }).click();
  await expect(result(page)).toContainText(tactics);

  // Records, badges and the week's table: 4 points for a sealed win, 1 for the loss.
  const [winnerCat, loserCat] = winner === idA ? [a, b] : [b, a];
  await expect(winnerCat.locator('.record')).toHaveText('1W · 0L · 1 sealed');
  await expect(loserCat.locator('.record')).toHaveText('0W · 1L');
  await expect(winnerCat.locator('.badge')).toHaveText(['First Blood', 'Won Blind']);
  for (const p of [page, rival]) {
    const row = (id: string) => p.locator('#arena .board li').filter({ has: p.locator('b', { hasText: new RegExp(`^#${id}$`) }) });
    await expect(row(winner).locator('.pts')).toHaveText('4 pts');
    await expect(row(loser).locator('.pts')).toHaveText('1 pt');
  }

  // A tier proof for A.
  await a.getByRole('button', { name: 'Prove tier' }).click();
  await a.getByRole('button', { name: 'Prove tier' }).last().click();
  await expect(page.locator('#arena .note.ok')).toContainText(new RegExp(`#${idA} is (not )?Rare`), { timeout: 60_000 });

  // Nobody opened a box to fight.
  await expect(cardA.locator('.chip')).toHaveText('Unopened');
  await expect(cardB.locator('.chip')).toHaveText('Unopened');
  await rival.context().close();
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
