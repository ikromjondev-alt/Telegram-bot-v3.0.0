type Lang = "ru" | "uz";

const TEXTS = {
  ru: {
    choose_lang:     "👋 Добро пожаловать! Выберите язык:",
    lang_set:        "🇷🇺 Выбран русский язык.",
    main_menu:       "🏪 Добро пожаловать в Stars Market!\n\nВыберите действие:",
    open_shop:       "🛍 Открыть магазин",
    profile_btn:     "👤 Профиль",
    support_btn:     "🆘 Поддержка",
    topup_btn:       "💳 Пополнить баланс",
    topup_enter:     "💰 Введите сумму пополнения в UZS (минимум 10 000):",
    topup_invalid:   "❌ Введите корректную сумму (число, минимум 10 000).",
    topup_card:      "💳 Переведите <b>{amount} UZS</b> на карту:\n\n<code>{card}</code>\n<b>{holder}</b>\n\nПосле оплаты отправьте скриншот чека.",
    topup_received:  "✅ Чек получен! Ожидайте подтверждения администратора.",
    topup_approved:  "✅ Баланс пополнен на <b>{amount} UZS</b>!\n💰 Текущий баланс: <b>{balance} UZS</b>",
    topup_rejected:  "❌ Запрос на пополнение отклонён. По вопросам: @Tadjibaev_i",
    balance_low:     "❌ Недостаточно средств.\n💰 Баланс: {balance} UZS\n💸 Нужно: {price} UZS",
    order_created:   "✅ Заказ #{order_id} создан!\n📦 {product}\n💰 {price} UZS\nОжидайте выполнения.",
    order_completed: "🎉 Заказ #{order_id} выполнен!\n📦 {product}",
    review_ask:      "🌟 Оставьте отзыв о заказе #{order_id}:",
    review_yes:      "✍️ Написать отзыв",
    review_no:       "Пропустить",
    review_prompt:   "✍️ Напишите ваш отзыв:",
    review_thanks:   "🙏 Спасибо за отзыв! Опубликован в канале.",
    cashback_notify: "💸 Кэшбек +{amount} UZS зачислен на баланс!",
    ref_reward:      "🎁 +3 000 UZS! Ваш реферал сделал первую покупку!",
    profile_text:    "👤 <b>Профиль</b>\n\n🆔 ID: <code>{tg_id}</code>\n👤 @{username}\n💰 Баланс: <b>{balance} UZS</b>\n📦 Заказов: {orders}\n💸 Потрачено: {spent} UZS\n\n🔗 Реф. ссылка:\n<code>{ref_link}</code>",
    gift_ask:        "👥 Введите @username или Telegram ID получателя:",
    gift_not_found:  "❌ Пользователь не найден. Попросите друга запустить бота.",
    gift_sent:       "🎁 Подарок отправлен @{username}!",
    gift_received:   "🎁 Вам подарили {product}! От @{sender}",
    admin_topup_req: "💳 Запрос на пополнение!\n👤 @{username} (ID: {uid})\n💰 Сумма: {amount} UZS",
    admin_order:     "🛒 Новый заказ!\n👤 @{username} (ID: {uid})\n📦 {product}\n💰 {price} UZS\n🎯 Получатель: {recipient}",
    approve_btn:     "✅ Подтвердить",
    reject_btn:      "❌ Отклонить",
    complete_btn:    "✅ Выполнен",
    cancel_btn:      "❌ Отменить",
    back_btn:        "◀️ Назад",
  },
  uz: {
    choose_lang:     "👋 Xush kelibsiz! Tilni tanlang:",
    lang_set:        "🇺🇿 O'zbek tili tanlandi.",
    main_menu:       "🏪 Stars Market'ga xush kelibsiz!\n\nAmalni tanlang:",
    open_shop:       "🛍 Do'konni ochish",
    profile_btn:     "👤 Profil",
    support_btn:     "🆘 Qo'llab-quvvatlash",
    topup_btn:       "💳 Balansni to'ldirish",
    topup_enter:     "💰 To'ldirish summasini UZS da kiriting (minimum 10 000):",
    topup_invalid:   "❌ To'g'ri summa kiriting (son, minimum 10 000).",
    topup_card:      "💳 <b>{amount} UZS</b> ni quyidagi kartaga o'tkazing:\n\n<code>{card}</code>\n<b>{holder}</b>\n\nTo'lovdan so'ng chek skrinshotini yuboring.",
    topup_received:  "✅ Chek qabul qilindi! Administrator tasdiqlashini kuting.",
    topup_approved:  "✅ Balans <b>{amount} UZS</b> ga to'ldirildi!\n💰 Joriy balans: <b>{balance} UZS</b>",
    topup_rejected:  "❌ To'ldirish so'rovi rad etildi. Savollar: @Tadjibaev_i",
    balance_low:     "❌ Balans yetarli emas.\n💰 Balans: {balance} UZS\n💸 Kerak: {price} UZS",
    order_created:   "✅ #{order_id} buyurtma yaratildi!\n📦 {product}\n💰 {price} UZS\nBajarilishini kuting.",
    order_completed: "🎉 #{order_id} buyurtma bajarildi!\n📦 {product}",
    review_ask:      "🌟 #{order_id} buyurtma haqida fikr bildiring:",
    review_yes:      "✍️ Fikr yozish",
    review_no:       "O'tkazib yuborish",
    review_prompt:   "✍️ Fikringizni yozing:",
    review_thanks:   "🙏 Fikringiz uchun rahmat! Kanalda e'lon qilindi.",
    cashback_notify: "💸 Keshbek +{amount} UZS balansingizga o'tkazildi!",
    ref_reward:      "🎁 +3 000 UZS! Referalingiz birinchi xaridni amalga oshirdi!",
    profile_text:    "👤 <b>Profil</b>\n\n🆔 ID: <code>{tg_id}</code>\n👤 @{username}\n💰 Balans: <b>{balance} UZS</b>\n📦 Buyurtmalar: {orders}\n💸 Sarflangan: {spent} UZS\n\n🔗 Ref. havola:\n<code>{ref_link}</code>",
    gift_ask:        "👥 Qabul qiluvchining @username yoki Telegram ID sini kiriting:",
    gift_not_found:  "❌ Foydalanuvchi topilmadi. Do'stingizdan botni ishga tushirishini so'rang.",
    gift_sent:       "🎁 Sovg'a @{username} ga yuborildi!",
    gift_received:   "🎁 Sizga {product} sovg'a qilindi! @{sender} tomonidan",
    admin_topup_req: "💳 Balans to'ldirish so'rovi!\n👤 @{username} (ID: {uid})\n💰 Summa: {amount} UZS",
    admin_order:     "🛒 Yangi buyurtma!\n👤 @{username} (ID: {uid})\n📦 {product}\n💰 {price} UZS\n🎯 Qabul qiluvchi: {recipient}",
    approve_btn:     "✅ Tasdiqlash",
    reject_btn:      "❌ Rad etish",
    complete_btn:    "✅ Bajarildi",
    cancel_btn:      "❌ Bekor qilish",
    back_btn:        "◀️ Orqaga",
  },
} as const;

type TextKey = keyof typeof TEXTS.ru;

export function t(lang: Lang, key: TextKey, vars?: Record<string, string | number>): string {
  let text: string = (TEXTS[lang] as any)[key] ?? (TEXTS.ru as any)[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}

export type { Lang };
