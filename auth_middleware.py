"""
Проверяет JWT сессионный токен (httpOnly cookie) на всех эндпоинтах, кроме
публичных (/api/auth/*, /api/health). Успешно прошедший проверку запрос
получает request["current_admin"] — актуальную запись Admin из БД (не из
токена, чтобы мгновенно учитывать отзыв доступа/смену роли).

Для всех изменяющих состояние методов (POST/PUT/PATCH/DELETE) вне auth-роутов
дополнительно требуется валидный CSRF-токен в заголовке X-CSRF-Token —
защита от CSRF, так как сессия хранится в cookie.
"""

from __future__ import annotations

from aiohttp import web

from app.api.responses import error
from app.core.exceptions import AppError, CSRFValidationError
from app.core.security import decode_session_token, verify_csrf_token
from app.repositories.admin_repository import AdminRepository

_PUBLIC_PATHS = ("/api/auth/request-code", "/api/auth/verify-code", "/api/health")
_SAFE_METHODS = ("GET", "HEAD", "OPTIONS")

SESSION_COOKIE_NAME = "session_token"
CSRF_HEADER_NAME = "X-CSRF-Token"


@web.middleware
async def auth_middleware(request: web.Request, handler) -> web.StreamResponse:
    if not request.path.startswith("/api/"):
        return await handler(request)

    if request.method == "OPTIONS" or request.path in _PUBLIC_PATHS:
        return await handler(request)

    token = request.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        return error("unauthorized", "Требуется авторизация", status=401)

    try:
        payload = decode_session_token(token)
    except AppError as exc:
        return error(exc.code, exc.message, status=exc.http_status)

    if request.method not in _SAFE_METHODS:
        csrf_token = request.headers.get(CSRF_HEADER_NAME, "")
        if not verify_csrf_token(csrf_token, payload.session_id):
            return error(
                CSRFValidationError.code, "Недействительный CSRF-токен", status=403
            )

    admin = await AdminRepository(request["session"]).get_by_id(payload.telegram_id)
    if admin is None or not admin.is_active:
        return error("unauthorized", "Доступ отозван", status=401)

    request["current_admin"] = admin
    request["session_id"] = payload.session_id

    return await handler(request)
