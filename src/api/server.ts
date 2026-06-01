import express from "express";
import path from "path";
import { prisma } from "../db";
import { config } from "../config";
import { Bot } from "grammy";
import { t, Lang } from "../i18n";
import { adminOrderKb } from "../bot/keyboards";

export function createApiServer(bot: Bot) {
  const app = express();
  app.use(express.json());

  // ── Serve Web App ──────────────────────────────────────────────────────────
  app.get("/app", (_req, res) => {
    res.sendFile(path.join(process.cwd(), "src", "api", "webapp.html"));
  });

  // ── GET /api/user/:tgId ────────────────────────────────────────────────────
  app.get("/api/user/:tgId", async (req, res) => {
    try {
      const user = await prisma.user.findUnique({
        where:   { telegramId: BigInt(req.params.tgId) },
        include: { orders: true },
      });
      if (!user) { res.status(404).json({ error: "User not found" }); return; }

      const referrals = await prisma.user.findMany({
        where: { referralBy: user.telegramId },
      });
      const paidRefs = referrals.filter(r => r.hasPurchased);

      res.json({
        tg_id:          String(user.telegramId),
        username:       user.username,
        language:       user.language,
        balance:        user.balance,
        total_spent:    user.totalSpent,
        has_purchased:  user.hasPurchased,
        orders_count:   user.orders.length,
        ref_link:       `https://t.me/softsbot?start=${user.telegramId}`,
        referrals:      referrals.length,
        paid_referrals: paidRefs.length,
        ref_reward:     config.REFERRAL_REWARD,
      });
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // ── GET /api/products ──────────────────────────────────────────────────────
  app.get("/api/products", async (_req, res) => {
    const products = await prisma.product.findMany();
    res.json(products);
  });

  // ── GET /api/orders/:tgId ──────────────────────────────────────────────────
  app.get("/api/orders/:tgId", async (req, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: { telegramId: BigInt(req.params.tgId) },
      });
      if (!user) { res.status(404).json({ error: "User not found" }); return; }

      const orders = await prisma.order.findMany({
        where:   { userId: user.id },
        include: { product: true },
        orderBy: { createdAt: "desc" },
      });

      res.json(orders.map(o => ({
        id:         o.id,
        product:    o.product.name,
        price:      o.product.price,
        status:     o.status,
        recipient:  o.targetRecipient,
        created_at: o.createdAt.toLocaleString("ru-RU"),
      })));
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  });

  // ── POST /api/buy ──────────────────────────────────────────────────────────
  app.post("/api/buy", async (req, res) => {
    const { tg_id, product_id, recipient } = req.body as {
      tg_id: string; product_id: number; recipient?: string;
    };

    try {
      const user = await prisma.user.findUnique({
        where: { telegramId: BigInt(tg_id) },
      });
      if (!user) { res.status(404).json({ error: "User not found" }); return; }

      const product = await prisma.product.findUnique({ where: { id: product_id } });
      if (!product) { res.status(404).json({ error: "Product not found" }); return; }

      if (user.balance < product.price) {
        res.status(400).json({ error: "Insufficient balance", balance: user.balance });
        return;
      }

      const cashback = Math.round(product.price * config.CASHBACK_PERCENT / 100);

      const order = await prisma.order.create({
        data: {
          userId:          user.id,
          productId:       product.id,
          status:          "pending",
          targetRecipient: recipient ?? "self",
          cashbackGiven:   cashback,
        },
      });

      let referralBonus = false;
      const updateData: any = {
        balance:     { decrement: product.price - cashback },
        totalSpent:  { increment: product.price },
      };

      if (!user.hasPurchased && product.price >= config.REFERRAL_MIN_PURCHASE) {
        updateData.hasPurchased = true;
        if (user.referralBy) {
          await prisma.user.update({
            where: { telegramId: user.referralBy },
            data:  { balance: { increment: config.REFERRAL_REWARD } },
          });
          try {
            await bot.api.sendMessage(Number(user.referralBy),
              t("ru", "ref_reward"));
          } catch {}
          referralBonus = true;
        }
      }

      const updated = await prisma.user.update({
        where: { telegramId: BigInt(tg_id) },
        data:  updateData,
      });

      // notify admins
      const lang = user.language as Lang;
      for (const adminId of config.ADMINS) {
        await bot.api.sendMessage(adminId,
          t("ru", "admin_order", {
            username:  user.username ?? String(user.telegramId),
            uid:       String(user.telegramId),
            product:   product.name,
            price:     product.price.toLocaleString("ru-RU"),
            recipient: recipient ?? "self",
          }),
          { reply_markup: adminOrderKb(order.id, user.telegramId), parse_mode: "HTML" }
        );
      }

      // cashback notify
      if (cashback > 0) {
        try {
          await bot.api.sendMessage(Number(tg_id),
            t(lang, "cashback_notify", { amount: cashback.toLocaleString("ru-RU") }));
        } catch {}
      }

      res.json({
        success:        true,
        order_id:       order.id,
        cashback,
        new_balance:    updated.balance,
        referral_bonus: referralBonus,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  return app;
        }
