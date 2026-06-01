import { Bot, InlineKeyboard } from "grammy";
import { prisma } from "../db";
import { t, Lang } from "../i18n";
import { config } from "../config";
import { langKb, mainMenuKb } from "./keyboards";

// Веб-илова учун тўғри ва хатосиз линк генератори
function getWebAppUrl(tgId: bigint): string {
  return `https://${config.RENDER_EXTERNAL_HOSTNAME}/app?tgId=${tgId}`;
}

export function registerStart(bot: Bot) {

  bot.command("start", async (ctx) => {
    const tgUser = ctx.from!;
    const args   = ctx.match?.trim();
    let referralBy: bigint | null = null;

    if (args) {
      try {
        const ref = BigInt(args);
        if (ref !== BigInt(tgUser.id)) referralBy = ref;
      } catch {}
    }

    let user = await prisma.user.findUnique({
      where: { telegramId: BigInt(tgUser.id) },
    });

    const isNewUser = !user;

    if (!user) {
      user = await prisma.user.create({
        data: {
          telegramId: BigInt(tgUser.id),
          username:   tgUser.username ?? "",
          language:   "",
          referralBy,
        },
      });
    } else {
      // update username
      await prisma.user.update({
        where: { telegramId: BigInt(tgUser.id) },
        data:  { username: tgUser.username ?? user.username },
      });
    }

    // new user or no language set — ask language
    if (isNewUser || !user.language) {
      await ctx.reply(
        "👋 Добро пожаловать! / Xush kelibsiz!\n\nВыберите язык / Tilni tanlang:",
        { reply_markup: langKb() }
      );
      return;
    }

    const lang = user.language as Lang;
    
    // Эски клавиатурани оламиз ва мажбурий равишда тўғри Веб-илова линкини улаймиз
    const keyboard = mainMenuKb(lang, user.telegramId);
    
    await ctx.reply(t(lang, "main_menu"), {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });
  });

  bot.callbackQuery(/^lang:(ru|uz)$/, async (ctx) => {
    const lang = ctx.match[1] as Lang;
    const user = await prisma.user.update({
      where: { telegramId: BigInt(ctx.from.id) },
      data:  { language: lang },
    });

    const keyboard = mainMenuKb(lang, user.telegramId);

    await ctx.editMessageText(t(lang, "main_menu"), {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery("cancel", async (ctx) => {
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(ctx.from.id) },
    });
    const lang = (user?.language as Lang) || "ru";
    
    const keyboard = mainMenuKb(lang, BigInt(ctx.from.id));

    await ctx.editMessageText(t(lang, "main_menu"), {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });
    await ctx.answerCallbackQuery();
  });
}
