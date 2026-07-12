"""
Сборка aiohttp-приложения API панели.

Порядок middlewares важен (aiohttp применяет их в порядке списка,
оборачивая хендлер от последнего к первому — фактически как onion):
  error_handling -> cors -> rate_limit -> db_session -> auth
Так error_handling видит исключения из всех остальных слоёв, а auth
получает уже открытую сессию БД (request["session"]).
"""

from __future__ import annotations

import time
from pathlib import Path

from aiohttp import web

from app.api.middlewares.auth_middleware import auth_middleware
from app.api.middlewares.cors import cors_middleware
from app.api.middlewares.db_session import database_session_middleware
from app.api.middlewares.error_handling import error_handling_middleware
from app.api.middlewares.rate_limit import rate_limit_middleware
from app.api.routes import admins, auth, broadcast, dashboard, groups, logs, users
from app.bot.dispatcher import create_bot
from app.config import get_settings
from app.services.admin_service import AdminService
from app.db.session import SessionFactory, dispose_engine

_settings = get_settings()

# webapp/ лежит в корне репозитория, на уровень выше app/
WEBAPP_DIR = Path(__file__).resolve().parent.parent.parent / "webapp"


async def _health(request: web.Request) -> web.Response:
    return web.json_response({"ok": True, "status": "healthy"})


async def _index(request: web.Request) -> web.FileResponse:
    return web.FileResponse(WEBAPP_DIR / "index.html")


async def _on_startup(app: web.Application) -> None:
    app["bot"] = create_bot()
    app["started_at"] = time.monotonic()

    async with SessionFactory() as session:
        await AdminService(session).ensure_root_admins_exist()
        await session.commit()


async def _on_cleanup(app: web.Application) -> None:
    bot = app.get("bot")
    if bot is not None:
        await bot.session.close()
    await dispose_engine()


def create_app() -> web.Application:
    app = web.Application(
        client_max_size=50 * 1024 * 1024,  # лимит загрузки файлов Telegram Bot API
        middlewares=[
            error_handling_middleware,
            cors_middleware,
            rate_limit_middleware,
            database_session_middleware,
            auth_middleware,
        ]
    )

    app.router.add_get("/api/health", _health)
    app.add_routes(auth.routes)
    app.add_routes(dashboard.routes)
    app.add_routes(admins.routes)
    app.add_routes(groups.routes)
    app.add_routes(users.routes)
    app.add_routes(logs.routes)
    app.add_routes(broadcast.routes)

    # --- Статика WebApp панели (index.html + css/js) — без nginx ---
    app.router.add_get("/", _index)
    app.router.add_static("/css", WEBAPP_DIR / "css")
    app.router.add_static("/js", WEBAPP_DIR / "js")

    app.on_startup.append(_on_startup)
    app.on_cleanup.append(_on_cleanup)

    return app
