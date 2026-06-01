import { Bot } from "grammy";
import { prisma } from "../db";
import { t, Lang } from "../i18n";
import { mainMenuKb, topupCancelKb, adminTopupKb } from "./keyboards";
import { config } from "../config";

const waitingTopupAmount  = new Set<number>();
const waitingTopupReceipt = new Map<number, number>();

export function registerProfile(bot: Bot) {

  bot.callbackQuery("profile", async (ctx) => {
    const user = await prisma.user.findUnique({
      where:   { telegramId: BigInt(ctx.from.id) },
      include: { orders: true },
    });
    if (!user) { await ctx.answerCallbackQuery(); return; }

    const lang    = (user.language as Lang) || "ru";
    const refLink = `https://t.me/${ctx.me.username}?start=${user.telegramId}`;
    const balance = Number(user.balance);
    const spent   = Number(user.totalSpent);

    const text = t(lang, "profile_text", {
      tg_id:    String(user.telegramId),
      username: user.username || "—",
      balance:  balance.toLocaleString("ru-RU"),
      orders:   user.orders.length,
      spent:    spent.toLocaleString("ru-RU"),
      ref_link: refLink,
    });

    await ctx.editMessageText(text, {
      parse_mode:   "HTML",
      reply_markup: mainMenuKb(lang, user.telegramId),
    });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery("topup", async (ctx) => {
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(ctx.from.id) },
    });
    const lang = (user?.language as Lang) ?? "ru";
    waitingTopupAmount.add(ctx.from.id);
    await ctx.editMessageText(t(lang, "topup_enter"), {
      reply_markup: topupCancelKb(lang),
    });
    await ctx.answerCallbackQuery();
  });

  bot.on("message:text", async (ctx, next) => {
    if (!waitingTopupAmount.has(ctx.from.id)) return next();

    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(ctx.from.id) },
    });
    const lang   = (user?.language as Lang) ?? "ru";
    const amount = parseInt(ctx.message.text.replace(/\s|,|\./g, ""));

    if (isNaN(amount) || amount < 10000) {
      await ctx.reply(t(lang, "topup_invalid"));
      return;
    }

    waitingTopupAmount.delete(ctx.from.id);
    waitingTopupReceipt.set(ctx.from.id, amount);

    await ctx.reply(
      t(lang, "topup_card", {
        amount: amount.toLocaleString("ru-RU"),
        card:   config.CARD_NUMBER,
        holder: config.CARD_HOLDER,
      }),
      { parse_mode: "HTML" }
    );
  });

  bot.on("message:photo", async (ctx, next) => {
    const amount = waitingTopupReceipt.get(ctx.from.id);
    if (!amount) return next();

    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(ctx.from.id) },
    });
    const lang = (user?.language as Lang) ?? "ru";

    const req = await prisma.topupRequest.create({
      data: {
        userId:    BigInt(ctx.from.id),
        amount,
        receiptId: ctx.message.photo.at(-1)?.file_id ?? "",
      },
    });

    waitingTopupReceipt.delete(ctx.from.id);

    for (const adminId of config.ADMINS) {
      await ctx.api.sendPhoto(adminId, ctx.message.photo.at(-1)!.file_id, {
        caption: t("ru", "admin_topup_req", {
          username: ctx.from.username ?? String(ctx.from.id),
          uid:      ctx.from.id,
          amount:   amount.toLocaleString("ru-RU"),
        }),
        reply_markup: adminTopupKb(req.id, BigInt(ctx.from.id), amount),
      });
    }

    await ctx.reply(t(lang, "topup_received"));
  });

  // ── ЭНГ АСОСИЙ ТОП-ФИКС ЖОЙИ ──────────────────────────────────────────────
  bot.callbackQuery(/^topup_ok:(\d+):(\d+):(\d+)$/, async (ctx) => {
    if (!config.ADMINS.includes(ctx.from.id)) {
      await ctx.answerCallbackQuery(); return;
    }
    const [, , userId, amountStr] = ctx.match;
    const amount = parseInt(amountStr);

    const user = await prisma.user.update({
      where: { telegramId: BigInt(userId) },
      data:  { balance: { increment: amount } },
    });

    const lang    = (user.language as Lang) || "ru";
    const balance = Number(user.balance);

    // [ТУЗАТИШ]: Мижозга хабар билан бирга янгиланган янги инлайн клавиатурани ҳам қўшиб юборамиз!
    await ctx.api.sendMessage(Number(userId),
      t(lang, "topup_approved", {
        amount:  amount.toLocaleString("ru-RU"),
        balance: balance.toLocaleString("ru-RU"),
      }),
      { 
        parse_mode: "HTML",
        reply_markup: mainMenuKb(lang, user.telegramId) // Мана шу тугма янги балансни маркетга олиб киради!
      }
    );

    await ctx.editMessageCaption({
      caption: `✅ ПОДТВЕРЖДЕНО | @${user.username} | +${amount.toLocaleString()} UZS`,
    });
    await ctx.answerCallbackQuery("✅ Готово");
  });

  bot.callbackQuery(/^topup_no:(\d+):(\d+)$/, async (ctx) => {
    if (!config.ADMINS.includes(ctx.from.id)) {
      await ctx.answerCallbackQuery(); return;
    }
    const [, , userId] = ctx.match;
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(userId) },
    });
    if (user) {
      await ctx.api.sendMessage(
        Number(userId),
        t(user.language as Lang, "topup_rejected")
      );
    }
    await ctx.editMessageCaption({ caption: "❌ ОТКЛОНЕНО" });
    await ctx.answerCallbackQuery("❌");
  });
}
