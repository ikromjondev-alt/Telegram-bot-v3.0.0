"""
Аудит-лог всех действий в системе: вход в панель, добавление/удаление
администраторов, управление группами, ошибки и т.д.

Модерационные действия (мут/бан/варн/кик) хранятся отдельно в
ModerationAction для быстрых агрегатов Dashboard, но также дублируются
здесь по event_type="moderation" для единого общего журнала событий.
"""

from __future__ import annotations

import enum
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.db.models.admin import Admin


class AuditEventType(str, enum.Enum):
    LOGIN_CODE_REQUESTED = "login_code_requested"
    LOGIN_SUCCESS = "login_success"
    LOGIN_FAILED = "login_failed"
    LOGOUT = "logout"
    ADMIN_ADDED = "admin_added"
    ADMIN_REMOVED = "admin_removed"
    ADMIN_ROLE_CHANGED = "admin_role_changed"
    GROUP_ADDED = "group_added"
    GROUP_REMOVED = "group_removed"
    SETTINGS_CHANGED = "settings_changed"
    BROADCAST_SENT = "broadcast_sent"
    MODERATION = "moderation"
    ERROR = "error"


class AuditLog(Base, TimestampMixin):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    event_type: Mapped[AuditEventType] = mapped_column(
        Enum(AuditEventType, name="audit_event_type", native_enum=True),
        nullable=False,
        index=True,
    )

    # actor_id может быть NULL для системных событий (ошибки, автоматика).
    actor_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("admins.telegram_id", ondelete="SET NULL"), nullable=True, index=True
    )

    description: Mapped[str] = mapped_column(Text, nullable=False)
    details: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)

    actor: Mapped["Admin"] = relationship(back_populates="audit_logs", foreign_keys=[actor_id])

    def __repr__(self) -> str:  # pragma: no cover
        return f"<AuditLog {self.event_type.value} actor={self.actor_id}>"
