"""
Rate limiting по IP-адресу. На эндпоинты авторизации применяется отдельный,
более строгий лимит — защита от перебора кодов подтверждения.
"""

from __future__ import annotations

from aiohttp import web

from app.api.responses import error
from app.config import get_settings
from app.core.rate_limiter import RateLimiter

_settings = get_settings()

general_limiter = RateLimiter(
    max_requests=_settings.rate_limit_requests, window_seconds=_settings.rate_limit_window_seconds
)
auth_limiter = RateLimiter(
    max_requests=_settings.auth_rate_limit_attempts,
    window_seconds=_settings.auth_rate_limit_window_seconds,
)

_AUTH_PATH_PREFIX = "/api/auth/"


def _client_key(request: web.Request) -> str:
    # За обратным прокси реальный IP приходит в X-Forwarded-For.
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.remote or "unknown"


@web.middleware
async def rate_limit_middleware(request: web.Request, handler) -> web.StreamResponse:
    if not request.path.startswith("/api/"):
        return await handler(request)

    key = _client_key(request)

    if request.path.startswith(_AUTH_PATH_PREFIX):
        allowed = await auth_limiter.is_allowed(f"auth:{key}")
        if not allowed:
            return error(
                "rate_limit_exceeded",
                "Слишком много попыток авторизации. Повторите позже.",
                status=429,
            )

    allowed = await general_limiter.is_allowed(key)
    if not allowed:
        return error("rate_limit_exceeded", "Слишком много запросов. Повторите позже.", status=429)

    return await handler(request)
