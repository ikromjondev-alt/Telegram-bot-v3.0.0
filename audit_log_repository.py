"""
Репозиторий аудит-логов (audit_logs) — единый журнал событий системы.
"""

from __future__ import annotations

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.log import AuditEventType, AuditLog


class AuditLogRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(
        self,
        event_type: AuditEventType,
        description: str,
        actor_id: int | None = None,
        details: dict | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> AuditLog:
        entry = AuditLog(
            event_type=event_type,
            description=description,
            actor_id=actor_id,
            details=details,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        self._session.add(entry)
        await self._session.flush()
        return entry

    async def list_recent(
        self,
        limit: int = 50,
        offset: int = 0,
        event_type: AuditEventType | None = None,
        actor_id: int | None = None,
    ) -> list[AuditLog]:
        stmt = select(AuditLog).order_by(desc(AuditLog.created_at)).limit(limit).offset(offset)
        if event_type is not None:
            stmt = stmt.where(AuditLog.event_type == event_type)
        if actor_id is not None:
            stmt = stmt.where(AuditLog.actor_id == actor_id)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())
