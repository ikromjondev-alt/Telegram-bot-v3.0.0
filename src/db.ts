import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export async function seedProducts() {
  const count = await prisma.product.count();
  if (count > 0) return;

  await prisma.product.createMany({
    data: [
      { type: "stars", name: "50 Stars",    price: 13000,    amount: 50    },
      { type: "stars", name: "100 Stars",   price: 24000,    amount: 100   },
      { type: "stars", name: "150 Stars",   price: 36000,    amount: 150   },
      { type: "stars", name: "250 Stars",   price: 60000,    amount: 250   },
      { type: "stars", name: "350 Stars",   price: 84000,    amount: 350   },
      { type: "stars", name: "500 Stars",   price: 120000,   amount: 500   },
      { type: "stars", name: "750 Stars",   price: 180000,   amount: 750   },
      { type: "stars", name: "1000 Stars",  price: 240000,   amount: 1000  },
      { type: "stars", name: "1500 Stars",  price: 360000,   amount: 1500  },
      { type: "stars", name: "2500 Stars",  price: 600000,   amount: 2500  },
      { type: "stars", name: "5000 Stars",  price: 1200000,  amount: 5000  },
      { type: "stars", name: "10000 Stars", price: 2400000,  amount: 10000 },
      { type: "stars", name: "25000 Stars", price: 6000000,  amount: 25000 },
      { type: "stars", name: "35000 Stars", price: 8400000,  amount: 35000 },
      { type: "stars", name: "50000 Stars", price: 12000000, amount: 50000 },
      { type: "premium", name: "Premium 3 oy",  price: 180000, amount: 3,  description: "3 oylik Telegram Premium" },
      { type: "premium", name: "Premium 6 oy",  price: 225000, amount: 6,  description: "6 oylik Telegram Premium" },
      { type: "premium", name: "Premium 12 oy", price: 321000, amount: 12, description: "12 oylik Telegram Premium" },
    ],
  });

  console.log("✅ Products seeded");
}
