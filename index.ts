import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

import {
  upsertUser, getUser, setLang, getLang, getBalance,
  addBalance, subtractBalance, getAllUserIds, getUserCount,
  createOrder, getOrder, updateOrder, getUserOrders,
  getPendingOrders, getOrderStats, processCashback,
  getReferralCount, getReferralEarnings, createPromo, usePromo,
} from './database';
import { isFlood } from './middlewares';

const BOT_TOKEN   = process.env.BOT_TOKEN!;
const ADMIN_ID    = parseInt(process.env.ADMIN_ID ?? '8150331577', 10);
const WEBAPP_URL  = process.env.WEBAPP_URL ?? '';
const PORT        = parseInt(process.env.PORT ?? '3000', 10);
const CARD_NUMBER = process.env.UZCARD_NUMBER ?? '5614 6821 1076 2236';
const CARD_HOLDER = process.env.UZCARD_HOLDER ?? 'I.Tojiboyev';

if (!BOT_TOKEN) { console.error('BOT_TOKEN missing'); process.exit(1); }

type Lang = 'ru' | 'uz';

const T: Record<Lang, any> = {
  ru: { /* полный объект ru */ },
  uz: { /* полный объект uz */ }
};

function tr(lang: Lang, key: string, vars?: Record<string, string>): string {
  // ... та же функция что у тебя
}

type Step = 'idle' | 'main_menu' | 'awaiting_username' | 'awaiting_payment' | 'awaiting_receipt' | 'awaiting_promo' | 'awaiting_dm_target' | 'awaiting_dm_text';
interface State { step: Step; productId?: string; productName?: string; price?: number; targetUsername?: string; orderId?: string; dmTarget?: number; }

const states = new Map<number, State>();
function getState(uid: number): State { return states.get(uid) ?? { step: 'idle' }; }
function setState(uid: number, s: Partial<State>): void { states.set(uid, { ...getState(uid), ...s }); }
const adminReject = new Map<number, string>();

let _oid = 1;
function newOrderId(): string { return `ORD-${Date.now().toString(36).toUpperCase()}-${(_oid++).toString().padStart(3, '0')}`; }
function fmt(n: number): string { return n.toLocaleString('ru-RU'); }

const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') { res.sendStatus(200); }
  else { next(); }
});

app.use(express.json());

const publicPath = path.join(process.cwd(), 'public');
app.use(express.static(publicPath));

app.get('/api/user/:id', (req, res) => {
  const uid = parseInt(req.params.id, 10);
  if (isNaN(uid)) { res.status(400).json({ error: 'invalid id' }); return; }
  const user = getUser(uid);
  if (!user) { res.status(404).json({ error: 'not found' }); return; }
  res.json({
    id: user.id, first_name: user.first_name, username: user.username,
    balance: user.balance, lang: user.lang,
    refs: getReferralCount(uid), earned: getReferralEarnings(uid),
    orders: getUserOrders(uid).length,
  });
});

app.post('/api/order', (req, res) => {
  const { user_id, product_id, product_name, price, type } = req.body;
  if (!user_id || !product_id) { res.status(400).json({ error: 'Missing user_id or product_id' }); return; }
  const orderId = newOrderId();
  createOrder({
    id: orderId, user_id, product_id, product_name,
    price: price || 0, target_username: String(user_id),
  });
  console.log(`✅ Новый заказ #${orderId} от ${user_id}: ${product_name}`);
  res.json({ ok: true, orderId });
});

app.get('/', (_req, res) => { res.sendFile(path.join(publicPath, 'index.html')); });
app.listen(PORT, () => console.log(`🌐 Web server port ${PORT}`));

async function startBot() {
  const bot = new TelegramBot(BOT_TOKEN, {
    polling: { interval: 300, autoStart: false, params: { timeout: 10 } },
  });

  try { await bot.deleteWebHook(); console.log('✅ Webhook cleared'); }
  catch { console.log('ℹ️ No webhook'); }
  await bot.startPolling();
  console.log('🤖 Bot started');

  const mainKb = (lang: Lang): TelegramBot.ReplyKeyboardMarkup => ({
    keyboard: [
      [{ text: tr(lang, 'openShop'), web_app: { url: WEBAPP_URL } }],
      [{ text: tr(lang, 'profile') }, { text: tr(lang, 'referral') }],
      [{ text: tr(lang, 'myOrders') }, { text: tr(lang, 'support') }],
      [{ text: tr(lang, 'promoCmd') }, { text: tr(lang, 'changeLang') }],
    ], resize_keyboard: true,
  });

  const langKb = (): TelegramBot.InlineKeyboardMarkup => ({ inline_keyboard: [[ { text: '🇷🇺 Русский', callback_data: 'lang:ru' }, { text: '🇺🇿 O\'zbek', callback_data: 'lang:uz' } ]] });
  const adminKb = (orderId: string): TelegramBot.InlineKeyboardMarkup => ({ inline_keyboard: [[ { text: '✅ Выполнено', callback_data: `approve:${orderId}` }, { text: '❌ Отклонить', callback_data: `reject:${orderId}` } ]] });
  const cancelKb = (): TelegramBot.ReplyKeyboardMarkup => ({ keyboard: [[{ text: '❌ Отмена' }]], resize_keyboard: true, one_time_keyboard: true });
  const rmKbFn = async (chatId: number, msgId: number) => { try { await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: msgId }); } catch {} };

  bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
    const uid = msg.from!.id;
    const refId = match?.[1] ? parseInt(match[1]) : undefined;
    upsertUser({ id: uid, username: msg.from!.username, first_name: msg.from!.first_name, referred_by: refId && refId !== uid ? refId : undefined });
    if (match?.[1] === 'topup') {
      const lang = getLang(uid) as Lang;
      setState(uid, { step: 'awaiting_receipt', productId: 'topup', productName: 'Пополнение баланса', price: 0 });
      await bot.sendMessage(uid, `💰 *Пополнение баланса*\n\nКарта: \`${CARD_NUMBER}\`\nВладелец: *${CARD_HOLDER}*\n\n📝 Введите сумму, которую хотите пополнить:`, { parse_mode: 'Markdown', reply_markup: { remove_keyboard: true } });
      return;
    }
    setState(uid, { step: 'main_menu' });
    const lang = getLang(uid) as Lang;
    await bot.sendMessage(uid, tr(lang, 'chooseLang'), { reply_markup: langKb() });
  });

  bot.onText(/\/support/, async (msg) => {
    const uid = msg.from!.id;
    await bot.sendMessage(uid, tr(getLang(uid) as Lang, 'supportText'), { parse_mode: 'Markdown' });
  });

bot.onText(/\/stats/, async (msg) => {
  if (msg.from!.id !== ADMIN_ID) return;
  const stats = getOrderStats();
  const users = getUserCount();
  const pending = getPendingOrders().length;
  await bot.sendMessage(ADMIN_ID,
    `📊 *Статистика*\n\n👥 Пользователей: *${users}*\n🔍 На проверке: *${pending}*\n\n📅 Сегодня: ${stats.today.cnt ?? 0} заказов / ${fmt(stats.today.total ?? 0)} сум\n📅 Неделя: ${stats.week.cnt ?? 0} заказов / ${fmt(stats.week.total ?? 0)} сум\n📅 Месяц: ${stats.month.cnt ?? 0} заказов / ${fmt(stats.month.total ?? 0)} сум`,
    { parse_mode: 'Markdown' });
});

bot.onText(/\/broadcast (.+)/, async (msg, match) => {
  if (msg.from!.id !== ADMIN_ID) return;
  const text = match?.[1];
  if (!text) return;
  const ids = getAllUserIds();
  let sent = 0, failed = 0;
  await bot.sendMessage(ADMIN_ID, `📤 Начинаю рассылку ${ids.length} пользователям...`);
  for (const id of ids) {
    try { await bot.sendMessage(id, text, { parse_mode: 'Markdown' }); sent++; }
    catch { failed++; }
    await new Promise(r => setTimeout(r, 50));
  }
  await bot.sendMessage(ADMIN_ID, `✅ Рассылка завершена.\n✅ Доставлено: *${sent}*\n❌ Ошибок: *${failed}*`, { parse_mode: 'Markdown' });
});

bot.onText(/\/dm(?:\s+(.+))?/, async (msg, match) => {
  if (msg.from!.id !== ADMIN_ID) return;
  const args = match?.[1]?.trim();
  if (!args) {
    setState(ADMIN_ID, { step: 'awaiting_dm_target' });
    await bot.sendMessage(ADMIN_ID, '📨 *DM режим*\n\nВведите Telegram ID пользователя:', { parse_mode: 'Markdown', reply_markup: cancelKb() });
    return;
  }
  const spaceIdx = args.indexOf(' ');
  if (spaceIdx === -1) { await bot.sendMessage(ADMIN_ID, '❌ Использование: `/dm 123456789 Текст сообщения`', { parse_mode: 'Markdown' }); return; }
  const targetId = parseInt(args.substring(0, spaceIdx), 10);
  const text = args.substring(spaceIdx + 1);
  if (isNaN(targetId)) { await bot.sendMessage(ADMIN_ID, '❌ Неверный ID пользователя.'); return; }
  try {
    await bot.sendMessage(targetId, `📨 *Сообщение от администратора:*\n\n${text}`, { parse_mode: 'Markdown' });
    await bot.sendMessage(ADMIN_ID, `✅ Сообщение отправлено пользователю \`${targetId}\`.`, { parse_mode: 'Markdown' });
  } catch { await bot.sendMessage(ADMIN_ID, `❌ Не удалось отправить. Пользователь ${targetId} заблокировал бота.`); }
});

bot.onText(/\/addpromo (\S+) (\d+) (\d+)/, async (msg, match) => {
  if (msg.from!.id !== ADMIN_ID) return;
  const code = match?.[1] ?? '', bonus = parseInt(match?.[2] ?? '0', 10), uses = parseInt(match?.[3] ?? '1', 10);
  createPromo(code, bonus, uses);
  await bot.sendMessage(ADMIN_ID, `✅ Промокод создан:\n\nКод: \`${code.toUpperCase()}\`\nБонус: *${fmt(bonus)} сум*\nИспользований: *${uses}*`, { parse_mode: 'Markdown' });
});

bot.onText(/\/pending/, async (msg) => {
  if (msg.from!.id !== ADMIN_ID) return;
  const pending = getPendingOrders();
  if (!pending.length) { await bot.sendMessage(ADMIN_ID, '📭 Нет заказов на проверке.'); return; }
  await bot.sendMessage(ADMIN_ID, `🔍 Заказов на проверке: *${pending.length}*`, { parse_mode: 'Markdown' });
});

bot.on('callback_query', async (q) => {
  const uid = q.from.id;
  const data = q.data ?? '';
  const lang = getLang(uid) as Lang;
  await bot.answerCallbackQuery(q.id);
  if (isFlood(uid, 500)) { await bot.sendMessage(uid, tr(lang, 'flood')); return; }

  if (data.startsWith('lang:')) {
    const l = data.split(':')[1] as Lang;
    setLang(uid, l);
    setState(uid, { step: 'main_menu' });
    await rmKbFn(q.message!.chat.id, q.message!.message_id);
    await bot.sendMessage(uid, tr(l, 'langChosen'));
    await bot.sendMessage(uid, tr(l, 'welcome', { name: q.from.first_name }), { reply_markup: mainKb(l), parse_mode: 'Markdown' });
    return;
  }

  if (data === 'pay:card') {
    const state = getState(uid);
    setState(uid, { step: 'awaiting_receipt' });
    await rmKbFn(q.message!.chat.id, q.message!.message_id);
    await bot.sendMessage(uid, tr(lang, 'payCard', { card: CARD_NUMBER, holder: CARD_HOLDER, price: fmt(state.price!), product: state.productName!, username: state.targetUsername! }), { parse_mode: 'Markdown' });
    return;
  }

  if (data === 'pay:balance') {
    const state = getState(uid);
    const ok = subtractBalance(uid, state.price!);
    if (!ok) {
      await bot.sendMessage(uid, tr(lang, 'notEnoughBal', { balance: fmt(getBalance(uid)), price: fmt(state.price!) }), { parse_mode: 'Markdown' });
      return;
    }
    const orderId = newOrderId();
    createOrder({ id: orderId, user_id: uid, product_id: state.productId!, product_name: state.productName!, price: state.price!, target_username: state.targetUsername!, paid_by_balance: 1 });
    updateOrder(orderId, { status: 'under_review' });
    setState(uid, { step: 'main_menu' });
    await rmKbFn(q.message!.chat.id, q.message!.message_id);
    await bot.sendMessage(uid, tr(lang, 'paidByBalance', { product: state.productName!, username: state.targetUsername!, orderId }), { parse_mode: 'Markdown', reply_markup: mainKb(lang) });
    const u = getUser(uid);
    await bot.sendMessage(ADMIN_ID, `🛒 *Новый заказ (баланс)!*\n\n🆔 \`${orderId}\`\n📦 ${state.productName}\n💰 ${fmt(state.price!)} сум\n👤 @${state.targetUsername}\n🧑 ${u?.first_name ?? ''}${u?.username ? ` (@${u.username})` : ''}\n🪪 ID: ${uid}`, { parse_mode: 'Markdown', reply_markup: adminKb(orderId) });
    return;
  }

  if (data.startsWith('approve:') && uid === ADMIN_ID) {
    const orderId = data.replace('approve:', '');
    const order = getOrder(orderId);
    if (!order) { await bot.sendMessage(uid, '❌ Заказ не найден.'); return; }
    updateOrder(orderId, { status: 'approved' });
    processCashback(order.user_id, order.price);
    await rmKbFn(q.message!.chat.id, q.message!.message_id);
    await bot.sendMessage(uid, `✅ Заказ \`${orderId}\` выполнен.`, { parse_mode: 'Markdown' });
    const ul = getLang(order.user_id) as Lang;
    try { await bot.sendMessage(order.user_id, tr(ul, 'approved', { product: order.product_name, username: order.target_username }), { parse_mode: 'Markdown', reply_markup: mainKb(ul) }); } catch {}
    return;
  }

  if (data.startsWith('reject:') && uid === ADMIN_ID) {
    const orderId = data.replace('reject:', '');
    adminReject.set(uid, orderId);
    await rmKbFn(q.message!.chat.id, q.message!.message_id);
    await bot.sendMessage(uid, '✏️ Введите причину отклонения:');
    return;
  }
});

  bot.on('message', async (msg) => {
    const uid   = msg.from!.id;
    const lang  = getLang(uid) as Lang;
    const state = getState(uid);
    const text  = msg.text ?? '';

    if (isFlood(uid) && uid !== ADMIN_ID) { await bot.sendMessage(uid, tr(lang, 'flood')); return; }
    if (text === '❌ Отмена') { setState(uid, { step: 'main_menu' }); await bot.sendMessage(uid, '↩️ Отменено.', { reply_markup: mainKb(lang) }); return; }

    // Admin logic (topup, DM, reject reason)
    if (uid === ADMIN_ID) {
      const rejectId = adminReject.get(uid);
      if (rejectId && rejectId.startsWith('topup:')) {
        const parts = rejectId.split(':');
        const amount = parseInt(text.replace(/\D/g, ''), 10);
        if (isNaN(amount) || amount <= 0) { await bot.sendMessage(uid, '❌ Неверная сумма:'); adminReject.set(uid, rejectId); return; }
        const targetUserId = parseInt(parts[2], 10);
        addBalance(targetUserId, amount);
        updateOrder(parts[1], { status: 'approved', admin_comment: String(amount) });
        await bot.sendMessage(uid, `✅ *${fmt(amount)} сум* зачислено \`${targetUserId}\``, { parse_mode: 'Markdown' });
        try { const ul = getLang(targetUserId) as Lang; await bot.sendMessage(targetUserId, `✅ *Балансингиз тўлдирилди!*\n\n💰 +*${fmt(amount)} сум*`, { parse_mode: 'Markdown', reply_markup: mainKb(ul) }); } catch {}
        adminReject.delete(uid);
        return;
      }

      if (state.step === 'awaiting_dm_target' && text && !text.startsWith('/')) {
        const targetId = parseInt(text.trim(), 10);
        if (isNaN(targetId)) { await bot.sendMessage(uid, '❌ Неверный ID. Введите числовой Telegram ID:'); return; }
        setState(uid, { step: 'awaiting_dm_text', dmTarget: targetId });
        await bot.sendMessage(uid, `📨 Теперь введите текст сообщения для пользователя \`${targetId}\`:`, { parse_mode: 'Markdown', reply_markup: cancelKb() });
        return;
      }

      if (state.step === 'awaiting_dm_text' && text && !text.startsWith('/')) {
        const targetId = state.dmTarget!;
        setState(uid, { step: 'main_menu', dmTarget: undefined });
        try {
          await bot.sendMessage(targetId, `📨 *Сообщение от администратора:*\n\n${text}`, { parse_mode: 'Markdown' });
          await bot.sendMessage(uid, `✅ Сообщение доставлено пользователю \`${targetId}\`.`, { parse_mode: 'Markdown', reply_markup: { remove_keyboard: true } });
        } catch { await bot.sendMessage(uid, `❌ Не удалось доставить. Пользователь \`${targetId}\` заблокировал бота.`, { parse_mode: 'Markdown', reply_markup: { remove_keyboard: true } }); }
        return;
      }

      if (adminReject.has(uid)) {
        const orderId = adminReject.get(uid)!;
        if (!orderId.startsWith('topup:') && !orderId.startsWith('reject:')) {
          const reason = text;
          updateOrder(orderId, { status: 'rejected', admin_comment: reason });
          const order = getOrder(orderId);
          if (order) {
            const ul = getLang(order.user_id) as Lang;
            try { await bot.sendMessage(order.user_id, tr(ul, 'rejected', { product: order.product_name, reason }), { parse_mode: 'Markdown', reply_markup: mainKb(ul) }); } catch {}
            await bot.sendMessage(ADMIN_ID, `❌ Заказ \`${orderId}\` отклонён. Причина: ${reason}`, { parse_mode: 'Markdown' });
          }
          adminReject.delete(uid);
          return;
        }
      }
    }

    // ── Web App data ─────────────────────────────────────────
    if (msg.web_app_data?.data) {
      try {
        const d = JSON.parse(msg.web_app_data.data);
        if (d.action === 'topup') { /* аналогично */ return; }
        if (d.target_username) { /* выбор оплаты */ } 
        else { await bot.sendMessage(uid, tr(lang, 'enterUsername'), { reply_markup: { remove_keyboard: true } }); }
      } catch { await bot.sendMessage(uid, '❌ Ошибка данных. Попробуйте ещё раз.'); }
      return;
    }

    // Остальные обработчики (awaiting_username, awaiting_receipt, promo, profile, referral, myOrders, support, changeLang, topupMsg, default)
    // (оставь как у тебя, они правильные)
  });

  process.once('SIGINT',  () => { bot.stopPolling(); process.exit(0); });
  process.once('SIGTERM', () => { bot.stopPolling(); process.exit(0); });
}

startBot().catch(err => { console.error('Fatal:', err); process.exit(1); });
