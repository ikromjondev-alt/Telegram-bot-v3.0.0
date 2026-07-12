"""
Сервис управления администраторами панели.

Жёсткое правило: главные администраторы (ROOT_ADMIN_IDS из конфига)
не могут быть удалены, понижены в роли или деактивированы никем,
включая самих себя через API. Это проверяется здесь, а не только
на уровне UI, поскольку UI не является границей доверия.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.exceptions import (
    AdminNotFoundError,
    ForbiddenError,
    RootAdminProtectedError,
)
from app.db.models.admin import Admin, AdminRole
from app.db.models.log import AuditEventType
from app.repositories.admin_repository import AdminRepository
from app.repositories.audit_log_repository import AuditLogRepository

_settings = get_settings()


class AdminService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._admins = AdminRepository(session)
        self._audit = AuditLogRepository(session)

    @staticmethod
    def _is_root_id(telegram_id: int) -> bool:
        return telegram_id in _settings.root_admin_id_list

    async def ensure_root_admins_exist(self) -> None:
        """
        Идемпотентная инициализация: гарантирует, что все ID из ROOT_ADMIN_IDS
        существуют в таблице admins с ролью OWNER и флагом is_root=True.
        Вызывается один раз при старте приложения.
        """
        for root_id in _settings.root_admin_id_list:
            admin = await self._admins.get_by_id(root_id)
            if admin is None:
                await self._admins.create(
                    telegram_id=root_id,
                    role=AdminRole.OWNER,
                    added_by=None,
                    is_root=True,
                )
            elif not admin.is_root or admin.role != AdminRole.OWNER:
                admin.is_root = True
                admin.role = AdminRole.OWNER
                admin.is_active = True
                await self._session.flush()

    async def list_admins(self) -> list[Admin]:
        return await self._admins.list_all()

    async def add_admin(
        self,
        *,
        actor: Admin,
        target_telegram_id: int,
        role: AdminRole,
        username: str | None = None,
        full_name: str | None = None,
    ) -> Admin:
        if not actor.can_manage_admins():
            raise ForbiddenError("Только главный администратор может добавлять администраторов")

        if role == AdminRole.OWNER and not self._is_root_id(target_telegram_id):
            raise ForbiddenError("Роль OWNER зарезервирована только за главными администраторами")

        existing = await self._admins.get_by_id(target_telegram_id)
        if existing is not None:
            if not existing.is_active:
                existing.is_active = True
                existing.role = role
                await self._session.flush()
                await self._audit.add(
                    event_type=AuditEventType.ADMIN_ADDED,
                    description=f"Администратор {target_telegram_id} восстановлен с ролью {role.value}",
                    actor_id=actor.telegram_id,
                )
                return existing
            raise ForbiddenError("Администратор с таким Telegram ID уже существует")

        admin = await self._admins.create(
            telegram_id=target_telegram_id,
            role=role,
            added_by=actor.telegram_id,
            username=username,
            full_name=full_name,
            is_root=self._is_root_id(target_telegram_id),
        )

        await self._audit.add(
            event_type=AuditEventType.ADMIN_ADDED,
            description=f"Администратор {target_telegram_id} добавлен с ролью {role.value}",
            actor_id=actor.telegram_id,
            details={"target_telegram_id": target_telegram_id, "role": role.value},
        )
        return admin

    async def remove_admin(self, *, actor: Admin, target_telegram_id: int) -> None:
        if not actor.can_manage_admins():
            raise ForbiddenError("Только главный администратор может удалять администраторов")

        target = await self._admins.get_by_id(target_telegram_id)
        if target is None:
            raise AdminNotFoundError("Администратор не найден")

        if target.is_root or self._is_root_id(target_telegram_id):
            raise RootAdminProtectedError()

        await self._admins.delete(target)

        await self._audit.add(
            event_type=AuditEventType.ADMIN_REMOVED,
            description=f"Администратор {target_telegram_id} удалён",
            actor_id=actor.telegram_id,
            details={"target_telegram_id": target_telegram_id},
        )

    async def change_role(
        self, *, actor: Admin, target_telegram_id: int, new_role: AdminRole
    ) -> Admin:
        if not actor.can_manage_admins():
            raise ForbiddenError("Только главный администратор может менять уровень доступа")

        target = await self._admins.get_by_id(target_telegram_id)
        if target is None:
            raise AdminNotFoundError("Администратор не найден")

        if target.is_root or self._is_root_id(target_telegram_id):
            raise RootAdminProtectedError()

        if new_role == AdminRole.OWNER:
            raise ForbiddenError("Роль OWNER нельзя присвоить вручную")

        old_role = target.role
        await self._admins.update_role(target, new_role)

        await self._audit.add(
            event_type=AuditEventType.ADMIN_ROLE_CHANGED,
            description=(
                f"Роль администратора {target_telegram_id} изменена: "
                f"{old_role.value} -> {new_role.value}"
            ),
            actor_id=actor.telegram_id,
            details={
                "target_telegram_id": target_telegram_id,
                "old_role": old_role.value,
                "new_role": new_role.value,
            },
        )
        return target
