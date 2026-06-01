import { Bot } from "grammy";
import { config } from "./config";
import { prisma, seedProducts } from "./db";
import { registerStart }   from "./bot/start";
import { registerProfile } from "./bot/profile";
import { registerOrders }  from "./bot/orders";
import { createApiServer } from "./api/server";

async function main() {
  // init DB
  await seedProducts();
  console.log("✅ Database ready");

  // init bot
  const bot = new Bot(config.BOT_TOKEN);

  registerStart(bot);
  registerProfile(bot);
  registerOrders(bot);

  // init API server
  const app = createApiServer(bot);
  app.listen(config.PORT, "0.0.0.0", () => {
    console.log(`✅ API server running on port ${config.PORT}`);
    console.log(`🌐 https://${config.RENDER_EXTERNAL_HOSTNAME}/app`);
  });

  // start bot
  bot.catch((err) => console.error("Bot error:", err));
  await bot.start();
  console.log("🤖 Bot started");
}

main().catch(console.error);
