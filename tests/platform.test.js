import test from 'node:test';
import assert from 'node:assert/strict';
import { BrowserStorage, OrderedStorage } from '../src/platform/storage.ts';
import { waitWhileActive } from '../src/platform/clock.ts';
import { loadGame, saveGame } from '../src/application/saves.ts';
import { newGame, SAVE_KEY } from '../src/game/engine.ts';
import { battleContent } from '../src/ui/battle.ts';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
class FakeLifecycle {
  active = true;
  listeners = new Set();
  isActive() {
    return this.active;
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  change(active) {
    this.active = active;
    for (const listener of this.listeners) listener(active);
  }
}

test('queued saves preserve enqueue-time snapshots even with asynchronous native storage', async () => {
  const writes = [];
  const storage = new OrderedStorage({
    async get() {
      return writes.at(-1) ?? null;
    },
    async set(key, value) {
      await sleep(writes.length ? 1 : 15);
      writes.push(value);
    },
  });
  const g = newGame();
  const first = saveGame(storage, g);
  g.round = 2;
  const second = saveGame(storage, g);
  await Promise.all([first, second]);
  assert.deepEqual(
    writes.map((raw) => JSON.parse(raw).round),
    [1, 2],
  );
  assert.equal(JSON.parse(await storage.get(SAVE_KEY)).round, 2);
});

test('a failed storage write does not block the next save', async () => {
  let calls = 0;
  const storage = new OrderedStorage({
    async get() {
      return null;
    },
    async set() {
      if (++calls === 1) throw new Error('full');
    },
  });
  await assert.rejects(storage.set('game', 'first'));
  await storage.set('game', 'second');
  await storage.flush();
  assert.equal(calls, 2);
});

test('blocked localStorage access becomes a catchable adapter failure', async () => {
  const storage = new BrowserStorage(() => {
    throw new Error('denied');
  });
  await assert.rejects(storage.get('game'), /denied/);
  await assert.rejects(storage.set('game', 'state'), /denied/);
});

test('older world saves load with defaults for the new turn flags', async () => {
  const g = newGame();
  delete g.attacked;
  delete g.placements;
  delete g.resumeAttack;
  delete g.settings.mapId;
  const loaded = await loadGame({
    async get() {
      return JSON.stringify(g);
    },
  });
  assert.ok(loaded);
  assert.equal(loaded.settings.mapId, 'world');
  assert.equal(loaded.attacked, false);
  assert.deepEqual(loaded.placements, {});
});

test('corrupted or structurally incomplete saves are ignored', async () => {
  const g = newGame();
  for (const raw of [
    '{',
    'null',
    JSON.stringify({ ...g, settings: null }),
    JSON.stringify({ ...g, board: {} }),
  ]) {
    assert.equal(
      await loadGame({
        async get() {
          return raw;
        },
      }),
      null,
    );
  }
});

test('battle timing stops in the background and resumes without restarting', async () => {
  const lifecycle = new FakeLifecycle();
  let finished = false;
  const waiting = waitWhileActive(lifecycle, 60, new AbortController().signal).then((result) => {
    finished = true;
    return result;
  });
  await sleep(15);
  lifecycle.change(false);
  await sleep(90);
  assert.equal(finished, false);
  lifecycle.change(true);
  assert.equal(await waiting, true);
  assert.equal(lifecycle.listeners.size, 0);
});

test('a battle waiting in the background can be aborted without leaking listeners', async () => {
  const lifecycle = new FakeLifecycle();
  lifecycle.change(false);
  const controller = new AbortController();
  const waiting = waitWhileActive(lifecycle, 1000, controller.signal);
  controller.abort();
  assert.equal(await waiting, false);
  assert.equal(lifecycle.listeners.size, 0);
});

test('battle troop totals keep the initial strength across consecutive rolls', () => {
  const g = newGame({ mapId: 'europe' });
  g.board.germany = { owner: 0, armies: 2 };
  g.board.poland = { owner: 1, armies: 3 };
  const b = {
    from: 'germany',
    to: 'poland',
    defender: 1,
    initial: { attacker: 5, defender: 3 },
    before: { attacker: 4, defender: 3 },
    result: {
      attacker: [1, 1, 1],
      defender: [6, 6],
      rolledAttacker: [1, 1, 1],
      rolledDefender: [6, 6],
      attackLoss: 2,
      defendLoss: 0,
    },
    round: 2,
    stage: 'result',
    controller: new AbortController(),
  };
  const html = battleContent(g, b);
  assert.match(html, /aria-label="vorher 5"/);
  assert.match(html, /aria-label="2 eigene Truppen"/);
  assert.doesNotMatch(html, /aria-label="vorher 4"/);
});
