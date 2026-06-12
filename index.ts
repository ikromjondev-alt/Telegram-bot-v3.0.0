import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

import {
  upsertUser,
  getUser,
  setLang,
  getLang,
  getBalance,
  addBalance,
  subtractBalance,
  getAllUserIds,
  getUserCount,
  createOrder,
  getOrder,
  updateOrder,
  getUserOrders,
  getPendingOrders,
  getOrderStats,
  processCashback,
  getReferralCount,
  getReferralEarnings,
  createPromo,
  usePromo,
} from './database';

import { isFlood } from './middlewares';

const BOT_TOKEN   = process.env.BOT_TOKEN!;
const ADMIN_ID    = parseInt(process.env.ADMIN_ID ?? '8150331577', 10);
const WEBAPP_URL  = process.env.WEBAPP_URL ?? '';
const PORT        = parseInt(process.env.PORT ?? '3000', 10);

const CARD_NUMBER = process.env.UZCARD_NUMBER ?? '5614 6821 1076 2236';
const CARD_HOLDER = process.env.UZCARD_HOLDER ?? 'I.Tojiboyev';

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN missing');
  process.exit(1);
}

type Lang = 'ru' | 'uz';
const T: Record<Lang, any> = {
  ru: {
    chooseLang: '🌐 Выберите язык',
    langChosen: '✅ Язык успешно изменён',

    welcome:
      '👋 Добро пожаловать, *{name}*!\n\nВыберите нужный раздел ниже.',

    openShop: '🛍 Открыть магазин',
    profile: '👤 Профиль',
    referral: '👥 Рефералы',
    myOrders: '📦 Мои заказы',
    support: '🎧 Поддержка',
    promoCmd: '🎁 Промокод',
    changeLang: '🌐 Сменить язык',

    flood: '⏳ Слишком быстро. Попробуйте через пару секунд.',

    enterUsername:
      '✏️ Отправьте username получателя без символа @',

    invalidUser:
      '❌ Неверный username.\n\nПример: `telegram`',

    choosePayment:
      '📦 Товар: *{product}*\n' +
      '👤 Получатель: *@{username}*\n' +
      '💰 Цена: *{price} сум*\n\n' +
      'Выберите способ оплаты:',

    payByCard: '💳 Оплата картой',
    payByBalance: '💰 Баланс ({balance})',

    payCard:
      '💳 *Оплата заказа*\n\n' +
      '📦 Товар: *{product}*\n' +
      '👤 Username: *@{username}*\n' +
      '💰 Сумма: *{price} сум*\n\n' +
      'Карта: `{card}`\n' +
      'Получатель: *{holder}*\n\n' +
      '📸 После оплаты отправьте чек.',

    notEnoughBal:
      '❌ Недостаточно средств.\n\n' +
      'Баланс: *{balance}*\n' +
      'Необходимо: *{price}*',

    paidByBalance:
      '✅ Заказ оформлен.\n\n' +
      '📦 {product}\n' +
      '👤 @{username}\n' +
      '🆔 `{orderId}`',

    receiptOk:
      '✅ Чек получен.\n\n' +
      'Заказ отправлен на проверку.\n' +
      '🆔 `{orderId}`',

    approved:
      '🎉 Ваш заказ выполнен!\n\n' +
      '📦 {product}\n' +
      '👤 @{username}',

    rejected:
      '❌ Заказ отклонён.\n\n' +
      '📦 {product}\n' +
      'Причина:\n{reason}',

    sendPhoto:
      '📸 Отправьте фото чека или документ.',

    promoAsk:
      '🎁 Введите промокод:',

    promoOk:
      '✅ Промокод активирован!\n\n' +
      '💰 Бонус: *{bonus} сум*',

    promoFail:
      '❌ Промокод недействителен или уже использован.',

    profileText:
      '👤 *Ваш профиль*\n\n' +
      '🪪 ID: `{id}`\n' +
      '🧑 Имя: {name}\n' +
      '💰 Баланс: *{balance} сум*\n' +
      '👥 Рефералы: *{refs}*\n' +
      '🏆 Заработано: *{earned} сум*\n' +
      '📦 Заказов: *{orders}*',

    refText:
      '👥 *Реферальная программа*\n\n' +
      '🔗 Ваша ссылка:\n{link}\n\n' +
      '👥 Приглашено: *{count}*\n' +
      '🏆 Заработано: *{earned} сум*',

    noOrders:
      '📭 У вас пока нет заказов.',

    ordersTitle:
      '📦 *Последние заказы*\n\n',

    supportText:
      '🎧 Поддержка:\n@Tadjibaev_i',

    topupMsg:
      '💰 Пополнение баланса временно доступно через администратора.',

    status: {
      awaiting_receipt: 'Ожидание чека',
      under_review: 'На проверке',
      approved: 'Выполнен',
      rejected: 'Отклонён',
    },
  },

  uz: {
    chooseLang: '🌐 Tilni tanlang',
    langChosen: '✅ Til muvaffaqiyatli o‘zgartirildi',

    welcome:
      '👋 Xush kelibsiz, *{name}*!\n\nKerakli bo‘limni tanlang.',

    openShop: '🛍 Do‘konni ochish',
    profile: '👤 Profil',
    referral: '👥 Referallar',
    myOrders: '📦 Buyurtmalarim',
    support: '🎧 Yordam',
    promoCmd: '🎁 Promo kod',
    changeLang: '🌐 Tilni o‘zgartirish',

    flood:
      '⏳ Juda tez harakat qilyapsiz. Biroz kuting.',

    enterUsername:
      '✏️ Foydalanuvchi usernamesini yuboring (@siz).',

    invalidUser:
      '❌ Username noto‘g‘ri.\n\nMisol: `telegram`',

    choosePayment:
      '📦 Mahsulot: *{product}*\n' +
      '👤 Username: *@{username}*\n' +
      '💰 Narxi: *{price} so‘m*\n\n' +
      'To‘lov usulini tanlang:',

    payByCard: '💳 Karta orqali',
    payByBalance: '💰 Balans ({balance})',
    if (state.step === 'awaiting_promo' && text && !text.startsWith('/')) {
      const promo = text.trim();
      const res = usePromo(uid, promo);

      if (res.ok) {
        await bot.sendMessage(
          uid,
          tr(lang, 'promoOk', {
            bonus: fmt(res.bonus!)
          }),
          { parse_mode: 'Markdown' }
        );
      } else {
        await bot.sendMessage(
          uid,
          tr(lang, 'promoFail'),
          { parse_mode: 'Markdown' }
        );
      }

      setState(uid, { step: 'main_menu' });

      await bot.sendMessage(
        uid,
        'Главное меню',
        {
          reply_markup: mainKb(lang)
        }
      );

      return;
    }

    if (text === tr(lang, 'profile')) {
      const u = getUser(uid);
      const orders = getUserOrders(uid);

      await bot.sendMessage(
        uid,
        tr(lang, 'profileText', {
          id: String(uid),
          name: u?.first_name ?? '',
          balance: fmt(u?.balance ?? 0),
          refs: String(getReferralCount(uid)),
          earned: fmt(getReferralEarnings(uid)),
          orders: String(orders.length),
        }),
        {
          parse_mode: 'Markdown'
        }
      );

      return;
    }

    if (text === tr(lang, 'referral')) {
      const botInfo = await bot.getMe();

      const link =
        `https://t.me/${botInfo.username}?start=${uid}`;

      await bot.sendMessage(
        uid,
        tr(lang, 'refText', {
          link,
          count: String(getReferralCount(uid)),
          earned: fmt(getReferralEarnings(uid)),
        }),
        {
          parse_mode: 'Markdown'
        }
      );

      return;
    }

    if (text === tr(lang, 'myOrders')) {
      const list = getUserOrders(uid);

      if (!list.length) {
        await bot.sendMessage(
          uid,
          tr(lang, 'noOrders')
        );

        return;
      }

      let out = tr(lang, 'ordersTitle');

      for (const o of list) {
        out +=
          `🆔 \`${o.id}\`\n` +
          `📦 ${o.product_name}\n` +
          `📊 ${tr(lang, `status.${o.status}`)}\n` +
          `📅 ${o.created_at.slice(0, 10)}\n\n`;
      }

      await bot.sendMessage(
        uid,
        out,
        {
          parse_mode: 'Markdown'
        }
      );

      return;
    }

    if (text === tr(lang, 'support')) {
      await bot.sendMessage(
        uid,
        tr(lang, 'supportText'),
        {
          parse_mode: 'Markdown'
        }
      );

      return;
    }

    if (text === tr(lang, 'promoCmd')) {
      setState(uid, {
        step: 'awaiting_promo'
      });

      await bot.sendMessage(
        uid,
        tr(lang, 'promoAsk'),
        {
          reply_markup: cancelKb()
        }
      );

      return;
    }

    if (text === tr(lang, 'changeLang')) {
      await bot.sendMessage(
        uid,
        tr('ru', 'chooseLang'),
        {
          reply_markup: langKb()
        }
      );

      return;
    }

    if (
      text === '💰 Пополнить баланс' ||
      text === "💰 Balansni to'ldirish"
    ) {
      await bot.sendMessage(
        uid,
        tr(lang, 'topupMsg'),
        {
          parse_mode: 'Markdown'
        }
      );

      return;
}
if (state.step === 'main_menu' || state.step === 'idle') {
      await bot.sendMessage(
        uid,
        tr(lang, 'welcome', {
          name: msg.from!.first_name,
        }),
        {
          reply_markup: mainKb(lang),
          parse_mode: 'Markdown',
        }
      );
    }
  });

  process.once('SIGINT', () => {
    bot.stopPolling();
    process.exit(0);
  });

  process.once('SIGTERM', () => {
    bot.stopPolling();
    process.exit(0);
  });
}

startBot()
  .catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
  });
