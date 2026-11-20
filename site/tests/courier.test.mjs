import assert from 'node:assert/strict';
import test from 'node:test';
import { jump, newRun, runnerX, step } from '../src/lib/courier/game.ts';

const basic = { magnet: false, doubleJump: false, shield: false };

test('只有解锁二段跳才能在空中再次起跳，落地恢复次数', () => {
  for (const doubleJump of [false, true]) {
    const powers = { ...basic, doubleJump };
    const run = newRun(powers);
    jump(run, powers);
    step(run, .05, powers);
    const airborneSpeed = run.velocity;
    jump(run, powers);
    assert.equal(run.jumps, doubleJump ? 2 : 1);
    assert.equal(run.velocity > airborneSpeed, doubleJump);
    jump(run, powers);
    assert.equal(run.jumps, doubleJump ? 2 : 1);
    for (let i = 0; i < 150; i++) step(run, 1/120, powers);
    assert.equal(run.jumps, 0);
  }
});

test('磁力邮袋扩大拾取半径，同一页只收一次', () => {
  for (const magnet of [false, true]) {
    const powers = { ...basic, magnet };
    const run = newRun(powers);
    run.items = [{ kind: 'page', x: runnerX, y: 40, used: false }];
    step(run, 1/120, powers);
    step(run, 1/120, powers);
    assert.equal(run.pages, magnet ? 1 : 0);
  }
});

test('防撞封套只抵消第一次碰撞，跳过路障保留手记', () => {
  const powers = { ...basic, shield: true };
  const run = newRun(powers);
  run.pages = 3;
  const barrier = () => [{kind: 'barrier', x: runnerX, y: 0, used: false}];
  run.items = barrier();
  step(run, 1/120, powers);
  assert.equal(run.pages, 3);
  assert.equal(run.shield, false);
  run.items = barrier();
  step(run, 1/120, powers);
  assert.equal(run.pages, 2);
  run.lift = 24;
  run.items = barrier();
  step(run, 1/120, powers);
  assert.equal(run.pages, 2);
  assert.equal(run.items[0].used, false);
});
