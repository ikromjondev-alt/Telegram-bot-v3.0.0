import dotenv from "dotenv";
dotenv.config();

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env variable: ${key}`);
  return val;
}

export const config = {
  BOT_TOKEN:              required("BOT_TOKEN"),
  ADMINS:                 (process.env.ADMINS || "8150331577").split(",").map(Number),
  PORT:                   parseInt(process.env.PORT || "3000"),
  RENDER_EXTERNAL_HOSTNAME: process.env.RENDER_EXTERNAL_HOSTNAME || "localhost:3000",
  CARD_NUMBER:            process.env.CARD_NUMBER || "5614 6821 1076 2236",
  CARD_HOLDER:            process.env.CARD_HOLDER || "I. Tojiboyev (Uzcard)",
  CHANNEL_ID:             process.env.CHANNEL_ID || "@otziv_telegram_softs",
  SUPPORT_USERNAME:       process.env.SUPPORT_USERNAME || "@Tadjibaev_i",
  REFERRAL_REWARD:        parseInt(process.env.REFERRAL_REWARD || "3000"),
  REFERRAL_MIN_PURCHASE:  parseInt(process.env.REFERRAL_MIN_PURCHASE || "30000"),
  CASHBACK_PERCENT:       parseFloat(process.env.CASHBACK_PERCENT || "2"),
};
