"""
CORS: разрешает запросы только с доменов из CORS_ALLOWED_ORIGINS.
Обязателен, так как WebApp панель обращается к API с отдельного домена/пути.
"""

from __future__ import annotations

from aiohttp import web

from app.config import get_settings

_settings = get_settings()


@web.middleware
async def cors_middleware(request: web.Request, handler) -> web.StreamResponse:
    origin = request.headers.get("Origin")
    allowed_origins = set(_settings.cors_origin_list)

    if request.method == "OPTIONS":
        response = web.Response(status=204)
    else:
        response = await handler(request)

    if origin and (origin in allowed_origins or not _settings.is_production):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-CSRF-Token"
        response.headers["Vary"] = "Origin"

    return response
