"""
Репозиторий кодов подтверждения авторизации (auth_codes).
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.auth import AuthCode


class AuthCodeRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        telegram_id: int,
        encrypted_code: str,
        expires_at: datetime,
        max_attempts: int,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> AuthCode:
        auth_code = AuthCode(
            telegram_id=telegram_id,
            encrypted_code=encrypted_code,
            expires_at=expires_at,
            max_attempts=max_attempts,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        self._session.add(auth_code)
        await self._session.flush()
        return auth_code

    async def get_latest_active(self, telegram_id: int) -> AuthCode | None:
        """Последний неиспользованный, ещё не истёкший код для данного администратора."""
        now = datetime.now(timezone.utc)
        stmt = (
            select(AuthCode)
            .where(
                AuthCode.telegram_id == telegram_id,
                AuthCode.used.is_(False),
                AuthCode.expires_at > now,
            )
            .order_by(AuthCode.created_at.desc())
            .limit(1)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def invalidate_active_codes(self, telegram_id: int) -> None:
        """Помечает все активные коды администратора как использованные (при запросе нового)."""
        now = datetime.now(timezone.utc)
        stmt = select(AuthCode).where(
            AuthCode.telegram_id == telegram_id,
            AuthCode.used.is_(False),
            AuthCode.expires_at > now,
        )
        result = await self._session.execute(stmt)
        for code in result.scalars().all():
            code.used = True
            code.used_at = now
        await self._session.flush()

    async def mark_used(self, auth_code: AuthCode) -> None:
        auth_code.used = True
        auth_code.used_at = datetime.now(timezone.utc)
        await self._session.flush()

    async def increment_attempts(self, auth_code: AuthCode) -> AuthCode:
        auth_code.attempts += 1
        await self._session.flush()
        return auth_code
