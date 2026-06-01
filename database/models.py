from sqlalchemy import (
    Integer, BigInteger, String, Float, Boolean,
    DateTime, ForeignKey, Text, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database.db import Base
from datetime import datetime


class User(Base):
    __tablename__ = "users"

    id:            Mapped[int]       = mapped_column(Integer, primary_key=True)
    telegram_id:   Mapped[int]       = mapped_column(BigInteger, unique=True, index=True)
    username:      Mapped[str | None] = mapped_column(String(64))
    language:      Mapped[str]       = mapped_column(String(2), default="ru")
    balance:       Mapped[float]     = mapped_column(Float, default=0.0)
    referral_by:   Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    total_spent:   Mapped[float]     = mapped_column(Float, default=0.0)
    has_purchased: Mapped[bool]      = mapped_column(Boolean, default=False)
    created_at:    Mapped[datetime]  = mapped_column(DateTime, default=func.now())

    orders: Mapped[list["Order"]] = relationship("Order", back_populates="user")


class Product(Base):
    __tablename__ = "products"

    id:          Mapped[int]       = mapped_column(Integer, primary_key=True)
    type:        Mapped[str]       = mapped_column(String(16))
    name:        Mapped[str]       = mapped_column(String(64))
    price:       Mapped[int]       = mapped_column(Integer)
    amount:      Mapped[int]       = mapped_column(Integer)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    orders: Mapped[list["Order"]] = relationship("Order", back_populates="product")


class Order(Base):
    __tablename__ = "orders"

    id:               Mapped[int]       = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id:          Mapped[int]       = mapped_column(Integer, ForeignKey("users.id"))
    product_id:       Mapped[int]       = mapped_column(Integer, ForeignKey("products.id"))
    status:           Mapped[str]       = mapped_column(String(16), default="pending")
    target_recipient: Mapped[str | None] = mapped_column(String(128), nullable=True)
    receipt_img:      Mapped[str | None] = mapped_column(String(256), nullable=True)
    cashback_given:   Mapped[float]     = mapped_column(Float, default=0.0)
    review_posted:    Mapped[bool]      = mapped_column(Boolean, default=False)
    created_at:       Mapped[datetime]  = mapped_column(DateTime, default=func.now())

    user:    Mapped["User"]    = relationship("User",    back_populates="orders")
    product: Mapped["Product"] = relationship("Product", back_populates="orders")


class Promocode(Base):
    __tablename__ = "promocodes"

    id:            Mapped[int] = mapped_column(Integer, primary_key=True)
    code:          Mapped[str] = mapped_column(String(32), unique=True)
    reward_amount: Mapped[int] = mapped_column(Integer)
    max_uses:      Mapped[int] = mapped_column(Integer, default=1)
    current_uses:  Mapped[int] = mapped_column(Integer, default=0)


class TopupRequest(Base):
    __tablename__ = "topup_requests"

    id:         Mapped[int]       = mapped_column(Integer, primary_key=True)
    user_id:    Mapped[int]       = mapped_column(BigInteger)
    amount:     Mapped[int]       = mapped_column(Integer)
    status:     Mapped[str]       = mapped_column(String(16), default="pending")
    receipt_id: Mapped[str | None] = mapped_column(String(256), nullable=True)
    created_at: Mapped[datetime]  = mapped_column(DateTime, default=func.now())
