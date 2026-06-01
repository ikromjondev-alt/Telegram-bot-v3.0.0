import { Bot, InlineKeyboard } from "grammy";
import { prisma } from "../db";
import { t, Lang } from "../i18n";
import { adminOrderKb, reviewKb, mainMenuKb } from "./keyboards";
import { config } from "../config";

const waitingReview = new Map<number, number>(); // userId -> orderId

export function registerOrders(bot: Bot) {

  bot.callbackQuery(/^order_done:(\d+):(\d+)$/, async (ctx) => {
    if (!config.ADMINS.includes(ctx.from.id)) { await ctx.answerCallbackQuery(); return; }

    const [, orderIdStr, userIdStr] = ctx.match;
    const orderId = parseInt(orderIdStr);
    const userId  = BigInt(userIdStr);

    const order = await prisma.order.update({
      where:   { id: orderId },
      data:    { status: "completed" },
      include: { product: true, user: true },
    });

    const lang = order.user.language as Lang;

    await ctx.api.sendMessage(Number(userId),
      t(lang, "order_completed", { order_id: orderId, product: order.product.name }),
      { parse_mode: "HTML" }
    );

    await ctx.api.sendMessage(Number(userId),
      t(lang, "review_ask", { order_id: orderId }),
      { reply_markup: reviewKb(lang, orderId) }
    );

    try {
      await ctx.api.sendMessage(config.CHANNEL_ID,
        `✅ <b>${lang === "ru" ? "Заказ выполнен" : "Buyurtma bajarildi"}!</b>\n\n` +
        `👤 @${order.user.username || String(userId)}\n` +
        `📦 ${order.product.name}\n` +
        `💰 ${order.product.price.toLocaleString("ru-RU")} UZS\n` +
        `🔢 #${orderId}`,
        { parse_mode: "HTML" }
      );
    } catch {}

    await ctx.editMessageText(`✅ Заказ #${orderId} выполнен`);
    await ctx.answerCallbackQuery("✅");
  });

  bot.callbackQuery(/^order_cancel:(\d+):(\d+)$/, async (ctx) => {
    if (!config.ADMINS.includes(ctx.from.id)) { await ctx.answerCallbackQuery(); return; }

    const [, orderIdStr, userIdStr] = ctx.match;
    const orderId = parseInt(orderIdStr);
    const userId  = BigInt(userIdStr);

    const order = await prisma.order.update({
      where:   { id: orderId },
      data:    { status: "cancelled" },
      include: { product: true, user: true },
    });

    await prisma.user.update({
      where: { telegramId: userId },
      data:  { balance: { increment: order.product.price } },
    });

    const lang = order.user.language as Lang;
    await ctx.api.sendMessage(Number(userId),
      lang === "ru"
        ? `❌ Заказ #${orderId} отменён. Средства возвращены на баланс.`
        : `❌ #${orderId} buyurtma bekor qilindi. Mablag' qaytarildi.`
    );

    await ctx.editMessageText(`❌ Заказ #${orderId} отменён`);
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^review_yes:(\d+)$/, async (ctx) => {
    const orderId = parseInt(ctx.match[1]);
    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(ctx.from.id) } });
    const lang = (user?.language as Lang) ?? "ru";
    waitingReview.set(ctx.from.id, orderId);
    await ctx.editMessageText(t(lang, "review_prompt"));
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^review_no:(\d+)$/, async (ctx) => {
    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(ctx.from.id) } });
    const lang = (user?.language as Lang) ?? "ru";
    
    // Тўғри линк билан таъминланган клавиатурани юборамиз
    const keyboard = mainMenuKb(lang, BigInt(ctx.from.id));

    await ctx.editMessageText(t(lang, "main_menu"), {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });
    await ctx.answerCallbackQuery();
  });

  bot.on("message:text", async (ctx, next) => {
    const orderId = waitingReview.get(ctx.from.id);
    if (!orderId) return next();

    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(ctx.from.id) } });
    const lang = (user?.language as Lang) ?? "ru";

    const order = await prisma.order.findUnique({
      where:   { id: orderId },
      include: { product: true },
    });

    if (order) {
      await prisma.order.update({ where: { id: orderId }, data: { reviewPosted: true } });
    }

    const reviewText =
      `⭐ <b>${lang === "ru" ? `Отзыв о заказе #${orderId}` : `#${orderId} buyurtma haqida fikr`}</b>\n\n` +
      `👤 @${ctx.from.username ?? ctx.from.id}\n` +
      `💰 ${order?.product.price.toLocaleString("ru-RU") ?? 0} UZS  |  ` +
      `📦 ${order?.product.name ?? "—"}  |  🔢 #${orderId}\n\n` +
      `💬 ${ctx.message.text}`;

    try {
      await config.CHANNEL_ID;
      await ctx.api.sendMessage(config.CHANNEL_ID, reviewText, { parse_mode: "HTML" });
    } catch {}

    waitingReview.delete(ctx.from.id);

    // Шарҳ учун раҳматнома хабари клавиатурасини мажбурий тўғрилаймиз
    const keyboard = mainMenuKb(lang, BigInt(ctx.from.id));

    await ctx.reply(t(lang, "review_thanks"), {
      reply_markup: keyboard,
    });
  });
}
