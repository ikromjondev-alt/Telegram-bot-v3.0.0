"""
Репозиторий администраторов. Инкапсулирует все SQL-запросы к таблице admins,
чтобы сервисный слой не работал с SQLAlchemy напрямую.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.admin import Admin, AdminRole


class AdminRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, telegram_id: int) -> Admin | None:
        return await self._session.get(Admin, telegram_id)

    async def list_all(self) -> list[Admin]:
        result = await self._session.execute(select(Admin).order_by(Admin.created_at.asc()))
        return list(result.scalars().all())

    async def exists(self, telegram_id: int) -> bool:
        return await self.get_by_id(telegram_id) is not None

    async def create(
        self,
        telegram_id: int,
        role: AdminRole,
        added_by: int | None,
        username: str | None = None,
        full_name: str | None = None,
        is_root: bool = False,
    ) -> Admin:
        admin = Admin(
            telegram_id=telegram_id,
            role=role,
            added_by=added_by,
            username=username,
            full_name=full_name,
            is_root=is_root,
            is_active=True,
        )
        self._session.add(admin)
        await self._session.flush()
        return admin

    async def update_role(self, admin: Admin, role: AdminRole) -> Admin:
        admin.role = role
        await self._session.flush()
        return admin

    async def deactivate(self, admin: Admin) -> Admin:
        admin.is_active = False
        await self._session.flush()
        return admin

    async def delete(self, admin: Admin) -> None:
        await self._session.delete(admin)
        await self._session.flush()

    async def touch_login(self, admin: Admin) -> Admin:
        admin.last_login_at = datetime.now(timezone.utc)
        await self._session.flush()
        return admin

    async def update_profile(
        self, admin: Admin, username: str | None, full_name: str | None
    ) -> Admin:
        if username is not None:
            admin.username = username
        if full_name is not None:
            admin.full_name = full_name
        await self._session.flush()
        return admin
