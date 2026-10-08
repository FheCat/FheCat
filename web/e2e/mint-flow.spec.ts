import { readFileSync } from 'node:fs';
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

  // Sealed, it fights as its box.
  const id = await card.getAttribute('data-token');
  await card.getByRole('button', { name: 'Full body' }).click();
  await expect(card.getByRole('img', { name: `FheCat #${id}, sealed, as its box fighter` })).toBeVisible();
  await card.getByRole('button', { name: 'Portrait' }).click();

  await card.getByRole('button', { name: 'Peek' }).click();
  await expect(card).toContainText('marks this cat as Peeked for good');
  await card.getByRole('button', { name: 'Peek in private' }).click();
  await expect(card).toHaveClass(/is-private/);
  await expect(card.locator('.traits li')).toHaveCount(8);
  await expect(card.locator('.chip')).toHaveText('Peeked');
  const peeked = await card.locator('.traits li').allTextContents();
  // Only its holder sees it, so only its holder sees it fight as itself.
  await card.getByRole('button', { name: 'Full body' }).click();
  await expect(card.getByRole('img', { name: `FheCat #${id}, full body` })).toBeVisible();

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

  // The fight plays out on screen. The rival holds one of the cats, so it sees both tactics played.
  const scene = rival.getByRole('dialog', { name: /Duel #\d+/ });
  await expect(scene).toBeVisible({ timeout: 60_000 });
  await expect(scene.locator('.fight-banner')).toContainText(/#\d+ wins/, { timeout: 60_000 });
  await expect(scene.locator('.fight-tactic')).toHaveText(['Pounce', 'Guard']);
  await expect(scene).toContainText(/You (won · \+4 points|lost · \+1 point)/);
  await scene.getByRole('button', { name: 'Close' }).click();
  await expect(scene).toBeHidden();
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

  // The challenger replays it: a fight cloud while the tactics stay sealed, the fight itself once it decrypts them.
  await result(page).getByRole('button', { name: /^Watch duel/ }).click();
  const replay = page.getByRole('dialog', { name: /Duel #\d+/ });
  await replay.getByRole('button', { name: 'Skip' }).click();
  await expect(replay.locator('.fight-banner')).toContainText(`#${winner} wins`);
  await expect(replay.locator('.fight-tactic')).toHaveText(['Secret', 'Secret']);
  await replay.getByRole('button', { name: 'Watch with tactics' }).click();
  await expect(replay.locator('.fight-tactic')).toHaveText(['Pounce', 'Guard'], { timeout: 30_000 });
  await page.keyboard.press('Escape');
  await expect(replay).toBeHidden();
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

test('every fight is choreographed to its result and stays on the stage', async ({ page }) => {
  await page.goto('/');
  // The fight scripts and the stage, loaded as the site loads them, run for every pairing.
  const problems = await page.evaluate(async () => {
    const { BEATS, buildScript, captionOf } = await import('/src/arena/script.ts');
    const { render } = await import('/src/arena/stage.ts');
    const out: string[] = [];
    const ctx = document.createElement('canvas').getContext('2d')!;
    const cast = { looks: [{ kind: 'cat', dna: 0x9c4a2e71b05d8f36n }, { kind: 'box', state: 1, handle: 7n }] };
    const pairs = [null, ...[0, 1, 2].flatMap((a) => [0, 1, 2].map((b) => [a, b]))];
    for (const tactics of pairs)
      for (const winner of [0, 1]) {
        const name = `${tactics ? tactics.join('-') : 'blind'}, ${winner} wins`;
        const s = buildScript({ tactics, winner });
        const m = s.marks;
        const ordered = m.vs[0] < m.vs[1] && m.vs[1] <= m.lock && m.lock < m.clash && m.clash <= m.impact && m.impact <= m.result && m.result < m.end;
        if (!ordered || !Number.isFinite(m.end)) out.push(`${name}: marks ${JSON.stringify(m)}`);
        s.tracks.forEach((segs: { t0: number; t1: number; poses: string[]; from: number; to: number; hidden?: boolean }[], i: number) => {
          if (segs[0].t0 !== 0) out.push(`${name}: fighter ${i} starts at ${segs[0].t0}`);
          for (let k = 1; k < segs.length; k++) if (segs[k].t0 !== segs[k - 1].t1) out.push(`${name}: fighter ${i} skips ${segs[k - 1].t1}-${segs[k].t0}`);
          const last = segs[segs.length - 1];
          if (last.t1 !== Infinity) out.push(`${name}: fighter ${i} vanishes at ${last.t1}`);
          if (i === winner ? !last.poses.includes('win') : last.poses.join() !== 'down') out.push(`${name}: fighter ${i} ends ${last.poses}`);
          for (const seg of segs)
            if (seg.t0 >= BEATS.arrive && !seg.hidden && [seg.from, seg.to].some((x) => x < 12 || x > 148)) out.push(`${name}: fighter ${i} off stage at ${seg.t0}`);
        });
        if (!captionOf({ tactics, winner })) out.push(`${name}: no caption`);
        for (let t = 0; t < m.end + 1; t += 1 / 20) render(ctx, s, cast, t);
      }
    // A live fight waits under FHE; once the result is in, the clash takes over without a jump.
    const waiting = buildScript({ winner: null });
    const live = buildScript({ winner: 1, tactics: [2, 0], clashAt: 9.25 });
    const before = (x: { tracks: { t0: number; poses: string[]; from: number; to: number; facing: string }[][] }, i: number) =>
      JSON.stringify(x.tracks[i].filter((g) => g.t0 < 9.25).map((g) => [g.t0, g.poses, g.from, g.to, g.facing]));
    for (const i of [0, 1]) if (before(waiting, i) !== before(live, i)) out.push(`live fighter ${i} jumps when the result comes in`);
    if (waiting.marks.clash !== Infinity || live.marks.clash !== 9.25) out.push('live clash timing');
    return out;
  });
  expect(problems).toEqual([]);
});

test("the admin's arena tab draws the same fighters and plays the same fight", async ({ page }) => {
  // landing/admin/mint/arena-game.js as committed, on a page of its own like admin.html.
  const landing = (path: string) => readFileSync(new URL(`../../landing/${path}`, import.meta.url), 'utf8');
  await page.setContent('<!doctype html><html><head></head><body></body></html>');
  await page.addStyleTag({ content: landing('css/styles.css') + landing('css/fight.css') });
  await page.addScriptTag({ content: landing('js/pixel.js') });
  await page.addScriptTag({ content: landing('admin/mint/arena-game.js') });
  const drawn = await page.evaluate(() => {
    const G = (window as unknown as { FheCat: { arenaGame: { fighter: (cat: unknown, scale?: number, label?: string) => HTMLCanvasElement } } }).FheCat.arenaGame;
    const box = G.fighter({ state: 0, handle: '0x' + '9f'.repeat(32) }, 2);
    const cat = G.fighter({ state: 3, dna: '0x9c4a2e71b05d8f36' }, 1, '#7 as it fights');
    document.body.append(box, cat);
    const painted = (c: HTMLCanvasElement) => c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data.filter((v, i) => i % 4 === 3 && v > 0).length;
    return { box: painted(box), cat: painted(cat), size: box.style.width, label: cat.getAttribute('aria-label') };
  });
  expect(drawn.box).toBeGreaterThan(300);
  expect(drawn.cat).toBeGreaterThan(300);
  expect(drawn).toMatchObject({ size: '80px', label: '#7 as it fights' });

  // Watching a duel: what any spectator sees, the tactics sealed.
  const watch = page.getByRole('button', { name: 'Watch duel 7' });
  await page.evaluate(() => {
    const b = Object.assign(document.createElement('button'), { textContent: 'Watch duel 7' });
    b.addEventListener('click', () =>
      (window as unknown as { FheCat: { arenaGame: { watch: (bout: unknown) => void } } }).FheCat.arenaGame.watch({
        id: 7,
        ids: [3, 9],
        cats: [{ state: 0, handle: '0x01' }, { state: 3, dna: '0x9c4a2e71b05d8f36' }],
        winner: 1,
        sealed: false,
      }),
    );
    document.body.append(b);
  });
  await watch.click();
  const scene = page.getByRole('dialog', { name: 'Blind Arena · Duel #7' });
  await expect(scene).toBeVisible();
  await expect(scene.locator('.fight-tactic')).toHaveText(['Ready', 'Ready']);
  await scene.getByRole('button', { name: 'Skip' }).click();
  await expect(scene.locator('.fight-banner')).toHaveText('#9 wins');
  await expect(scene.locator('.fight-tactic')).toHaveText(['Secret', 'Secret']);
  await expect(scene.locator('.fight-pts')).toHaveText(['+1', '+3']);
  await expect(scene.getByRole('button', { name: 'Replay' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(scene).toHaveCount(0);
  await expect(watch).toBeFocused();
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
