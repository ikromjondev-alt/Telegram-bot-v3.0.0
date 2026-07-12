"""
Фильтр допускает выполнение команды модерации только тем, кто зарегистрирован
администратором панели (таблица admins) и чья роль позволяет модерацию.
Обычные участники группы, даже являющиеся Telegram-админами чата, но не
добавленные через панель, доступа к командам не получают.
"""

from __future__ import annotations

from typing import Any

from aiogram.filters import BaseFilter
from aiogram.types import Message
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.admin_repository import AdminRepository


class IsPanelAdmin(BaseFilter):
    async def __call__(self, message: Message, session: AsyncSession) -> bool | dict[str, Any]:
        if message.from_user is None:
            return False

        admin = await AdminRepository(session).get_by_id(message.from_user.id)
        if admin is None or not admin.is_active or not admin.can_moderate():
            return False

        return {"panel_admin": admin}
