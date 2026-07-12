"""
Единый формат JSON-ответов API, чтобы фронтенд работал с предсказуемой
структурой { "ok": bool, "data" | "error": ... }.
"""

from __future__ import annotations

from typing import Any

import orjson
from aiohttp import web


def _dumps(data: Any) -> str:
    return orjson.dumps(data).decode("utf-8")


def ok(data: Any = None, status: int = 200) -> web.Response:
    payload = {"ok": True, "data": data}
    return web.Response(text=_dumps(payload), status=status, content_type="application/json")


def error(code: str, message: str, status: int = 400) -> web.Response:
    payload = {"ok": False, "error": {"code": code, "message": message}}
    return web.Response(text=_dumps(payload), status=status, content_type="application/json")
