// ─── In-Memory Database (no SQLite needed) ───────────────────
// Language and state persist as long as server is running.
// For production persistence, upgrade to PostgreSQL.

export type Lang = 'ru' | 'uz';

interface User {
  id: number;
  username?: string;
  first_name: string;
  lang: Lang;
  balance: number;
  referred_by?: number;
  created_at: string;
}

interface Order {
  id: string;
  user_id: number;
  product_id: string;
  product_name: string;
  price: number;
  target_username: string;
  paid_by_balance: number;
  status: string;
  receipt_file_id?: string;
  admin_comment?: string;
  created_at: string;
}

interface Referral {
  inviter_id: number;
  invitee_id: number;
  cashback: number;
}

const users    = new Map<number, User>();
const orders   = new Map<string, Order>();
const referrals = new Map<number, Referral>(); // invitee_id → Referral

// ─── Users ───────────────────────────────────────────────────

export function upsertUser(u: {
  id: number; username?: string; first_name: string; referred_by?: number;
}): void {
  if (users.has(u.id)) {
    const ex = users.get(u.id)!;
    ex.username   = u.username ?? ex.username;
    ex.first_name = u.first_name;
  } else {
    users.set(u.id, {
      id: u.id,
      username: u.username,
      first_name: u.first_name,
      lang: 'ru',
      balance: 0,
      referred_by: u.referred_by,
      created_at: new Date().toISOString(),
    });
    if (u.referred_by && u.referred_by !== u.id) {
      createReferral(u.referred_by, u.id);
    }
  }
}

export function getUser(id: number): User | undefined {
  return users.get(id);
}

export function setLang(id: number, lang: Lang): void {
  const u = users.get(id);
  if (u) u.lang = lang;
}

export function getLang(id: number): Lang {
  return users.get(id)?.lang ?? 'ru';
}

export function getBalance(id: number): number {
  return users.get(id)?.balance ?? 0;
}

export function addBalance(id: number, amount: number): void {
  const u = users.get(id);
  if (u) u.balance += amount;
}

export function subtractBalance(id: number, amount: number): boolean {
  const u = users.get(id);
  if (!u || u.balance < amount) return false;
  u.balance -= amount;
  return true;
}

export function getAllUserIds(): number[] {
  return [...users.keys()];
}

export function getUserCount(): number {
  return users.size;
}

// ─── Orders ──────────────────────────────────────────────────

export function createOrder(o: {
  id: string; user_id: number; product_id: string;
  product_name: string; price: number; target_username: string;
  paid_by_balance?: number;
}): void {
  orders.set(o.id, {
    ...o,
    paid_by_balance: o.paid_by_balance ?? 0,
    status: 'awaiting_receipt',
    created_at: new Date().toISOString(),
  });
}

export function getOrder(id: string): Order | undefined {
  return orders.get(id);
}

export function updateOrder(id: string, patch: {
  status?: string; receipt_file_id?: string; admin_comment?: string;
}): void {
  const o = orders.get(id);
  if (!o) return;
  if (patch.status)          o.status          = patch.status;
  if (patch.receipt_file_id) o.receipt_file_id = patch.receipt_file_id;
  if (patch.admin_comment)   o.admin_comment   = patch.admin_comment;
}

export function getUserOrders(userId: number): Order[] {
  return [...orders.values()]
    .filter(o => o.user_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5);
}

export function getPendingOrders(): Order[] {
  return [...orders.values()].filter(o => o.status === 'under_review');
}

// ─── Referrals ───────────────────────────────────────────────

export function createReferral(inviterId: number, inviteeId: number): void {
  if (!referrals.has(inviteeId)) {
    referrals.set(inviteeId, { inviter_id: inviterId, invitee_id: inviteeId, cashback: 0 });
  }
}

export function getReferralCount(inviterId: number): number {
  return [...referrals.values()].filter(r => r.inviter_id === inviterId).length;
}

export function getReferralEarnings(inviterId: number): number {
  return [...referrals.values()]
    .filter(r => r.inviter_id === inviterId)
    .reduce((sum, r) => sum + r.cashback, 0);
}

export function processCashback(inviteeId: number, orderAmount: number): void {
  const ref = referrals.get(inviteeId);
  if (!ref) return;
  const cashback = Math.floor(orderAmount * 0.03);
  ref.cashback += cashback;
  addBalance(ref.inviter_id, cashback);
}
