"""
Администраторы WebApp панели.

Главные администраторы (root) заданы в конфиге (ROOT_ADMIN_IDS) и не могут
быть удалены или изменены — это проверяется на уровне сервисного слоя,
а не только в БД, так как список root-админов является частью конфигурации
развёртывания, а не изменяемых данных.
"""

from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, Boolean, DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.db.models.log import AuditLog


class AdminRole(str, enum.Enum):
    OWNER = "owner"  # главный администратор, полный доступ, неизменяем
    ADMIN = "admin"  # полный доступ к панели, кроме управления администраторами
    MODERATOR = "moderator"  # доступ только к модерации (мут/бан/варн/кик)
    VIEWER = "viewer"  # доступ только на чтение (dashboard, логи, пользователи)


class Admin(Base, TimestampMixin):
    __tablename__ = "admins"

    telegram_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=False)
    username: Mapped[str | None] = mapped_column(String(64), nullable=True)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    role: Mapped[AdminRole] = mapped_column(
        Enum(AdminRole, name="admin_role", native_enum=True),
        default=AdminRole.MODERATOR,
        nullable=False,
    )

    is_root: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    added_by: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("admins.telegram_id", ondelete="SET NULL"), nullable=True
    )

    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    audit_logs: Mapped[list["AuditLog"]] = relationship(
        back_populates="actor", foreign_keys="AuditLog.actor_id"
    )

    def can_manage_admins(self) -> bool:
        return self.role == AdminRole.OWNER

    def can_moderate(self) -> bool:
        return self.role in (AdminRole.OWNER, AdminRole.ADMIN, AdminRole.MODERATOR)

    def can_edit_settings(self) -> bool:
        return self.role in (AdminRole.OWNER, AdminRole.ADMIN)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Admin id={self.telegram_id} role={self.role.value} root={self.is_root}>"
