"""
История всех действий модерации: мут, бан, кик, варн, очистка сообщений и т.д.
Каждая запись — источник правды для статистики Dashboard и раздела "Логи".
"""

from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.db.models.group import Group
    from app.db.models.user import TelegramUser


class ModerationActionType(str, enum.Enum):
    MUTE = "mute"
    UNMUTE = "unmute"
    BAN = "ban"
    UNBAN = "unban"
    KICK = "kick"
    WARN = "warn"
    UNWARN = "unwarn"
    CLEAR = "clear"
    DELETE_MESSAGE = "delete_message"
    AUTO_ANTISPAM = "auto_antispam"
    AUTO_ANTIFLOOD = "auto_antiflood"


class ModerationAction(Base, TimestampMixin):
    __tablename__ = "moderation_actions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    group_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("groups.chat_id", ondelete="CASCADE"), nullable=False, index=True
    )
    target_user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.telegram_id", ondelete="CASCADE"), nullable=False, index=True
    )
    # NULL admin_id означает автоматическое действие бота (антиспам/антифлуд).
    admin_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    action_type: Mapped[ModerationActionType] = mapped_column(
        Enum(ModerationActionType, name="moderation_action_type", native_enum=True),
        nullable=False,
        index=True,
    )

    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    group: Mapped["Group"] = relationship(back_populates="moderation_actions")
    target_user: Mapped["TelegramUser"] = relationship(
        back_populates="moderation_actions", foreign_keys=[target_user_id]
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<ModerationAction {self.action_type.value} target={self.target_user_id} "
            f"group={self.group_id}>"
        )
