import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.join(__dirname, 'bot.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id           INTEGER PRIMARY KEY,
    username     TEXT,
    first_name   TEXT,
    lang         TEXT    DEFAULT 'ru',
    balance      INTEGER DEFAULT 0,
    referred_by  INTEGER,
    created_at   TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id              TEXT    PRIMARY KEY,
    user_id         INTEGER NOT NULL,
    product_id      TEXT    NOT NULL,
    product_name    TEXT    NOT NULL,
    price           INTEGER NOT NULL,
    target_username TEXT,
    paid_by_balance INTEGER DEFAULT 0,
    status          TEXT    DEFAULT 'awaiting_receipt',
    receipt_file_id TEXT,
    admin_comment   TEXT,
    created_at      TEXT    DEFAULT (datetime('now')),
    updated_at      TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS referrals (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    inviter_id  INTEGER NOT NULL,
    invitee_id  INTEGER NOT NULL UNIQUE,
    cashback    INTEGER DEFAULT 0,
    created_at  TEXT    DEFAULT (datetime('now'))
  );
`);

// ─── Users ────────────────────────────────────────────────────
export function upsertUser(u: {
  id: number; username?: string; first_name: string; referred_by?: number;
}): void {
  const ex = db.prepare('SELECT id FROM users WHERE id = ?').get(u.id);
  if (ex) {
    db.prepare('UPDATE users SET username=?, first_name=? WHERE id=?')
      .run(u.username ?? null, u.first_name, u.id);
  } else {
    db.prepare('INSERT INTO users (id,username,first_name,referred_by) VALUES (?,?,?,?)')
      .run(u.id, u.username ?? null, u.first_name, u.referred_by ?? null);
    if (u.referred_by) createReferral(u.referred_by, u.id);
  }
}

export function getUser(id: number): any {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export function setLang(id: number, lang: string): void {
  db.prepare('UPDATE users SET lang=? WHERE id=?').run(lang, id);
}

export function getLang(id: number): string {
  const r: any = db.prepare('SELECT lang FROM users WHERE id=?').get(id);
  return r?.lang ?? 'ru';
}

export function getBalance(id: number): number {
  const r: any = db.prepare('SELECT balance FROM users WHERE id=?').get(id);
  return r?.balance ?? 0;
}

export function addBalance(id: number, amount: number): void {
  db.prepare('UPDATE users SET balance=balance+? WHERE id=?').run(amount, id);
}

export function subtractBalance(id: number, amount: number): boolean {
  const bal = getBalance(id);
  if (bal < amount) return false;
  db.prepare('UPDATE users SET balance=balance-? WHERE id=?').run(amount, id);
  return true;
}

export function getAllUserIds(): number[] {
  return (db.prepare('SELECT id FROM users').all() as any[]).map(r => r.id);
}

export function getUserCount(): number {
  const r: any = db.prepare('SELECT COUNT(*) as c FROM users').get();
  return r?.c ?? 0;
}

// ─── Orders ───────────────────────────────────────────────────
export function createOrder(o: {
  id: string; user_id: number; product_id: string;
  product_name: string; price: number; target_username: string;
  paid_by_balance?: number;
}): void {
  db.prepare(`
    INSERT INTO orders (id,user_id,product_id,product_name,price,target_username,paid_by_balance)
    VALUES (?,?,?,?,?,?,?)
  `).run(o.id, o.user_id, o.product_id, o.product_name, o.price, o.target_username, o.paid_by_balance ?? 0);
}

export function getOrder(id: string): any {
  return db.prepare('SELECT * FROM orders WHERE id=?').get(id);
}

export function updateOrder(id: string, patch: {
  status?: string; receipt_file_id?: string; admin_comment?: string;
}): void {
  const fields: string[] = ["updated_at=datetime('now')"];
  const vals: any[] = [];
  if (patch.status)           { fields.push('status=?');           vals.push(patch.status); }
  if (patch.receipt_file_id)  { fields.push('receipt_file_id=?');  vals.push(patch.receipt_file_id); }
  if (patch.admin_comment)    { fields.push('admin_comment=?');    vals.push(patch.admin_comment); }
  vals.push(id);
  db.prepare(`UPDATE orders SET ${fields.join(',')} WHERE id=?`).run(...vals);
}

export function getUserOrders(userId: number): any[] {
  return db.prepare('SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC LIMIT 5').all(userId);
}

export function getPendingOrders(): any[] {
  return db.prepare("SELECT * FROM orders WHERE status='under_review' ORDER BY created_at ASC").all();
}

// ─── Referrals ────────────────────────────────────────────────
export function createReferral(inviterId: number, inviteeId: number): void {
  try {
    db.prepare('INSERT INTO referrals (inviter_id,invitee_id) VALUES (?,?)').run(inviterId, inviteeId);
  } catch { /* уже существует */ }
}

export function getReferralCount(inviterId: number): number {
  const r: any = db.prepare('SELECT COUNT(*) as c FROM referrals WHERE inviter_id=?').get(inviterId);
  return r?.c ?? 0;
}

export function getReferralEarnings(inviterId: number): number {
  const r: any = db.prepare('SELECT SUM(cashback) as t FROM referrals WHERE inviter_id=?').get(inviterId);
  return r?.t ?? 0;
}

export function processCashback(inviteeId: number, orderAmount: number): void {
  const ref: any = db.prepare('SELECT * FROM referrals WHERE invitee_id=?').get(inviteeId);
  if (!ref) return;
  const cashback = Math.floor(orderAmount * 0.03);
  db.prepare('UPDATE referrals SET cashback=cashback+? WHERE invitee_id=?').run(cashback, inviteeId);
  addBalance(ref.inviter_id, cashback);
}

export default db;
