"""
Одноразовые коды подтверждения входа в WebApp панель.

Код хранится в БД в зашифрованном виде (Fernet, симметричное шифрование,
ключ берётся из настроек и никогда не попадает в код/репозиторий).
Сам код никогда не хранится и не логируется в открытом виде.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class AuthCode(Base, TimestampMixin):
    __tablename__ = "auth_codes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    telegram_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("admins.telegram_id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Зашифрованный код (Fernet token), не сам код в открытом виде.
    encrypted_code: Mapped[str] = mapped_column(String(512), nullable=False)

    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_attempts: Mapped[int] = mapped_column(Integer, default=5, nullable=False)

    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)

    def is_expired(self, now: datetime) -> bool:
        return now >= self.expires_at

    def is_exhausted(self) -> bool:
        return self.attempts >= self.max_attempts

    def is_valid(self, now: datetime) -> bool:
        return not self.used and not self.is_expired(now) and not self.is_exhausted()
