"""
Антифлуд: отслеживание частоты сообщений каждого пользователя в каждой группе.

Лимит и окно настраиваются индивидуально на группу (GroupSettings.flood_limit /
flood_window_seconds), поэтому сервис принимает их параметром при каждой
проверке, а не хранит собственную конфигурацию.
"""

from __future__ import annotations

import asyncio
import time
from collections import defaultdict, deque


class AntifloodService:
    def __init__(self) -> None:
        # ключ: (group_id, user_id) -> deque временных меток сообщений
        self._history: dict[tuple[int, int], deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def register_message(
        self,
        group_id: int,
        user_id: int,
        limit: int,
        window_seconds: int,
    ) -> bool:
        """
        Регистрирует новое сообщение и возвращает True, если лимит превышен
        (т.е. нужно применить антифлуд-мут).
        """
        key = (group_id, user_id)
        now = time.monotonic()

        async with self._lock:
            bucket = self._history[key]
            threshold = now - window_seconds
            while bucket and bucket[0] < threshold:
                bucket.popleft()

            bucket.append(now)
            exceeded = len(bucket) > limit

            if exceeded:
                # Сбрасываем историю, чтобы не мутить повторно на каждое
                # следующее сообщение до окончания текущего мута.
                bucket.clear()

            return exceeded

    async def reset(self, group_id: int, user_id: int) -> None:
        async with self._lock:
            self._history.pop((group_id, user_id), None)

    async def sweep(self, max_age_seconds: int = 3600) -> None:
        now = time.monotonic()
        async with self._lock:
            stale_keys = [
                key
                for key, bucket in self._history.items()
                if not bucket or (now - bucket[-1]) > max_age_seconds
            ]
            for key in stale_keys:
                del self._history[key]


antiflood_service = AntifloodService()
