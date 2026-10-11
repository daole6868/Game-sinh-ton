import {
  DASH_COOLDOWN,
  DASH_SPEED,
  DASH_TIME,
  PLAYER_RADIUS,
  RUN_SPEED,
  WALK_SPEED,
} from './constants.ts';

export interface MoveState {
  x: number;
  y: number;
  dashT: number;
  dashCd: number;
  dashX: number;
  dashY: number;
}

export interface MoveInput {
  seq: number;
  /** hướng di chuyển (-1..1) */
  mx: number;
  my: number;
  run: boolean;
  dash: boolean;
  /** góc nhắm (radian) */
  a: number;
}

export interface MoveCtx {
  speedMul: number;
  canRun: boolean;
  canDash: boolean;
  solid: (tx: number, ty: number) => boolean;
  tileSpeed: (tx: number, ty: number) => number;
  radius?: number;
}

export interface MoveResult {
  dashed: boolean;
  running: boolean;
  moved: boolean;
}

export function collides(x: number, y: number, r: number, solid: (tx: number, ty: number) => boolean): boolean {
  const x0 = Math.floor(x - r);
  const x1 = Math.floor(x + r - 1e-6);
  const y0 = Math.floor(y - r);
  const y1 = Math.floor(y + r - 1e-6);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (solid(tx, ty)) return true;
  return false;
}

/** Di chuyển có va chạm theo từng trục (trượt dọc tường). */
export function moveWithCollision(
  s: { x: number; y: number },
  dx: number,
  dy: number,
  r: number,
  solid: (tx: number, ty: number) => boolean,
): boolean {
  const stuck = collides(s.x, s.y, r, solid);
  let moved = false;
  if (dx !== 0) {
    const nx = s.x + dx;
    if (stuck || !collides(nx, s.y, r, solid)) {
      s.x = nx;
      moved = true;
    }
  }
  if (dy !== 0) {
    const ny = s.y + dy;
    if (stuck || !collides(s.x, ny, r, solid)) {
      s.y = ny;
      moved = true;
    }
  }
  return moved;
}

/** Một bước di chuyển của người chơi — dùng chung client (dự đoán) và server (thẩm quyền). */
export function stepMove(s: MoveState, input: MoveInput, ctx: MoveCtx, dt: number): MoveResult {
  let mx = Number.isFinite(input.mx) ? input.mx : 0;
  let my = Number.isFinite(input.my) ? input.my : 0;
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  s.dashCd = Math.max(0, s.dashCd - dt);
  let dashed = false;
  if (input.dash && ctx.canDash && s.dashCd <= 0 && s.dashT <= 0) {
    let dx = mx;
    let dy = my;
    const l = Math.hypot(dx, dy);
    if (l < 0.01) {
      dx = Math.cos(input.a);
      dy = Math.sin(input.a);
    } else {
      dx /= l;
      dy /= l;
    }
    s.dashT = DASH_TIME;
    s.dashCd = DASH_COOLDOWN;
    s.dashX = dx;
    s.dashY = dy;
    dashed = true;
  }
  const r = ctx.radius ?? PLAYER_RADIUS;
  let vx: number;
  let vy: number;
  let running = false;
  if (s.dashT > 0) {
    vx = s.dashX * DASH_SPEED;
    vy = s.dashY * DASH_SPEED;
    s.dashT = Math.max(0, s.dashT - dt);
  } else {
    running = input.run && ctx.canRun && len > 0.1;
    const base = running ? RUN_SPEED : WALK_SPEED;
    const tm = ctx.tileSpeed(Math.floor(s.x), Math.floor(s.y));
    const v = base * ctx.speedMul * tm;
    vx = mx * v;
    vy = my * v;
  }
  const moved = moveWithCollision(s, vx * dt, vy * dt, r, ctx.solid);
  return { dashed, running, moved };
}
