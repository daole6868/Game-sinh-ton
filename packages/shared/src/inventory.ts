import { HOTBAR_SIZE } from './constants.ts';
import { ITEMS, isPerishable, isUnique } from './data/items.ts';
import type { ItemStack, Slot } from './types.ts';

export function maxStack(id: string): number {
  return ITEMS[id]?.stack ?? 1;
}

/** Hai chồng có gộp được không. */
export function canStack(a: ItemStack, b: ItemStack): boolean {
  return a.id === b.id && !a.u && !b.u && !isUnique(a.id) && (a.lv ?? 0) === (b.lv ?? 0);
}

/** Gộp thời điểm tươi theo trung bình có trọng số. */
function mergeT(a: ItemStack, addN: number, addT: number | undefined): void {
  if (a.t === undefined || addT === undefined) return;
  a.t = (a.t * a.n + addT * addN) / (a.n + addN);
}

export interface MakeOpts {
  now: number;
  uid?: () => string;
  quality?: number;
}

/** Tạo chồng vật phẩm mới (đồ độc nhất có độ bền và mã riêng). */
export function makeStack(id: string, n: number, opts: MakeOpts): ItemStack {
  const def = ITEMS[id];
  if (!def) throw new Error(`Không có vật phẩm: ${id}`);
  const s: ItemStack = { id, n };
  if (def.durability !== undefined) {
    const q = opts.quality ?? 1;
    s.n = 1;
    s.md = Math.round(def.durability * q);
    s.d = s.md;
    if (q !== 1) s.q = Math.round(q * 1000) / 1000;
    if (opts.uid) s.u = opts.uid();
  }
  if (isPerishable(id)) s.t = opts.now;
  return s;
}

export function cloneSlots(inv: Slot[]): Slot[] {
  return inv.map((s) => (s ? { ...s } : null));
}

export function countItem(inv: readonly Slot[], id: string): number {
  let n = 0;
  for (const s of inv) if (s && s.id === id) n += s.n;
  return n;
}

export function hasItems(inv: readonly Slot[], req: Record<string, number>, times = 1): boolean {
  for (const [id, n] of Object.entries(req)) if (countItem(inv, id) < n * times) return false;
  return true;
}

/** Thứ tự ưu tiên ô trống: thanh nhanh trước, rồi tới túi. */
function emptyOrder(inv: readonly Slot[]): number[] {
  const order: number[] = [];
  for (let i = 0; i < Math.min(HOTBAR_SIZE, inv.length); i++) order.push(i);
  for (let i = HOTBAR_SIZE; i < inv.length; i++) order.push(i);
  return order;
}

/**
 * Thêm một chồng vào túi (thay đổi trực tiếp). Trả về số lượng KHÔNG thêm được.
 * Đồ độc nhất luôn chiếm một ô riêng.
 */
export function addStack(inv: Slot[], stack: ItemStack, order?: number[]): number {
  let left = stack.n;
  const max = maxStack(stack.id);
  const idx = order ?? emptyOrder(inv);
  if (!isUnique(stack.id) && !stack.u) {
    for (const i of idx) {
      const s = inv[i];
      if (left <= 0) break;
      if (s && canStack(s, stack) && s.n < max) {
        const add = Math.min(max - s.n, left);
        mergeT(s, add, stack.t);
        s.n += add;
        left -= add;
      }
    }
  }
  for (const i of idx) {
    if (left <= 0) break;
    if (!inv[i]) {
      const add = Math.min(max, left);
      inv[i] = { ...stack, n: add };
      left -= add;
    }
  }
  return left;
}

/** Kiểm tra có thêm được toàn bộ các chồng hay không (không thay đổi túi). */
export function canAddAll(inv: readonly Slot[], stacks: ItemStack[]): boolean {
  const copy = cloneSlots(inv as Slot[]);
  for (const s of stacks) if (addStack(copy, { ...s }) > 0) return false;
  return true;
}

/**
 * Lấy ra qty đơn vị của vật phẩm id (thay đổi trực tiếp). Trả về các chồng đã lấy
 * (giữ nguyên độ tươi), hoặc null nếu không đủ (khi đó túi không bị thay đổi).
 */
export function takeItem(inv: Slot[], id: string, qty: number): ItemStack[] | null {
  if (countItem(inv, id) < qty) return null;
  const taken: ItemStack[] = [];
  let left = qty;
  // lấy từ túi trước, thanh nhanh sau
  const order = [...Array(inv.length).keys()].sort((a, b) => (a < HOTBAR_SIZE ? 1 : 0) - (b < HOTBAR_SIZE ? 1 : 0) || b - a);
  for (const i of order) {
    const s = inv[i];
    if (!s || s.id !== id || left <= 0) continue;
    const n = Math.min(s.n, left);
    taken.push({ ...s, n });
    s.n -= n;
    left -= n;
    if (s.n <= 0) inv[i] = null;
  }
  return taken;
}

export function takeItems(inv: Slot[], req: Record<string, number>, times = 1): ItemStack[] | null {
  if (!hasItems(inv, req, times)) return null;
  const out: ItemStack[] = [];
  for (const [id, n] of Object.entries(req)) out.push(...takeItem(inv, id, n * times)!);
  return out;
}

/** Lấy qty đơn vị từ một ô cụ thể. */
export function takeFromSlot(inv: Slot[], idx: number, qty: number): ItemStack | null {
  const s = inv[idx];
  if (!s || qty <= 0 || qty > s.n) return null;
  const out = { ...s, n: qty };
  s.n -= qty;
  if (s.n <= 0) inv[idx] = null;
  return out;
}

/**
 * Chuyển đồ giữa hai ô (có thể khác mảng). qty mặc định = cả chồng.
 * Gộp nếu cùng loại, ngược lại hoán đổi (chỉ khi chuyển cả chồng).
 */
export function moveSlot(from: Slot[], fi: number, to: Slot[], ti: number, qty?: number): boolean {
  const a = from[fi];
  if (!a) return false;
  if (from === to && fi === ti) return false;
  const n = Math.min(qty ?? a.n, a.n);
  if (n <= 0) return false;
  const b = to[ti];
  if (!b) {
    to[ti] = { ...a, n };
    a.n -= n;
    if (a.n <= 0) from[fi] = null;
    return true;
  }
  if (canStack(a, b)) {
    const space = maxStack(b.id) - b.n;
    const add = Math.min(space, n);
    if (add <= 0) return false;
    mergeT(b, add, a.t);
    b.n += add;
    a.n -= add;
    if (a.n <= 0) from[fi] = null;
    return true;
  }
  if (n !== a.n) return false;
  from[fi] = b;
  to[ti] = a;
  return true;
}

export function inventoryWeight(inv: readonly Slot[]): number {
  let w = 0;
  for (const s of inv) if (s) w += (ITEMS[s.id]?.weight ?? 0) * s.n;
  return w;
}

/** Độ tươi 0..1 (1 = tươi). Đồ không hỏng luôn = 1. */
export function freshness(s: ItemStack, now: number): number {
  const spoil = ITEMS[s.id]?.food?.spoil;
  if (!spoil || s.t === undefined) return 1;
  return Math.max(0, Math.min(1, 1 - (now - s.t) / spoil));
}

export function freshLabel(f: number): string {
  if (f >= 0.5) return 'Tươi';
  if (f >= 0.2) return 'Ôi';
  return 'Hỏng';
}

/** Danh sách gọn để ghi nhật ký. */
export function describeStacks(stacks: ItemStack[]): string {
  return stacks.map((s) => `${ITEMS[s.id]?.name ?? s.id}×${s.n}`).join(', ');
}

export function emptySlots(n: number): Slot[] {
  return Array.from({ length: n }, () => null);
}

export function totalCount(stacks: readonly (ItemStack | null)[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of stacks) if (s) m.set(s.id, (m.get(s.id) ?? 0) + s.n);
  return m;
}
