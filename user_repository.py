"""
Репозиторий пользователей Telegram и их статистики по группам (user_group_stats).
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.user import TelegramUser, UserGroupStat


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_or_create(
        self,
        telegram_id: int,
        username: str | None = None,
        first_name: str | None = None,
        last_name: str | None = None,
    ) -> TelegramUser:
        user = await self._session.get(TelegramUser, telegram_id)
        now = datetime.now(timezone.utc)

        if user is None:
            user = TelegramUser(
                telegram_id=telegram_id,
                username=username,
                first_name=first_name,
                last_name=last_name,
                first_seen_at=now,
                last_seen_at=now,
            )
            self._session.add(user)
        else:
            user.last_seen_at = now
            if username is not None:
                user.username = username
            if first_name is not None:
                user.first_name = first_name
            if last_name is not None:
                user.last_name = last_name

        await self._session.flush()
        return user

    async def search(
        self,
        query: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[TelegramUser]:
        stmt = select(TelegramUser).order_by(TelegramUser.last_seen_at.desc())
        if query:
            like_pattern = f"%{query}%"
            stmt = stmt.where(
                or_(
                    TelegramUser.username.ilike(like_pattern),
                    TelegramUser.first_name.ilike(like_pattern),
                    TelegramUser.last_name.ilike(like_pattern),
                )
            )
        stmt = stmt.limit(limit).offset(offset)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def count(self) -> int:
        result = await self._session.execute(select(func.count()).select_from(TelegramUser))
        return int(result.scalar_one())

    async def get_group_stat(self, user_id: int, group_id: int) -> UserGroupStat | None:
        return await self._session.get(UserGroupStat, {"user_id": user_id, "group_id": group_id})

    async def get_or_create_group_stat(self, user_id: int, group_id: int) -> UserGroupStat:
        stat = await self.get_group_stat(user_id, group_id)
        if stat is None:
            now = datetime.now(timezone.utc)
            stat = UserGroupStat(user_id=user_id, group_id=group_id, joined_at=now)
            self._session.add(stat)
            await self._session.flush()
        return stat

    async def increment_message_count(self, user_id: int, group_id: int) -> UserGroupStat:
        stat = await self.get_or_create_group_stat(user_id, group_id)
        stat.messages_count += 1
        await self._session.flush()
        return stat

    async def increment_deleted_count(self, user_id: int, group_id: int) -> UserGroupStat:
        stat = await self.get_or_create_group_stat(user_id, group_id)
        stat.deleted_messages_count += 1
        await self._session.flush()
        return stat
