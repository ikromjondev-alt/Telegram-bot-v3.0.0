import { InlineKeyboard } from "grammy";
import { config } from "../config";
import { t, Lang } from "../i18n";

export function langKb(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🇷🇺 Русский", "lang:ru")
    .text("🇺🇿 O'zbek", "lang:uz");
}

export function mainMenuKb(lang: Lang, tgId: bigint): InlineKeyboard {
  // Фронтендда ҳеч қандай хатолик бўлмаслиги учун барча мумкин бўлган вариантларни линкка қўшиб юборамиз
  const url = `https://${config.RENDER_EXTERNAL_HOSTNAME}/app?tgId=${tgId}&tg_id=${tgId}&userId=${tgId}&lang=${lang}`;
  
  return new InlineKeyboard()
    .webApp(t(lang, "open_shop"), url).row()
    .text(t(lang, "profile_btn"), "profile").row()
    .text(t(lang, "topup_btn"), "topup").row()
    .url(t(lang, "support_btn"), `https://t.me/${config.SUPPORT_USERNAME.replace("@", "")}`);
}

export function topupCancelKb(lang: Lang): InlineKeyboard {
  return new InlineKeyboard().text(
    lang === "ru" ? "❌ Отмена" : "❌ Bekor",
    "cancel"
  );
}

export function adminTopupKb(reqId: number, userId: bigint, amount: number): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Подтвердить", `topup_ok:${reqId}:${userId}:${amount}`)
    .text("❌ Отклонить",   `topup_no:${reqId}:${userId}`);
}

export function adminOrderKb(orderId: number, userId: bigint): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Выполнен", `order_done:${orderId}:${userId}`)
    .text("❌ Отменить", `order_cancel:${orderId}:${userId}`);
}

export function reviewKb(lang: Lang, orderId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text(t(lang, "review_yes"), `review_yes:${orderId}`)
    .text(t(lang, "review_no"),  `review_no:${orderId}`);
}
