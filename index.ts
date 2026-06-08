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

// ─── Config ───────────────────────────────────────────────────
const BOT_TOKEN   = process.env.BOT_TOKEN!;
const ADMIN_ID    = parseInt(process.env.ADMIN_ID ?? '8150331577', 10);
const WEBAPP_URL  = process.env.WEBAPP_URL ?? '';
const PORT        = parseInt(process.env.PORT ?? '3000', 10);
const CARD_NUMBER = process.env.UZCARD_NUMBER ?? '5614 6821 1076 2236';
const CARD_HOLDER = process.env.UZCARD_HOLDER ?? 'I.Tojiboyev';

if (!BOT_TOKEN) { console.error('BOT_TOKEN missing'); process.exit(1); }

// ─── i18n ─────────────────────────────────────────────────────
type Lang = 'ru' | 'uz';

const T: Record<Lang, any> = {
  ru: {
    chooseLang:      '🌐 Выберите язык / Tilni tanlang:',
    langChosen:      '✅ Язык установлен: Русский',
    welcome:         '👋 Привет, *{name}*!\n\nДобро пожаловать в *Telegram Softs Bot*.\n\nПокупайте Premium и Stars быстро и надёжно 🚀',
    openShop:        '🛍 Открыть магазин',
    profile:         '👤 Профиль',
    referral:        '👥 Рефералы',
    myOrders:        '📋 Мои заказы',
    support:         '💬 Поддержка',
    changeLang:      '🌐 Язык',
    promoCmd:        '🎟 Промокод',
    profileText:     '👤 *Ваш профиль*\n\n🆔 ID: `{id}`\n👤 Имя: {name}\n💰 Баланс: *{balance} сум*\n👥 Рефералов: *{refs}*\n💸 Заработано с рефералов: *{earned} сум*\n📦 Всего заказов: *{orders}*',
    refText:         '👥 *Реферальная программа*\n\nПриглашайте друзей и получайте *3% кэшбек* с каждой их покупки!\n\n🔗 Ваша ссылка:\n`{link}`\n\n👥 Приглашено: *{count}* чел.\n💸 Заработано: *{earned} сум*',
    enterUsername:   '📝 Введите Telegram @username получателя:',
    invalidUser:     '❌ Неверный username. Введите корректный (мин. 5 символов):',
    choosePayment:   '💳 *Выберите способ оплаты*\n\n📦 {product}\n💰 Сумма: *{price} сум*\n👤 Получатель: @{username}',
    payByCard:       '💳 Оплатить картой Uzcard',
    payByBalance:    '💰 С баланса ({balance} сум)',
    notEnoughBal:    '❌ Недостаточно средств.\n💰 Баланс: *{balance} сум*\nНужно: *{price} сум*',
    paidByBalance:   '✅ *Оплачено с баланса!*\n\n📦 {product}\n👤 @{username}\n🆔 Заказ: `{orderId}`\n\n⏳ Ожидайте выполнения.',
    payCard:         '💳 *Оплата через Uzcard*\n\nНомер карты: `{card}`\nВладелец: *{holder}*\n\n💰 Сумма: *{price} сум*\n📦 {product}\n👤 @{username}\n\n📸 После оплаты отправьте скриншот чека.',
    receiptOk:       '✅ *Чек получен!*\n\nОжидайте подтверждения администратора.\n🕐 Обычно до 30 минут.\n🆔 Заказ: `{orderId}`',
    sendPhoto:       '📸 Отправьте фото или скриншот чека.',
    approved:        '🎉 *Заказ выполнен!*\n\n📦 {product}\n👤 Получатель: @{username}\n\nСпасибо за покупку! 🙏',
    rejected:        '❌ *Заказ отклонён.*\n\n📦 {product}\n💬 Причина: {reason}\n\nОбратитесь в поддержку: /support',
    noOrders:        '📭 У вас пока нет заказов.',
    ordersTitle:     '📋 *Ваши заказы:*\n\n',
    supportText:     '💬 *Поддержка*\n\nМенеджер: @Tadjibaev_i\n⏰ 9:00 — 22:00 (UTC+5)',
    flood:           '⏳ Не так быстро!',
    promoAsk:        '🎟 Введите промокод:',
    promoOk:         '✅ Промокод активирован! +*{bonus} сум* на баланс.',
    promoFail:       '❌ Промокод недействителен или уже использован.',
    topupMsg:        '💰 Для пополнения баланса напишите менеджеру: @Tadjibaev_i',
    status: {
      awaiting_receipt: '⏳ Ожидает чек',
      under_review:     '🔍 На проверке',
      approved:         '✅ Выполнен',
      rejected:         '❌ Отклонён',
      paid_by_balance:  '✅ Оплачен с баланса',
    },
  },
  uz: {
    chooseLang:      '🌐 Выберите язык / Tilni tanlang:',
    langChosen:      '✅ Til o\'rnatildi: O\'zbek',
    welcome:         '👋 Salom, *{name}*!\n\n*Telegram Softs Bot*ga xush kelibsiz.\n\nPremium va Stars tez va ishonchli sotib oling 🚀',
    openShop:        '🛍 Do\'konni ochish',
    profile:         '👤 Profil',
    referral:        '👥 Referallar',
    myOrders:        '📋 Buyurtmalarim',
    support:         '💬 Qo\'llab-quvvatlash',
    changeLang:      '🌐 Til',
    promoCmd:        '🎟 Promokod',
    profileText:     '👤 *Profilingiz*\n\n🆔 ID: `{id}`\n👤 Ism: {name}\n💰 Balans: *{balance} so\'m*\n👥 Referallar: *{refs}*\n💸 Referal daromad: *{earned} so\'m*\n📦 Jami buyurtmalar: *{orders}*',
    refText:         '👥 *Referal dasturi*\n\nDo\'stlarni taklif qiling va har bir xaridlaridan *3% cashback* oling!\n\n🔗 Sizning havolangiz:\n`{link}`\n\n👥 Taklif qilingan: *{count}* kishi\n💸 Ishlangan: *{earned} so\'m*',
    enterUsername:   '📝 Qabul qiluvchining Telegram @username ini kiriting:',
    invalidUser:     '❌ Noto\'g\'ri username. To\'g\'ri kiriting (min. 5 belgi):',
    choosePayment:   '💳 *To\'lov usulini tanlang*\n\n📦 {product}\n💰 Summa: *{price} so\'m*\n👤 Qabul qiluvchi: @{username}',
    payByCard:       '💳 Uzcard orqali to\'lash',
    payByBalance:    '💰 Balansdan ({balance} so\'m)',
    notEnoughBal:    '❌ Balansda mablag\' yetarli emas.\n💰 Balans: *{balance} so\'m*\nKerak: *{price} so\'m*',
    paidByBalance:   '✅ *Balansdan to\'landi!*\n\n📦 {product}\n👤 @{username}\n🆔 Buyurtma: `{orderId}`\n\n⏳ Bajarilishini kuting.',
    payCard:         '💳 *Uzcard orqali to\'lov*\n\nKarta raqami: `{card}`\nEgasi: *{holder}*\n\n💰 Summa: *{price} so\'m*\n📦 {product}\n👤 @{username}\n\n📸 To\'lovdan so\'ng chek skrinshotini yuboring.',
    receiptOk:       '✅ *Chek qabul qilindi!*\n\nAdministrator tasdig\'ini kuting.\n🕐 Odatda 30 daqiqagacha.\n🆔 Buyurtma: `{orderId}`',
    sendPhoto:       '📸 Chek rasm yoki skrinshotini yuboring.',
    approved:        '🎉 *Buyurtma bajarildi!*\n\n📦 {product}\n👤 Qabul qiluvchi: @{username}\n\nXarid uchun rahmat! 🙏',
    rejected:        '❌ *Buyurtma rad etildi.*\n\n📦 {product}\n💬 Sabab: {reason}\n\nQo\'llab-quvvatlash: /support',
    noOrders:        '📭 Buyurtmalar yo\'q.',
    ordersTitle:     '📋 *Buyurtmalaringiz:*\n\n',
    supportText:     '💬 *Qo\'llab-quvvatlash*\n\nMenejer: @Tadjibaev_i\n⏰ 9:00 — 22:00 (UTC+5)',
    flood:           '⏳ Shoshilmang!',
    promoAsk:        '🎟 Promokodni kiriting:',
    promoOk:         '✅ Promokod faollashtirildi! +*{bonus} so\'m* balansga.',
    promoFail:       '❌ Promokod yaroqsiz yoki allaqachon ishlatilgan.',
    topupMsg:        '💰 Balansni to\'ldirish uchun menejarga yozing: @Tadjibaev_i',
    status: {
      awaiting_receipt: '⏳ Chek kutilmoqda',
      under_review:     '🔍 Tekshirilmoqda',
      approved:         '✅ Bajarildi',
      rejected:         '❌ Rad etildi',
      paid_by_balance:  '✅ Balansdan to\'landi',
    },
  },
};

function tr(lang: Lang, key: string, vars?: Record<string, string>): string {
  const keys = key.split('.');
  let val: any = T[lang];
  for (const k of keys) val = val?.[k];
  if (typeof val !== 'string') return key;
  if (!vars) return val;
  return Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, v), val);
}

// ─── State ────────────────────────────────────────────────────
type Step =
  | 'idle' | 'main_menu' | 'awaiting_username'
  | 'awaiting_payment' | 'awaiting_receipt'
  | 'awaiting_promo' | 'awaiting_dm_target' | 'awaiting_dm_text';

interface State {
  step: Step;
  productId?: string;
  productName?: string;
  price?: number;
  targetUsername?: string;
  orderId?: string;
  dmTarget?: number;
}

const states = new Map<number, State>();
function getState(uid: number): State { return states.get(uid) ?? { step: 'idle' }; }
function setState(uid: number, s: Partial<State>): void { states.set(uid, { ...getState(uid), ...s }); }
const adminReject = new Map<number, string>();

let _oid = 1;
function newOrderId(): string {
  return `ORD-${Date.now().toString(36).toUpperCase()}-${(_oid++).toString().padStart(3, '0')}`;
}
function fmt(n: number): string { return n.toLocaleString('ru-RU'); }

// ─── Express ──────────────────────────────────────────────────
const app = express();
app.use(express.json());

const publicPath = path.join(process.cwd(), 'public');
app.use(express.static(publicPath));

// API endpoint — Web App gets user data
app.get('/api/user/:id', (req, res) => {
  const uid = parseInt(req.params.id, 10);
  if (isNaN(uid)) { res.status(400).json({ error: 'invalid id' }); return; }
  const user = getUser(uid);
  if (!user) { res.status(404).json({ error: 'not found' }); return; }
  res.json({
    id: user.id,
    first_name: user.first_name,
    username: user.username,
    balance: user.balance,
    lang: user.lang,
    refs: getReferralCount(uid),
    earned: getReferralEarnings(uid),
    orders: getUserOrders(uid).length,
  });
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.listen(PORT, () => console.log(`🌐 Web server port ${PORT}`));

// ─── Bot ──────────────────────────────────────────────────────
async function startBot() {
  const bot = new TelegramBot(BOT_TOKEN, {
    polling: { interval: 300, autoStart: false, params: { timeout: 10 } },
  });

  // Fix 409: clear webhook before polling
  try { await bot.deleteWebHook(); console.log('✅ Webhook cleared'); }
  catch { console.log('ℹ️ No webhook'); }

  await bot.startPolling();
  console.log('🤖 Bot started');

  // ── Keyboards ──────────────────────────────────────────────
  const mainKb = (lang: Lang): TelegramBot.ReplyKeyboardMarkup => ({
    keyboard: [
      [{ text: tr(lang, 'openShop'), web_app: { url: WEBAPP_URL } }],
      [{ text: tr(lang, 'profile') }, { text: tr(lang, 'referral') }],
      [{ text: tr(lang, 'myOrders') }, { text: tr(lang, 'support') }],
      [{ text: tr(lang, 'promoCmd') }, { text: tr(lang, 'changeLang') }],
    ],
    resize_keyboard: true,
  });

  const langKb = (): TelegramBot.InlineKeyboardMarkup => ({
    inline_keyboard: [[
      { text: '🇷🇺 Русский', callback_data: 'lang:ru' },
      { text: '🇺🇿 O\'zbek',  callback_data: 'lang:uz' },
    ]],
  });

  const adminKb = (orderId: string): TelegramBot.InlineKeyboardMarkup => ({
    inline_keyboard: [[
      { text: '✅ Выполнено',  callback_data: `approve:${orderId}` },
      { text: '❌ Отклонить', callback_data: `reject:${orderId}` },
    ]],
  });

  const cancelKb = (): TelegramBot.ReplyKeyboardMarkup => ({
    keyboard: [[{ text: '❌ Отмена' }]],
    resize_keyboard: true, one_time_keyboard: true,
  });

  const rmKbFn = async (chatId: number, msgId: number) => {
    try {
      await bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        { chat_id: chatId, message_id: msgId }
      );
    } catch { /* ignore */ }
  };

  // ── /start ─────────────────────────────────────────────────
  bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
    const uid = msg.from!.id;
    const refId = match?.[1] ? parseInt(match[1]) : undefined;
    upsertUser({
      id: uid, username: msg.from!.username,
      first_name: msg.from!.first_name,
      referred_by: refId && refId !== uid ? refId : undefined,
    });
    if (match?.[1] === 'topup') {
      const lang = getLang(uid) as Lang;
      setState(uid, { step: 'awaiting_receipt', productId: 'topup', productName: 'Пополнение баланса', price: 0 });
      await bot.sendMessage(uid,
        `💰 *Пополнение баланса*\n\nКарта: \`${CARD_NUMBER}\`\nВладелец: *${CARD_HOLDER}*\n\n📝 Введите сумму которую хотите пополнить:`,
        { parse_mode: 'Markdown', reply_markup: { remove_keyboard: true } }
      );
      return;
    }
    setState(uid, { step: 'main_menu' });
    const lang = getLang(uid) as Lang;
    await bot.sendMessage(uid, tr(lang, 'chooseLang'), { reply_markup: langKb() });
  });

  // ── /support ───────────────────────────────────────────────
  bot.onText(/\/support/, async (msg) => {
    const uid = msg.from!.id;
    await bot.sendMessage(uid, tr(getLang(uid) as Lang, 'supportText'), { parse_mode: 'Markdown' });
  });

  // ════════════════════════════════════════
  // ADMIN COMMANDS
  // ════════════════════════════════════════

  // /stats — статистика
  bot.onText(/\/stats/, async (msg) => {
    if (msg.from!.id !== ADMIN_ID) return;
    const stats = getOrderStats();
    const users = getUserCount();
    const pending = getPendingOrders().length;
    await bot.sendMessage(ADMIN_ID,
      `📊 *Статистика*\n\n` +
      `👥 Пользователей: *${users}*\n` +
      `🔍 На проверке: *${pending}*\n\n` +
      `📅 *Сегодня:* ${stats.today.cnt ?? 0} заказов / ${fmt(stats.today.total ?? 0)} сум\n` +
      `📅 *Неделя:* ${stats.week.cnt ?? 0} заказов / ${fmt(stats.week.total ?? 0)} сум\n` +
      `📅 *Месяц:* ${stats.month.cnt ?? 0} заказов / ${fmt(stats.month.total ?? 0)} сум`,
      { parse_mode: 'Markdown' }
    );
  });

  // /broadcast <текст> — рассылка всем
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
    await bot.sendMessage(ADMIN_ID,
      `✅ Рассылка завершена.\n✅ Доставлено: *${sent}*\n❌ Ошибок: *${failed}*`,
      { parse_mode: 'Markdown' }
    );
  });

  // /dm — отправить личное сообщение конкретному пользователю
  // Использование: /dm 123456789 Ваш заказ выполнен!
  bot.onText(/\/dm(?:\s+(.+))?/, async (msg, match) => {
    if (msg.from!.id !== ADMIN_ID) return;
    const args = match?.[1]?.trim();

    if (!args) {
      // Интерактивный режим — сначала спросить ID
      setState(ADMIN_ID, { step: 'awaiting_dm_target' });
      await bot.sendMessage(ADMIN_ID,
        '📨 *DM режим*\n\nВведите Telegram ID пользователя:',
        { parse_mode: 'Markdown', reply_markup: cancelKb() }
      );
      return;
    }

    // Инлайн режим: /dm 123456789 Текст сообщения
    const spaceIdx = args.indexOf(' ');
    if (spaceIdx === -1) {
      await bot.sendMessage(ADMIN_ID, '❌ Использование: `/dm 123456789 Текст сообщения`', { parse_mode: 'Markdown' });
      return;
    }
    const targetId = parseInt(args.substring(0, spaceIdx), 10);
    const text = args.substring(spaceIdx + 1);
    if (isNaN(targetId)) {
      await bot.sendMessage(ADMIN_ID, '❌ Неверный ID пользователя.');
      return;
    }
    try {
      await bot.sendMessage(targetId, `📨 *Сообщение от администратора:*\n\n${text}`, { parse_mode: 'Markdown' });
      await bot.sendMessage(ADMIN_ID, `✅ Сообщение отправлено пользователю \`${targetId}\`.`, { parse_mode: 'Markdown' });
    } catch {
      await bot.sendMessage(ADMIN_ID, `❌ Не удалось отправить. Пользователь ${targetId} заблокировал бота.`);
    }
  });

  // /addpromo <код> <сумма> <количество> — создать промокод
  bot.onText(/\/addpromo (\S+) (\d+) (\d+)/, async (msg, match) => {
    if (msg.from!.id !== ADMIN_ID) return;
    const code = match?.[1] ?? '';
    const bonus = parseInt(match?.[2] ?? '0', 10);
    const uses = parseInt(match?.[3] ?? '1', 10);
    createPromo(code, bonus, uses);
    await bot.sendMessage(ADMIN_ID,
      `✅ Промокод создан:\n\nКод: \`${code.toUpperCase()}\`\nБонус: *${fmt(bonus)} сум*\nИспользований: *${uses}*`,
      { parse_mode: 'Markdown' }
    );
  });

  // /pending — показать заказы на проверке
  bot.onText(/\/pending/, async (msg) => {
    if (msg.from!.id !== ADMIN_ID) return;
    const pending = getPendingOrders();
    if (!pending.length) {
      await bot.sendMessage(ADMIN_ID, '📭 Нет заказов на проверке.');
      return;
    }
    await bot.sendMessage(ADMIN_ID,
      `🔍 Заказов на проверке: *${pending.length}*`,
      { parse_mode: 'Markdown' }
    );
  });

  // ── Callbacks ──────────────────────────────────────────────
  bot.on('callback_query', async (q) => {
    const uid = q.from.id;
    const data = q.data ?? '';
    const lang = getLang(uid) as Lang;
    await bot.answerCallbackQuery(q.id);

    if (isFlood(uid, 500)) {
      await bot.sendMessage(uid, tr(lang, 'flood'));
      return;
    }

    // Language select
    if (data.startsWith('lang:')) {
      const l = data.split(':')[1] as Lang;
      setLang(uid, l);
      setState(uid, { step: 'main_menu' });
      await rmKbFn(q.message!.chat.id, q.message!.message_id);
      await bot.sendMessage(uid, tr(l, 'langChosen'));
      await bot.sendMessage(uid,
        tr(l, 'welcome', { name: q.from.first_name }),
        { reply_markup: mainKb(l), parse_mode: 'Markdown' }
      );
      return;
    }

    // Pay by card
    if (data === 'pay:card') {
      const state = getState(uid);
      setState(uid, { step: 'awaiting_receipt' });
      await rmKbFn(q.message!.chat.id, q.message!.message_id);
      await bot.sendMessage(uid,
        tr(lang, 'payCard', {
          card: CARD_NUMBER, holder: CARD_HOLDER,
          price: fmt(state.price!),
          product: state.productName!,
          username: state.targetUsername!,
        }),
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Pay by balance
    if (data === 'pay:balance') {
      const state = getState(uid);
      const ok = subtractBalance(uid, state.price!);
      if (!ok) {
        await bot.sendMessage(uid, tr(lang, 'notEnoughBal', {
          balance: fmt(getBalance(uid)),
          price: fmt(state.price!),
        }), { parse_mode: 'Markdown' });
        return;
      }
      const orderId = newOrderId();
      createOrder({
        id: orderId, user_id: uid,
        product_id: state.productId!,
        product_name: state.productName!,
        price: state.price!,
        target_username: state.targetUsername!,
        paid_by_balance: 1,
      });
      updateOrder(orderId, { status: 'under_review' });
      setState(uid, { step: 'main_menu' });
      await rmKbFn(q.message!.chat.id, q.message!.message_id);
      await bot.sendMessage(uid,
        tr(lang, 'paidByBalance', {
          product: state.productName!,
          username: state.targetUsername!,
          orderId,
        }),
        { parse_mode: 'Markdown', reply_markup: mainKb(lang) }
      );
      const u = getUser(uid);
      await bot.sendMessage(ADMIN_ID,
        `🛒 *Новый заказ (баланс)!*\n\n🆔 \`${orderId}\`\n📦 ${state.productName}\n💰 ${fmt(state.price!)} сум\n👤 @${state.targetUsername}\n🧑 ${u?.first_name ?? ''}${u?.username ? ` (@${u.username})` : ''}\n🪪 ID: ${uid}`,
        { parse_mode: 'Markdown', reply_markup: adminKb(orderId) }
      );
      return;
    }

    // Admin approve
    if (data.startsWith('approve:') && uid === ADMIN_ID) {
      const orderId = data.replace('approve:', '');
      const order = getOrder(orderId);
      if (!order) { await bot.sendMessage(uid, '❌ Заказ не найден.'); return; }
      updateOrder(orderId, { status: 'approved' });
      processCashback(order.user_id, order.price);
      await rmKbFn(q.message!.chat.id, q.message!.message_id);
      await bot.sendMessage(uid, `✅ Заказ \`${orderId}\` выполнен.`, { parse_mode: 'Markdown' });
      const ul = getLang(order.user_id) as Lang;
      try {
        await bot.sendMessage(order.user_id,
          tr(ul, 'approved', { product: order.product_name, username: order.target_username }),
          { parse_mode: 'Markdown', reply_markup: mainKb(ul) }
        );
      } catch { /* user blocked bot */ }
      return;
    }



    // Admin reject step 1
    if (data.startsWith('reject:') && uid === ADMIN_ID) {
      const orderId = data.replace('reject:', '');
      adminReject.set(uid, orderId);
      await rmKbFn(q.message!.chat.id, q.message!.message_id);
      await bot.sendMessage(uid, '✏️ Введите причину отклонения:');
      return;
    }
  });
  // ── Messages ───────────────────────────────────────────────
  bot.on('message', async (msg) => {
    const uid   = msg.from!.id;
    const lang  = getLang(uid) as Lang;
    const state = getState(uid);
    const text  = msg.text ?? '';

    if (isFlood(uid) && uid !== ADMIN_ID) {
  await bot.sendMessage(uid, tr(lang, 'flood'));
  return;
}

// ── CANCEL ───────────────────────────────────────────────
if (text === '❌ Отмена') {
  setState(uid, { step: 'main_menu' });
  await bot.sendMessage(uid, '↩️ Отменено.', { reply_markup: mainKb(lang) });
  return;
}

// ── ADMIN: reject reason ─────────────────────────────────
if (uid === ADMIN_ID) {
  const rejectId = adminReject.get(uid);
  if (rejectId && rejectId.startsWith('topup:')) {
      const parts = rejectId.split(':');
      const amount = parseInt(text.replace(/\D/g, ''), 10);
      if (isNaN(amount) || amount <= 0) {
        await bot.sendMessage(uid, '❌ Неверная сумма:');
        adminReject.set(uid, rejectId);
        return;
      }
      const targetUserId = parseInt(parts[2], 10);
      addBalance(targetUserId, amount);
      updateOrder(parts[1], { status: 'approved', admin_comment: String(amount) });
      await bot.sendMessage(uid, `✅ *${fmt(amount)} сум* зачислено \`${targetUserId}\``, { parse_mode: 'Markdown' });
      try {
        const ul = getLang(targetUserId) as Lang;
        await bot.sendMessage(targetUserId, `✅ *Балансингиз тўлдирилди!*\n\n💰 +*${fmt(amount)} сум*`, { parse_mode: 'Markdown', reply_markup: mainKb(ul) });
      } catch {}
      return;
  }

  // ADMIN: DM — ввод целевого ID
  if (state.step === 'awaiting_dm_target' && text && !text.startsWith('/')) {
    const targetId = parseInt(text.trim(), 10);
    if (isNaN(targetId)) {
      await bot.sendMessage(uid, '❌ Неверный ID. Введите числовой Telegram ID:');
      return;
    }
    setState(uid, { step: 'awaiting_dm_text', dmTarget: targetId });
    await bot.sendMessage(uid,
      `📨 Теперь введите текст сообщения для пользователя \`${targetId}\`:`,
      { parse_mode: 'Markdown', reply_markup: cancelKb() }
    );
    return;
  }

  // ADMIN: DM — ввод текста сообщения
  if (state.step === 'awaiting_dm_text' && text && !text.startsWith('/')) {
    const targetId = state.dmTarget!;
    setState(uid, { step: 'main_menu', dmTarget: undefined });
    try {
      await bot.sendMessage(targetId,
        `📨 *Сообщение от администратора:*\n\n${text}`,
        { parse_mode: 'Markdown' }
      );
      await bot.sendMessage(uid,
        `✅ Сообщение доставлено пользователю \`${targetId}\`.`,
        { parse_mode: 'Markdown', reply_markup: { remove_keyboard: true } }
      );
    } catch {
      await bot.sendMessage(uid,
        `❌ Не удалось доставить. Пользователь \`${targetId}\` заблокировал бота.`,
        { parse_mode: 'Markdown', reply_markup: { remove_keyboard: true } }
      );
    }
    return;
  }
}  
 

    // ── Web App data ─────────────────────────────────────────
    if (msg.web_app_data?.data) {
      try {
        const d = JSON.parse(msg.web_app_data.data);
        if (d.action === 'topup') {
          setState(uid, { step: 'awaiting_receipt', productId: 'topup', productName: 'Пополнение баланса', price: 0 });
          await bot.sendMessage(uid,
            `💰 *Пополнение баланса*\n\nКарта: \`${CARD_NUMBER}\`\nВладелец: ${CARD_HOLDER}\n\n📸 Любую сумму переведите и пришлите скриншот чека.`,
            { parse_mode: 'Markdown' }
          );
          return;
        }
        // If target_username already sent from Web App
        if (d.target_username) {
          const cleaned = d.target_username.replace('@', '').trim();
          setState(uid, { step: 'awaiting_payment', targetUsername: cleaned });
          const balance = getBalance(uid);
          await bot.sendMessage(uid,
            tr(lang, 'choosePayment', {
              product: d.product_name,
              price: fmt(d.price),
              username: cleaned,
            }),
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: tr(lang, 'payByCard'), callback_data: 'pay:card' }],
                  [{ text: tr(lang, 'payByBalance', { balance: fmt(balance) }), callback_data: 'pay:balance' }],
                ],
              },
            }
          );
        } else {
          await bot.sendMessage(uid, tr(lang, 'enterUsername'), {
            reply_markup: { remove_keyboard: true },
          });
        }
      } catch {
        await bot.sendMessage(uid, '❌ Ошибка данных. Попробуйте ещё раз.');
      }
      return;
    }

    // ── Awaiting username ────────────────────────────────────
    if (state.step === 'awaiting_username' && text && !text.startsWith('/')) {
      const cleaned = text.replace('@', '').trim();
      if (!/^[a-zA-Z0-9_]{5,32}$/.test(cleaned)) {
        await bot.sendMessage(uid, tr(lang, 'invalidUser'));
        return;
      }
      setState(uid, { step: 'awaiting_payment', targetUsername: cleaned });
      const balance = getBalance(uid);
      await bot.sendMessage(uid,
        tr(lang, 'choosePayment', {
          product: state.productName!, price: fmt(state.price!), username: cleaned,
        }),
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: tr(lang, 'payByCard'), callback_data: 'pay:card' }],
              [{ text: tr(lang, 'payByBalance', { balance: fmt(balance) }), callback_data: 'pay:balance' }],
            ],
          },
        }
      );
      return;
    }

    // ── Awaiting receipt photo ───────────────────────────────
    if (state.step === 'awaiting_receipt') {
      let fileId: string | undefined;
      if (msg.photo)         fileId = msg.photo[msg.photo.length - 1].file_id;
      else if (msg.document) fileId = msg.document.file_id;

      if (!fileId) { await bot.sendMessage(uid, tr(lang, 'sendPhoto')); return; }

    
      if (state.productId === 'topup') {
        const topupId = newOrderId();
        createOrder({ id: topupId, user_id: uid, product_id: 'topup', product_name: 'Пополнение баланса', price: 0, target_username: String(uid) });
        updateOrder(topupId, { status: 'under_review', receipt_file_id: fileId });
        setState(uid, { step: 'main_menu' });
        await bot.sendMessage(uid, `✅ *Чек получен!*\n\n🕐 До 30 минут.\n🆔 \`${topupId}\``, { parse_mode: 'Markdown', reply_markup: mainKb(lang) });
        const u = getUser(uid);
        await bot.sendPhoto(ADMIN_ID, fileId, {
          caption: `💰 *Запрос на пополнение!*\n\n🧑 ${u?.first_name ?? ''}${u?.username ? ` (@${u.username})` : ''}\n🪪 ID: ${uid}\n🆔 \`${topupId}\`\n\nВведите сумму:`,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[
            { text: '✅ Подтвердить', callback_data: `topup:${topupId}:${uid}` },
            { text: '❌ Отклонить',  callback_data: `reject:${topupId}` },
          ]]},
        });
        return;
      }

      const orderId = newOrderId();
      createOrder({
        id: orderId, user_id: uid,
        product_id: state.productId!,
        product_name: state.productName!,
        price: state.price!,
        target_username: state.targetUsername!,
      });
      updateOrder(orderId, { status: 'under_review', receipt_file_id: fileId });
      setState(uid, { step: 'main_menu' });
      await bot.sendMessage(uid,
        tr(lang, 'receiptOk', { orderId }),
        { parse_mode: 'Markdown', reply_markup: mainKb(lang) }
      );
      const u = getUser(uid);
      await bot.sendPhoto(ADMIN_ID, fileId, {
        caption:
          `🛒 *Новый заказ!*\n\n🆔 \`${orderId}\`\n📦 ${state.productName}\n💰 ${fmt(state.price!)} сум\n👤 @${state.targetUsername}\n🧑 ${u?.first_name ?? ''}${u?.username ? ` (@${u.username})` : ''}\n🪪 ID: ${uid}`,
        parse_mode: 'Markdown',
        reply_markup: adminKb(orderId),
      });
      return;
    }

    // ── Promo code input}

    // ── Menu buttons ─────────────────────────────────────────
    if (text === tr(lang, 'profile')) {
      const u = getUser(uid);
      const orders = getUserOrders(uid);
      await bot.sendMessage(uid,
        tr(lang, 'profileText', {
          id: String(uid),
          name: u?.first_name ?? '',
          balance: fmt(u?.balance ?? 0),
          refs: String(getReferralCount(uid)),
          earned: fmt(getReferralEarnings(uid)),
          orders: String(orders.length),
        }),
        { parse_mode: 'Markdown' }
      );
      return;
    }

    if (text === tr(lang, 'referral')) {
      const botInfo = await bot.getMe();
      const link = `https://t.me/${botInfo.username}?start=${uid}`;
      await bot.sendMessage(uid,
        tr(lang, 'refText', {
          link,
          count: String(getReferralCount(uid)),
          earned: fmt(getReferralEarnings(uid)),
        }),
        { parse_mode: 'Markdown' }
      );
      return;
    }

    if (text === tr(lang, 'myOrders')) {
      const list = getUserOrders(uid);
      if (!list.length) { await bot.sendMessage(uid, tr(lang, 'noOrders')); return; }
      let out = tr(lang, 'ordersTitle');
      for (const o of list) {
        out += `🆔 \`${o.id}\`\n📦 ${o.product_name}\n📊 ${tr(lang, `status.${o.status}`)}\n📅 ${o.created_at.slice(0, 10)}\n\n`;
      }
      await bot.sendMessage(uid, out, { parse_mode: 'Markdown' });
      return;
    }

    if (text === tr(lang, 'support')) {
      await bot.sendMessage(uid, tr(lang, 'supportText'), { parse_mode: 'Markdown' });
      return;
    }

    if (text === tr(lang, 'promoCmd')) {
      setState(uid, { step: 'awaiting_promo' });
      await bot.sendMessage(uid, tr(lang, 'promoAsk'), {
        reply_markup: cancelKb(),
      });
      return;
    }

    if (text === tr(lang, 'changeLang')) {
      await bot.sendMessage(uid, tr('ru', 'chooseLang'), { reply_markup: langKb() });
      return;
    }

    // Topup balance button from Web App
    if (text === '💰 Пополнить баланс' || text === '💰 Balansni to\'ldirish') {
      await bot.sendMessage(uid, tr(lang, 'topupMsg'), { parse_mode: 'Markdown' });
      return;
    }

    // Default
    if (state.step === 'main_menu' || state.step === 'idle') {
      await bot.sendMessage(uid,
        tr(lang, 'welcome', { name: msg.from!.first_name }),
        { reply_markup: mainKb(lang), parse_mode: 'Markdown' }
      );
    }
  });

  process.once('SIGINT',  () => { bot.stopPolling(); process.exit(0); });
  process.once('SIGTERM', () => { bot.stopPolling(); process.exit(0); });
}

startBot().catch(err => { console.error('Fatal:', err); process.exit(1); });
