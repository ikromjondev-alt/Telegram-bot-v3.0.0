from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def init_db():
    from database.models import User, Product, Order, Promocode, TopupRequest  # noqa
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await seed_products()


async def seed_products():
    from database.models import Product
    from sqlalchemy import select
    async with async_session() as session:
        result = await session.execute(select(Product).limit(1))
        if result.scalar():
            return
        products = [
            Product(type="stars", name="50 Stars",    price=13000,    amount=50),
            Product(type="stars", name="100 Stars",   price=24000,    amount=100),
            Product(type="stars", name="150 Stars",   price=36000,    amount=150),
            Product(type="stars", name="250 Stars",   price=60000,    amount=250),
            Product(type="stars", name="350 Stars",   price=84000,    amount=350),
            Product(type="stars", name="500 Stars",   price=120000,   amount=500),
            Product(type="stars", name="750 Stars",   price=180000,   amount=750),
            Product(type="stars", name="1000 Stars",  price=240000,   amount=1000),
            Product(type="stars", name="1500 Stars",  price=360000,   amount=1500),
            Product(type="stars", name="2500 Stars",  price=600000,   amount=2500),
            Product(type="stars", name="5000 Stars",  price=1200000,  amount=5000),
            Product(type="stars", name="10000 Stars", price=2400000,  amount=10000),
            Product(type="stars", name="25000 Stars", price=6000000,  amount=25000),
            Product(type="stars", name="35000 Stars", price=8400000,  amount=35000),
            Product(type="stars", name="50000 Stars", price=12000000, amount=50000),
            Product(type="premium", name="Premium 3 oy",  price=180000, amount=3,  description="3 oylik Telegram Premium"),
            Product(type="premium", name="Premium 6 oy",  price=225000, amount=6,  description="6 oylik Telegram Premium"),
            Product(type="premium", name="Premium 12 oy", price=321000, amount=12, description="12 oylik Telegram Premium"),
        ]
        session.add_all(products)
        await session.commit()


async def get_session():
    async with async_session() as session:
        yield session
