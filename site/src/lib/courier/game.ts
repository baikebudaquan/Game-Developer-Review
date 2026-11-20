// World units are pixels in the 384 × 128 playfield. y measures height above the road.
export const width = 384;
export const height = 128;
export const ground = 105;
export const runnerX = 53;
export const duration = 25;
export const speed = 96;

export interface Powers { magnet: boolean; doubleJump: boolean; shield: boolean }
export interface Item { kind: 'page' | 'barrier'; x: number; y: number; used: boolean }
export interface Run {
  time: number; lift: number; velocity: number; jumps: number;
  pages: number; shield: boolean; flash: number; blocked: boolean; pickup: number; items: Item[];
}

export function newRun(powers: Powers, random = Math.random): Run {
  const items: Item[] = [];
  const page = (x: number, y: number) => items.push({ kind: 'page', x, y, used: false });
  page(180, 13);
  // Every barrier has a page above it. The approach and landing room stay clear.
  let x = 306;
  while (x < runnerX + (duration - 2.2) * speed) {
    items.push({ kind: 'barrier', x, y: 0, used: false });
    page(x + 1, 49);
    page(x + 90, random() < .45 ? 34 : 14);
    x += 172 + Math.floor(random() * 58);
  }
  return { time: 0, lift: 0, velocity: 0, jumps: 0, pages: 0, shield: powers.shield, flash: 0, blocked: false, pickup: 0, items };
}

export function jump(run: Run, powers: Powers) {
  if (run.jumps >= (powers.doubleJump ? 2 : 1)) return;
  run.velocity = 159;
  run.jumps++;
}

export function step(run: Run, dt: number, powers: Powers) {
  run.time = Math.min(duration, run.time + dt);
  run.flash = Math.max(0, run.flash - dt);
  run.pickup = Math.max(0, run.pickup - dt);
  run.velocity -= 365 * dt;
  run.lift = Math.max(0, run.lift + run.velocity * dt);
  if (run.lift === 0) { run.velocity = 0; run.jumps = 0; }
  for (const item of run.items) {
    if (item.used) continue;
    const dx = item.x - speed * run.time - runnerX;
    if (Math.abs(dx) > 40) continue;
    if (item.kind === 'page') {
      const dy = item.y - (run.lift + 13);
      const reach = powers.magnet ? 32 : 13;
      if (Math.hypot(dx, dy) <= reach) {
        item.used = true;
        run.pages++;
        run.pickup = .28;
      }
    } else if (Math.abs(dx) < 10 && run.lift < 12) {
      item.used = true;
      run.blocked = run.shield;
      if (run.shield) run.shield = false;
      else run.pages = Math.max(0, run.pages - 1);
      run.flash = .65;
    }
  }
}
