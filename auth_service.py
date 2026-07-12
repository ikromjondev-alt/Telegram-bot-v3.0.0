"""
Сервис авторизации администраторов в WebApp панель.

Flow:
  1. request_login_code() — проверяет что ID есть среди администраторов,
     генерирует 6-значный код, шифрует, сохраняет, отправляет через бота.
  2. verify_login_code() — проверяет код, выпускает JWT-сессию.

Любая неудача на любом шаге логируется в audit_logs.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Protocol

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    AuthCodeAttemptsExceededError,
    AuthCodeExpiredError,
    ForbiddenError,
    InvalidAuthCodeError,
)
from app.core.security import (
    auth_code_expiry,
    encrypt_auth_code,
    generate_auth_code,
    issue_session_token,
    verify_auth_code,
)
from app.config import get_settings
from app.db.models.log import AuditEventType
from app.repositories.admin_repository import AdminRepository
from app.repositories.audit_log_repository import AuditLogRepository
from app.repositories.auth_code_repository import AuthCodeRepository

_settings = get_settings()


class CodeSender(Protocol):
    """Абстракция отправки кода через Telegram-бота (реализуется в app.bot)."""

    async def send_code(self, telegram_id: int, code: str, ttl_seconds: int) -> None: ...


class AuthService:
    def __init__(self, session: AsyncSession, code_sender: CodeSender) -> None:
        self._session = session
        self._code_sender = code_sender
        self._admins = AdminRepository(session)
        self._codes = AuthCodeRepository(session)
        self._audit = AuditLogRepository(session)

    async def request_login_code(
        self,
        telegram_id: int,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> None:
        admin = await self._admins.get_by_id(telegram_id)

        if admin is None or not admin.is_active:
            # Не раскрываем существование/отсутствие ID в системе через сообщение об ошибке —
            # но фиксируем попытку во внутреннем логе для мониторинга брутфорса.
            await self._audit.add(
                event_type=AuditEventType.LOGIN_FAILED,
                description=f"Попытка входа с неизвестным Telegram ID {telegram_id}",
                actor_id=None,
                ip_address=ip_address,
                user_agent=user_agent,
            )
            raise ForbiddenError("Доступ запрещён")

        await self._codes.invalidate_active_codes(telegram_id)

        code = generate_auth_code(_settings.auth_code_length)
        encrypted = encrypt_auth_code(code)
        expires_at = auth_code_expiry()

        await self._codes.create(
            telegram_id=telegram_id,
            encrypted_code=encrypted,
            expires_at=expires_at,
            max_attempts=5,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        await self._code_sender.send_code(
            telegram_id=telegram_id, code=code, ttl_seconds=_settings.auth_code_ttl_seconds
        )

        await self._audit.add(
            event_type=AuditEventType.LOGIN_CODE_REQUESTED,
            description=f"Код подтверждения отправлен администратору {telegram_id}",
            actor_id=telegram_id,
            ip_address=ip_address,
            user_agent=user_agent,
        )

    async def verify_login_code(
        self,
        telegram_id: int,
        provided_code: str,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> str:
        """Возвращает JWT сессионный токен при успешной проверке."""
        admin = await self._admins.get_by_id(telegram_id)
        if admin is None or not admin.is_active:
            raise ForbiddenError("Доступ запрещён")

        auth_code = await self._codes.get_latest_active(telegram_id)
        if auth_code is None:
            await self._log_failure(telegram_id, "Код не найден или уже истёк", ip_address, user_agent)
            raise AuthCodeExpiredError("Код истёк или не был запрошен")

        now = datetime.now(timezone.utc)

        if auth_code.is_expired(now):
            await self._log_failure(telegram_id, "Код истёк", ip_address, user_agent)
            raise AuthCodeExpiredError("Код истёк")

        if auth_code.is_exhausted():
            await self._log_failure(telegram_id, "Превышено число попыток ввода кода", ip_address, user_agent)
            raise AuthCodeAttemptsExceededError("Превышено число попыток")

        if not verify_auth_code(auth_code.encrypted_code, provided_code):
            await self._codes.increment_attempts(auth_code)
            await self._log_failure(telegram_id, "Неверный код подтверждения", ip_address, user_agent)
            raise InvalidAuthCodeError("Неверный код подтверждения")

        await self._codes.mark_used(auth_code)
        await self._admins.touch_login(admin)

        await self._audit.add(
            event_type=AuditEventType.LOGIN_SUCCESS,
            description=f"Администратор {telegram_id} успешно вошёл в панель",
            actor_id=telegram_id,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        return issue_session_token(telegram_id=admin.telegram_id, role=admin.role.value)

    async def _log_failure(
        self, telegram_id: int, reason: str, ip_address: str | None, user_agent: str | None
    ) -> None:
        await self._audit.add(
            event_type=AuditEventType.LOGIN_FAILED,
            description=f"Неудачная попытка входа администратора {telegram_id}: {reason}",
            actor_id=telegram_id,
            ip_address=ip_address,
            user_agent=user_agent,
        )
