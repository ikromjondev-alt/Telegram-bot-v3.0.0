"""
Репозиторий действий модерации (moderation_actions) и агрегированной
статистики для Dashboard (счётчики мутов/банов/киков/варнов/удалений).
"""

from __future__ import annotations

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.moderation import ModerationAction, ModerationActionType


class ModerationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(
        self,
        group_id: int,
        target_user_id: int,
        action_type: ModerationActionType,
        admin_id: int | None,
        reason: str | None = None,
        duration_seconds: int | None = None,
        expires_at=None,
    ) -> ModerationAction:
        action = ModerationAction(
            group_id=group_id,
            target_user_id=target_user_id,
            action_type=action_type,
            admin_id=admin_id,
            reason=reason,
            duration_seconds=duration_seconds,
            expires_at=expires_at,
        )
        self._session.add(action)
        await self._session.flush()
        return action

    async def count_by_type(self, action_type: ModerationActionType) -> int:
        stmt = select(func.count()).select_from(ModerationAction).where(
            ModerationAction.action_type == action_type
        )
        result = await self._session.execute(stmt)
        return int(result.scalar_one())

    async def dashboard_counters(self) -> dict[str, int]:
        """Единый запрос для всех счётчиков Dashboard (мут/бан/кик/варн/удаления)."""
        stmt = (
            select(ModerationAction.action_type, func.count())
            .group_by(ModerationAction.action_type)
        )
        result = await self._session.execute(stmt)
        raw_counts = {action_type.value: count for action_type, count in result.all()}

        return {
            "mutes": raw_counts.get(ModerationActionType.MUTE.value, 0),
            "bans": raw_counts.get(ModerationActionType.BAN.value, 0),
            "kicks": raw_counts.get(ModerationActionType.KICK.value, 0),
            "warns": raw_counts.get(ModerationActionType.WARN.value, 0),
            "deleted_messages": (
                raw_counts.get(ModerationActionType.DELETE_MESSAGE.value, 0)
                + raw_counts.get(ModerationActionType.AUTO_ANTISPAM.value, 0)
            ),
        }

    async def list_recent(
        self,
        limit: int = 50,
        offset: int = 0,
        group_id: int | None = None,
        action_type: ModerationActionType | None = None,
    ) -> list[ModerationAction]:
        stmt = select(ModerationAction).order_by(desc(ModerationAction.created_at))
        if group_id is not None:
            stmt = stmt.where(ModerationAction.group_id == group_id)
        if action_type is not None:
            stmt = stmt.where(ModerationAction.action_type == action_type)
        stmt = stmt.limit(limit).offset(offset)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def list_for_user(self, target_user_id: int, group_id: int | None = None) -> list[ModerationAction]:
        stmt = select(ModerationAction).where(
            ModerationAction.target_user_id == target_user_id
        ).order_by(desc(ModerationAction.created_at))
        if group_id is not None:
            stmt = stmt.where(ModerationAction.group_id == group_id)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())
