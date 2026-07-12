"""
Пользователи Telegram, встречавшиеся боту, и их статистика по каждой группе.
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.db.models.group import Group
    from app.db.models.moderation import ModerationAction


class TelegramUser(Base, TimestampMixin):
    __tablename__ = "users"

    telegram_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=False)
    username: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    first_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    is_globally_banned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    group_stats: Mapped[list["UserGroupStat"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    moderation_actions: Mapped[list["ModerationAction"]] = relationship(
        back_populates="target_user", foreign_keys="ModerationAction.target_user_id"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<TelegramUser id={self.telegram_id} username={self.username!r}>"


class UserGroupStat(Base, TimestampMixin):
    """Статистика конкретного пользователя в конкретной группе."""

    __tablename__ = "user_group_stats"

    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.telegram_id", ondelete="CASCADE"), primary_key=True
    )
    group_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("groups.chat_id", ondelete="CASCADE"), primary_key=True
    )

    warns_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    messages_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    deleted_messages_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    is_muted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    muted_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    is_banned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    banned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    user: Mapped["TelegramUser"] = relationship(back_populates="group_stats")
    group: Mapped["Group"] = relationship(back_populates="member_stats")
