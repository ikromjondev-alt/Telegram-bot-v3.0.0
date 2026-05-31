import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

import {
  upsertUser, getUser, setLang, getLang, getBalance,
  subtractBalance, getAllUserIds, getUserCount,
  createOrder, getOrder, updateOrder, getUserOrders,
  getPendingOrders, processCashback, getReferralCount, getReferralEarnings,
} from './database';
import { isFlood } from './middlewares';

const BOT_TOKEN   = process.env.BOT_TOKEN!;
const ADMIN_ID    = 8150331577;
const WEBAPP_URL  = process.env.WEBAPP_URL ?? '';
const PORT        = parseInt(process.env.PORT ?? '3000', 10);
const CARD_NUMBER = process.env.UZCARD_NUMBER ?? '5614 6821 1076 2236';
const CARD_HOLDER = process.env.UZCARD_HOLDER ?? 'I.Tojiboyev';

type Lang = 'ru' | 'uz';

const T: Record<Lang, any> = {
  ru: {
    chooseLang:    '🌐 Выберите язык:',
    langChosen:    '✅ Язык: Русский',
    welcome:       '👋 Добро пожаловать, {name}!\n\nПокупайте Telegram Premium и Stars быстро и надёжно.',
    openShop:      '🛍 Открыть магазин',
    profile:       '👤 Профиль',
    referral:      '👥 Реферальная программа',
    myOrders:      '📋 Мои заказы',
    support:       '💬 Поддержка',
    changeLang:    '🌐 Язык',
    profileText:   '👤 *Ваш профиль*\n\n🆔 ID: `{id}`\n💰 Баланс: *{balance} сум*\n👥 Рефералов: *{refs}*\n💸 Заработано: *{earned} сум*',
    refText:       '👥 *Реферальная программа*\n\nПриглашайте друзей и получайте *3% кэшбек* с каждой их покупки на ваш баланс!\n\n🔗 Ваша ссылка:\n`{link}`\n\n👥 Приглашено: *{count}* чел.\n💸 Заработано: *{earned} сум*',
    enterUsername: '📝 Введите @username получателя:',
    invalidUser:   '❌ Неверный username. Попробуйте ещё раз:',
    choosePayment: '💳 Выберите способ оплаты:\n\n📦 *{product}*\n💰 Сумма: *{price} сум*\n👤 Получатель: @{username}',
    payByCard:     '💳 Оплатить картой Uzcard',
    payByBalance:  '💰 Оплатить с баланса ({balance} сум)',
    notEnoughBal:  '❌ Недостаточно средств.\n\n💰 Баланс: {balance} сум\n💳 Нужно: {price} сум',
    paidByBalance: '✅ Оплачено с баланса!\n\n📦 {product}\n👤 @{username}\n🆔 Заказ: `{orderId}`\n\n⏳ Ожидайте выполнения.',
    payCard:       '💳 *Оплата через Uzcard*\n\nНомер карты: `{card}`\nВладелец: {holder}\n\n💰 Сумма: *{price} сум*\n📦 {product}\n👤 @{username}\n\n📸 После оплаты отправьте скриншот чека.',
    receiptOk:     '✅ Чек получен! Ожидайте подтверждения.\n\n🕐 До 30 минут.\n🆔 Заказ: `{orderId}`',
    sendPhoto:     '📸 Отправьте фото чека.',
    approved:      '🎉 *Заказ выполнен!*\n\n📦 {product}\n👤 @{username}\n\nСпасибо за покупку!',
    rejected:      '❌ *Заказ отклонён.*\n\n📦 {product}\n💬 Причина: {reason}',
    noOrders:      '📭 Заказов пока нет.',
    ordersTitle:   '📋 *Ваши заказы:*\n\n',
    supportText:   '💬 Поддержка: @Tadjibaev_i\n⏰ 9:00–22:00 (UTC+5)',
    flood:         '⏳ Не так быстро!',
    status: {
      awaiting_receipt: '⏳ Ожидает чек',
      under_review:     '🔍 На проверке',
      approved:         '✅ Выполнен',
      rejected:         '❌ Отклонён',
      paid_by_balance:  '✅ Оплачен балансом',
    },
  },
  uz: {
    chooseLang:    '🌐 Tilni tanlang:',
    langChosen:    '✅ Til: O\'zbek',
    welcome:       '👋 Xush kelibsiz, {name}!\n\nTelegram Premium va Stars sotib oling — tez va ishonchli.',
    openShop:      '🛍 Do\'konni ochish',
    profile:       '👤 Profil',
    referral:      '👥 Referal dasturi',
    myOrders:      '📋 Buyurtmalarim',
    support:       '💬 Qo\'llab-quvvatlash',
    changeLang:    '🌐 Til',
    profileText:   '👤 *Profilingiz*\n\n🆔 ID: `{id}`\n💰 Balans: *{balance} so\'m*\n👥 Referallar: *{refs}*\n💸 Ishlangan: *{earned} so\'m*',
    refText:       '👥 *Referal dasturi*\n\nDo\'stlaringizni taklif qiling va har bir xaridlaridan *3% cashback* oling!\n\n🔗 Sizning havolangiz:\n`{link}`\n\n👥 Taklif qilingan: *{count}* kishi\n💸 Ishlangan: *{earned} so\'m*',
    enterUsername: '📝 Qabul qiluvchining @username ni kiriting:',
    invalidUser:   '❌ Noto\'g\'ri username. Qayta urinib ko\'ring:',
    choosePayment: '💳 To\'lov usulini tanlang:\n\n📦 *{product}*\n💰 Summa: *{price} so\'m*\n👤 Qabul qiluvchi: @{username}',
    payByCard:     '💳 Uzcard orqali to\'lash',
    payByBalance:  '💰 Balansdan to\'lash ({balance} so\'m)',
    notEnoughBal:  '❌ Balansda mablag\' yetarli emas.\n\n💰 Balans: {balance} so\'m\n💳 Kerak: {price} so\'m',
    paidByBalance: '✅ Balansdan to\'landi!\n\n📦 {product}\n👤 @{username}\n🆔 Buyurtma: `{orderId}`\n\n⏳ Bajarilishini kuting.',
    payCard:       '💳 *Uzcard orqali to\'lov*\n\nKarta raqami: `{card}`\nEgasi: {holder}\n\n💰 Summa: *{price} so\'m*\n📦 {product}\n👤 @{username}\n\n📸 To\'lovdan so\'ng chek skrinshotini yuboring.',
    receiptOk:     '✅ Chek qabul bo\'ldi!\n\n🕐 30 daqiqagacha.\n🆔 Buyurtma: `{orderId}`',
    sendPhoto:     '📸 Chek rasmini yuboring.',
    approved:      '🎉 *Buyurtma bajarildi!*\n\n📦 {product}\n👤 @{username}\n\nRahmat!',
    rejected:      '❌ *Buyurtma rad etildi.*\n\n📦 {product}\n💬 Sabab: {reason}',
    noOrders:      '📭 Buyurtmalar yo\'q.',
    ordersTitle:   '📋 *Buyurtmalaringiz:*\n\n',
    supportText:   '💬 Qo\'llab-quvvatlash: @Tadjibaev_i\n⏰ 9:00–22:00 (UTC+5)',
    flood:         '⏳ Shoshilmang!',
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

type Step = 'idle' | 'main_menu' | 'awaiting_username' | 'awaiting_payment' | 'awaiting_receipt';

interface State {
  step: Step;
  productId?: string;
  productName?: string;
  price?: number;
  targetUsername?: string;
  orderId?: string;
}

const states = new Map<number, State>();
function getState(uid: number): State { return states.get(uid) ?? { step: 'idle' }; }
function setState(uid: number, s: Partial<State>): void { states.set(uid, { ...getState(uid), ...s }); }
const adminReject = new Map<number, string>();

let _oid = 1;
function newOrderId(): string {
  return `ORD-${Date.now().toString(36).toUpperCase()}-${(_oid++).toString().padStart(3,'0')}`;
}
function fmt(n: number): string { return n.toLocaleString('ru-RU'); }

// ─── Express ──────────────────────────────────────────────────
const app = express();
const publicPath = path.join(process.cwd(), 'public');
app.use(express.static(publicPath));
app.get('/', (_req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});
app.listen(PORT, () => console.log(`🌐 Port ${PORT}`));

// ─── Bot ──────────────────────────────────────────────────────
async function startBot() {
  const bot = new TelegramBot(BOT_TOKEN, {
    polling: { interval: 300, autoStart: false, params: { timeout: 10 } },
  });

  try { await bot.deleteWebHook(); } catch {}
  await bot.startPolling();
  console.log('🤖 Bot started');

  const mainKb = (lang: Lang): TelegramBot.ReplyKeyboardMarkup => ({
    keyboard: [
      [{ text: tr(lang,'openShop'), web_app: { url: WEBAPP_URL } }],
      [{ text: tr(lang,'profile') }, { text: tr(lang,'referral') }],
      [{ text: tr(lang,'myOrders') }, { text: tr(lang,'support') }],
      [{ text: tr(lang,'changeLang') }],
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

  bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
    const uid = msg.from!.id;
    const refId = match?.[1] ? parseInt(match[1]) : undefined;
    upsertUser({
      id: uid, username: msg.from!.username,
      first_name: msg.from!.first_name,
      referred_by: refId !== uid ? refId : undefined,
    });
    setState(uid, { step: 'main_menu' });
    const lang = getLang(uid) as Lang;
    await bot.sendMessage(uid, tr(lang,'chooseLang'), { reply_markup: langKb() });
  });

  bot.onText(/\/broadcast (.+)/, async (msg, match) => {
    if (msg.from!.id !== ADMIN_ID) return;
    const text = match?.[1];
    if (!text) return;
    const ids = getAllUserIds();
    let sent = 0, failed = 0;
    for (const id of ids) {
      try { await bot.sendMessage(id, text, { parse_mode: 'Markdown' }); sent++; }
      catch { failed++; }
      await new Promise(r => setTimeout(r, 50));
    }
    await bot.sendMessage(ADMIN_ID, `✅ Рассылка завершена.\n✅ Доставлено: ${sent}\n❌ Ошибок: ${failed}`);
  });

  bot.onText(/\/stats/, async (msg) => {
    if (msg.from!.id !== ADMIN_ID) return;
    const users = getUserCount();
    const pending = getPendingOrders().length;
    await bot.sendMessage(ADMIN_ID,
      `📊 *Статистика*\n\n👥 Пользователей: *${users}*\n🔍 На проверке: *${pending}*`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.on('callback_query', async (q) => {
    const uid  = q.from.id;
    const data = q.data ?? '';
    const lang = getLang(uid) as Lang;
    await bot.answerCallbackQuery(q.id);

    if (isFlood(uid, 500)) {
      await bot.sendMessage(uid, tr(lang,'flood'));
      return;
    }

    const rmKb = async () => {
      try {
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: q.message!.chat.id, message_id: q.message!.message_id }
        );
      } catch {}
    };

    if (data.startsWith('lang:')) {
      const l = data.split(':')[1] as Lang;
      setLang(uid, l);
      setState(uid, { step: 'main_menu' });
      await rmKb();
      await bot.sendMessage(uid, tr(l,'langChosen'));
      await bot.sendMessage(uid, tr(l,'welcome', { name: q.from.first_name }), {
        reply_markup: mainKb(l), parse_mode: 'Markdown',
      });
      return;
    }

    if (data === 'pay:card') {
      const state = getState(uid);
      setState(uid, { step: 'awaiting_receipt' });
      await rmKb();
      await bot.sendMessage(uid,
        tr(lang,'payCard', {
          card: CARD_NUMBER, holder: CARD_HOLDER,
          price: fmt(state.price!),
          product: state.productName!,
          username: state.targetUsername!,
        }),
        { parse_mode: 'Markdown' }
      );
      return;
    }

    if (data === 'pay:balance') {
      const state = getState(uid);
      const ok = subtractBalance(uid, state.price!);
      if (!ok) {
        await bot.sendMessage(uid, tr(lang,'notEnoughBal', {
          balance: fmt(require('./database').getBalance(uid)),
          price: fmt(state.price!),
        }));
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
      await rmKb();
      await bot.sendMessage(uid,
        tr(lang,'paidByBalance', {
          product: state.productName!, username: state.targetUsername!, orderId,
        }),
        { parse_mode: 'Markdown', reply_markup: mainKb(lang) }
      );
      await bot.sendMessage(ADMIN_ID,
        `🛒 *Новый заказ (баланс)!*\n\n🆔 \`${orderId}\`\n📦 ${state.productName}\n💰 ${fmt(state.price!)} сум\n👤 @${state.targetUsername}\n🧑 ${q.from.first_name} (ID: ${uid})`,
        { parse_mode: 'Markdown', reply_markup: adminKb(orderId) }
      );
      return;
    }

    if (data.startsWith('approve:') && uid === ADMIN_ID) {
      const orderId = data.replace('approve:', '');
      const order = getOrder(orderId);
      if (!order) { await bot.sendMessage(uid, '❌ Заказ не найден.'); return; }
      updateOrder(orderId, { status: 'approved' });
      processCashback(order.user_id, order.price);
      await rmKb();
      await bot.sendMessage(uid, `✅ Заказ \`${orderId}\` выполнен.`, { parse_mode: 'Markdown' });
      const ul = getLang(order.user_id) as Lang;
      try {
        await bot.sendMessage(order.user_id,
          tr(ul,'approved', { product: order.product_name, username: order.target_username }),
          { parse_mode: 'Markdown', reply_markup: mainKb(ul) }
        );
      } catch {}
      return;
    }

    if (data.startsWith('reject:') && uid === ADMIN_ID) {
      const orderId = data.replace('reject:', '');
      adminReject.set(uid, orderId);
      await rmKb();
      await bot.sendMessage(uid, '✏️ Введите причину отклонения:');
      return;
    }
  });

  bot.on('message', async (msg) => {
    const uid   = msg.from!.id;
    const lang  = getLang(uid) as Lang;
    const state = getState(uid);
    const text  = msg.text ?? '';

    if (isFlood(uid) && uid !== ADMIN_ID) {
      await bot.sendMessage(uid, tr(lang,'flood'));
      return;
    }

    if (uid === ADMIN_ID) {
      const rejectId = adminReject.get(uid);
      if (rejectId && text && !text.startsWith('/')) {
        adminReject.delete(uid);
        const order = getOrder(rejectId);
        if (!order) { await bot.sendMessage(uid, '❌ Заказ не найден.'); return; }
        updateOrder(rejectId, { status: 'rejected', admin_comment: text });
        await bot.sendMessage(uid, `✅ Заказ \`${rejectId}\` отклонён.`, { parse_mode: 'Markdown' });
        const ul = getLang(order.user_id) as Lang;
        try {
          await bot.sendMessage(order.user_id,
            tr(ul,'rejected', { product: order.product_name, reason: text }),
            { parse_mode: 'Markdown', reply_markup: mainKb(ul) }
          );
        } catch {}
        return;
      }
    }

    if (msg.web_app_data?.data) {
      try {
        const d = JSON.parse(msg.web_app_data.data);
        setState(uid, {
          step: 'awaiting_username',
          productId: d.product_id,
          productName: d.product_name,
          price: d.price,
        });
        await bot.sendMessage(uid, tr(lang,'enterUsername'), { reply_markup: { remove_keyboard: true } });
      } catch {
        await bot.sendMessage(uid, '❌ Ошибка. Попробуйте ещё раз.');
      }
      return;
    }

    if (state.step === 'awaiting_username' && text && !text.startsWith('/')) {
      const cleaned = text.replace('@','').trim();
      if (!/^[a-zA-Z0-9_]{5,32}$/.test(cleaned)) {
        await bot.sendMessage(uid, tr(lang,'invalidUser'));
        return;
      }
      setState(uid, { step: 'awaiting_payment', targetUsername: cleaned });
      const balance = require('./database').getBalance(uid);
      await bot.sendMessage(uid,
        tr(lang,'choosePayment', {
          product: state.productName!, price: fmt(state.price!), username: cleaned,
        }),
        { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [
          [{ text: tr(lang,'payByCard'), callback_data: 'pay:card' }],
          [{ text: tr(lang,'payByBalance', { balance: fmt(balance) }), callback_data: 'pay:balance' }],
        ]}},
      );
      return;
    }

    if (state.step === 'awaiting_receipt') {
      let fileId: string | undefined;
      if (msg.photo)         fileId = msg.photo[msg.photo.length - 1].file_id;
      else if (msg.document) fileId = msg.document.file_id;

      if (!fileId) { await bot.sendMessage(uid, tr(lang,'sendPhoto')); return; }

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
        tr(lang,'receiptOk', { orderId }),
        { parse_mode: 'Markdown', reply_markup: mainKb(lang) }
      );

      const user = getUser(uid);
      await bot.sendPhoto(ADMIN_ID, fileId, {
        caption:
          `🛒 *Новый заказ!*\n\n🆔 \`${orderId}\`\n📦 ${state.productName}\n💰 ${fmt(state.price!)} сум\n👤 @${state.targetUsername}\n🧑 ${msg.from!.first_name}` +
          (user?.username ? ` (@${user.username})` : '') + `\n🪪 ID: ${uid}`,
        parse_mode: 'Markdown',
        reply_markup: adminKb(orderId),
      });
      return;
    }

    if (text === tr(lang,'profile')) {
      const u = getUser(uid);
      await bot.sendMessage(uid,
        tr(lang,'profileText', {
          id: String(uid),
          balance: fmt(u?.balance ?? 0),
          refs: String(getReferralCount(uid)),
          earned: fmt(getReferralEarnings(uid)),
        }),
        { parse_mode: 'Markdown' }
      );
      return;
    }

    if (text === tr(lang,'referral')) {
      const link = `https://t.me/${(await bot.getMe()).username}?start=${uid}`;
      await bot.sendMessage(uid,
        tr(lang,'refText', {
          link, count: String(getReferralCount(uid)),
          earned: fmt(getReferralEarnings(uid)),
        }),
        { parse_mode: 'Markdown' }
      );
      return;
    }

    if (text === tr(lang,'myOrders')) {
      const list = getUserOrders(uid);
      if (!list.length) { await bot.sendMessage(uid, tr(lang,'noOrders')); return; }
      let out = tr(lang,'ordersTitle');
      for (const o of list) {
        out += `🆔 \`${o.id}\`\n📦 ${o.product_name}\n📊 ${tr(lang,`status.${o.status}`)}\n\n`;
      }
      await bot.sendMessage(uid, out, { parse_mode: 'Markdown' });
      return;
    }

    if (text === tr(lang,'support')) {
      await bot.sendMessage(uid, tr(lang,'supportText'));
      return;
    }

    if (text === tr(lang,'changeLang')) {
      await bot.sendMessage(uid, tr('ru','chooseLang'), { reply_markup: langKb() });
      return;
    }

    if (state.step === 'main_menu' || state.step === 'idle') {
      await bot.sendMessage(uid, tr(lang,'welcome', { name: msg.from!.first_name }), {
        reply_markup: mainKb(lang), parse_mode: 'Markdown',
      });
    }
  });

  process.once('SIGINT',  () => { bot.stopPolling(); process.exit(0); });
  process.once('SIGTERM', () => { bot.stopPolling(); process.exit(0); });
}

startBot().catch(err => { console.error('Fatal:', err); process.exit(1); });
