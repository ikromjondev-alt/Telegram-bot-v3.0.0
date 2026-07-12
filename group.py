"""
Группы (чаты), подключённые к модерации, и их индивидуальные настройки.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Literal

from sqlalchemy import BigInteger, Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.db.models.moderation import ModerationAction
    from app.db.models.user import UserGroupStat


class Group(Base, TimestampMixin):
    __tablename__ = "groups"

    chat_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    username: Mapped[str | None] = mapped_column(String(64), nullable=True)

    added_by: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("admins.telegram_id", ondelete="SET NULL"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    members_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    settings: Mapped["GroupSettings"] = relationship(
        back_populates="group", uselist=False, cascade="all, delete-orphan"
    )
    member_stats: Mapped[list["UserGroupStat"]] = relationship(
        back_populates="group", cascade="all, delete-orphan"
    )
    moderation_actions: Mapped[list["ModerationAction"]] = relationship(
        back_populates="group", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Group chat_id={self.chat_id} title={self.title!r}>"


class GroupSettings(Base, TimestampMixin):
    __tablename__ = "group_settings"

    group_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("groups.chat_id", ondelete="CASCADE"), primary_key=True
    )

    mute_duration_minutes: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    warn_limit: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    flood_limit: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    flood_window_seconds: Mapped[int] = mapped_column(Integer, default=10, nullable=False)

    auto_delete_service_messages: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    antispam_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    antiflood_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    logs_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    language: Mapped[Literal["ru", "uz"]] = mapped_column(String(2), default="ru", nullable=False)

    group: Mapped["Group"] = relationship(back_populates="settings")
