"""
Централизованная обработка ошибок: все AppError транслируются в
предсказуемый JSON-ответ с корректным HTTP-статусом; непредвиденные
исключения логируются и записываются в audit_logs с типом ERROR.
"""

from __future__ import annotations

import logging

from aiohttp import web

from app.api.responses import error
from app.core.exceptions import AppError
from app.db.session import get_session
from app.repositories.audit_log_repository import AuditLogRepository
from app.db.models.log import AuditEventType

logger = logging.getLogger("app.api")


@web.middleware
async def error_handling_middleware(request: web.Request, handler) -> web.StreamResponse:
    try:
        return await handler(request)
    except AppError as exc:
        return error(exc.code, exc.message, status=exc.http_status)
    except web.HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 — последний рубеж обработки ошибок
        logger.exception("Необработанная ошибка при обработке запроса %s %s", request.method, request.path)
        try:
            async with get_session() as session:
                await AuditLogRepository(session).add(
                    event_type=AuditEventType.ERROR,
                    description=f"Необработанная ошибка: {exc.__class__.__name__}: {exc}",
                    ip_address=request.remote,
                )
        except Exception:  # noqa: BLE001 — логирование ошибки не должно порождать вторичный сбой
            logger.exception("Не удалось записать ошибку в audit_logs")

        return error("internal_error", "Внутренняя ошибка сервера", status=500)
