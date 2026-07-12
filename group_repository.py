"""
Репозиторий групп (chat) и их настроек модерации.
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.group import Group, GroupSettings


class GroupRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_chat_id(self, chat_id: int, with_settings: bool = False) -> Group | None:
        stmt = select(Group).where(Group.chat_id == chat_id)
        if with_settings:
            stmt = stmt.options(selectinload(Group.settings))
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_active(self) -> list[Group]:
        stmt = select(Group).where(Group.is_active.is_(True)).order_by(Group.title.asc())
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def count_active(self) -> int:
        stmt = select(func.count()).select_from(Group).where(Group.is_active.is_(True))
        result = await self._session.execute(stmt)
        return int(result.scalar_one())

    async def add_group(
        self,
        chat_id: int,
        title: str,
        added_by: int,
        username: str | None = None,
        members_count: int = 0,
        defaults: dict | None = None,
    ) -> Group:
        group = Group(
            chat_id=chat_id,
            title=title,
            username=username,
            added_by=added_by,
            members_count=members_count,
            is_active=True,
        )
        self._session.add(group)

        settings_kwargs = defaults or {}
        group.settings = GroupSettings(group_id=chat_id, **settings_kwargs)

        await self._session.flush()
        return group

    async def deactivate(self, group: Group) -> Group:
        group.is_active = False
        await self._session.flush()
        return group

    async def delete(self, group: Group) -> None:
        await self._session.delete(group)
        await self._session.flush()

    async def update_settings(self, group: Group, **fields) -> GroupSettings:
        settings = group.settings
        for key, value in fields.items():
            if value is not None and hasattr(settings, key):
                setattr(settings, key, value)
        await self._session.flush()
        return settings

    async def update_title(self, group: Group, title: str, members_count: int | None = None) -> Group:
        group.title = title
        if members_count is not None:
            group.members_count = members_count
        await self._session.flush()
        return group
