"""
Rate limiting по скользящему окну.

Реализация in-memory рассчитана на однопроцессный aiohttp-воркер.
Для горизонтального масштабирования (несколько воркеров/подов) состояние
нужно вынести в Redis — интерфейс ниже (RateLimiter) специально узкий,
чтобы такую замену можно было сделать без изменения вызывающего кода.
"""

from __future__ import annotations

import asyncio
import time
from collections import defaultdict, deque


class RateLimiter:
    """Скользящее окно запросов на ключ (например, IP или Telegram ID)."""

    def __init__(self, max_requests: int, window_seconds: int) -> None:
        self._max_requests = max_requests
        self._window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def is_allowed(self, key: str) -> bool:
        now = time.monotonic()
        async with self._lock:
            bucket = self._hits[key]
            threshold = now - self._window_seconds
            while bucket and bucket[0] < threshold:
                bucket.popleft()

            if len(bucket) >= self._max_requests:
                return False

            bucket.append(now)
            return True

    async def remaining(self, key: str) -> int:
        now = time.monotonic()
        async with self._lock:
            bucket = self._hits[key]
            threshold = now - self._window_seconds
            while bucket and bucket[0] < threshold:
                bucket.popleft()
            return max(0, self._max_requests - len(bucket))

    async def reset(self, key: str) -> None:
        async with self._lock:
            self._hits.pop(key, None)

    async def sweep(self) -> None:
        """Периодическая очистка пустых бакетов, чтобы не течь по памяти."""
        now = time.monotonic()
        async with self._lock:
            threshold = now - self._window_seconds
            stale_keys = []
            for key, bucket in self._hits.items():
                while bucket and bucket[0] < threshold:
                    bucket.popleft()
                if not bucket:
                    stale_keys.append(key)
            for key in stale_keys:
                del self._hits[key]


async def periodic_sweep(limiter: RateLimiter, interval_seconds: int = 300) -> None:
    """Фоновая задача очистки — запускается через asyncio.create_task при старте приложения."""
    while True:
        await asyncio.sleep(interval_seconds)
        await limiter.sweep()
