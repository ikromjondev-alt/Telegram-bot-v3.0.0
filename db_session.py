"""
Открывает транзакционную сессию SQLAlchemy на каждый HTTP-запрос,
доступную хендлерам через request["session"].
"""

from __future__ import annotations

from aiohttp import web

from app.db.session import get_session


@web.middleware
async def database_session_middleware(request: web.Request, handler) -> web.StreamResponse:
    if not request.path.startswith("/api/"):
        return await handler(request)

    async with get_session() as session:
        request["session"] = session
        return await handler(request)
