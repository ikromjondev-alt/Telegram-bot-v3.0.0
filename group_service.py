"""
Сервис управления группами. Отвечает за подключение новой группы к модерации
(с настройками по умолчанию из конфига) и корректное отключение.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.exceptions import NotFoundError
from app.db.models.group import Group
from app.db.models.log import AuditEventType
from app.repositories.audit_log_repository import AuditLogRepository
from app.repositories.group_repository import GroupRepository

_settings = get_settings()


class GroupService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._groups = GroupRepository(session)
        self._audit = AuditLogRepository(session)

    def _default_settings(self) -> dict:
        return {
            "mute_duration_minutes": _settings.default_mute_minutes,
            "warn_limit": _settings.default_warn_limit,
            "flood_limit": _settings.default_flood_limit,
            "flood_window_seconds": _settings.default_flood_window_seconds,
            "language": _settings.default_language,
        }

    async def connect_group(
        self,
        *,
        chat_id: int,
        title: str,
        added_by: int,
        username: str | None = None,
        members_count: int = 0,
    ) -> Group:
        existing = await self._groups.get_by_chat_id(chat_id)
        if existing is not None:
            if not existing.is_active:
                existing.is_active = True
                await self._session.flush()
            return existing

        group = await self._groups.add_group(
            chat_id=chat_id,
            title=title,
            added_by=added_by,
            username=username,
            members_count=members_count,
            defaults=self._default_settings(),
        )

        await self._audit.add(
            event_type=AuditEventType.GROUP_ADDED,
            description=f"Группа «{title}» ({chat_id}) подключена к модерации",
            actor_id=added_by,
            details={"chat_id": chat_id, "title": title},
        )
        return group

    async def disconnect_group(self, *, chat_id: int, actor_id: int | None) -> None:
        group = await self._groups.get_by_chat_id(chat_id)
        if group is None:
            raise NotFoundError("Группа не найдена")

        await self._groups.deactivate(group)

        await self._audit.add(
            event_type=AuditEventType.GROUP_REMOVED,
            description=f"Группа «{group.title}» ({chat_id}) отключена от модерации",
            actor_id=actor_id,
            details={"chat_id": chat_id, "title": group.title},
        )
