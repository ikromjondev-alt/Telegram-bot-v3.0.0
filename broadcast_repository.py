"""
Репозиторий рассылок (broadcasts).
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.broadcast import Broadcast, BroadcastContentType, BroadcastStatus


class BroadcastRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        created_by: int,
        content_type: BroadcastContentType,
        text: str | None,
        file_id: str | None,
        buttons: list | None,
        target_count: int,
    ) -> Broadcast:
        broadcast = Broadcast(
            created_by=created_by,
            content_type=content_type,
            text=text,
            file_id=file_id,
            buttons=buttons,
            status=BroadcastStatus.QUEUED,
            target_count=target_count,
        )
        self._session.add(broadcast)
        await self._session.flush()
        return broadcast

    async def get_by_id(self, broadcast_id: int) -> Broadcast | None:
        return await self._session.get(Broadcast, broadcast_id)

    async def list_recent(self, limit: int = 50, offset: int = 0) -> list[Broadcast]:
        stmt = select(Broadcast).order_by(desc(Broadcast.created_at)).limit(limit).offset(offset)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def set_status(
        self,
        broadcast: Broadcast,
        status: BroadcastStatus,
        started_at: datetime | None = None,
        completed_at: datetime | None = None,
    ) -> Broadcast:
        broadcast.status = status
        if started_at is not None:
            broadcast.started_at = started_at
        if completed_at is not None:
            broadcast.completed_at = completed_at
        await self._session.flush()
        return broadcast

    async def increment_progress(self, broadcast: Broadcast, sent: int = 0, failed: int = 0) -> Broadcast:
        broadcast.sent_count += sent
        broadcast.failed_count += failed
        await self._session.flush()
        return broadcast
