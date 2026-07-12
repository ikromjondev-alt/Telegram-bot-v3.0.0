"""
Парсинг длительности, указанной администратором в команде модерации,
например: /mute 10m спам, /mute 2h реклама, /mute 1d флуд.
"""

from __future__ import annotations

import re

_DURATION_RE = re.compile(r"^(\d+)([mhd])$", re.IGNORECASE)

_UNIT_TO_MINUTES = {"m": 1, "h": 60, "d": 60 * 24}


def parse_duration_minutes(token: str) -> int | None:
    """Возвращает длительность в минутах или None, если токен не является длительностью."""
    match = _DURATION_RE.match(token.strip())
    if not match:
        return None
    value, unit = match.groups()
    return int(value) * _UNIT_TO_MINUTES[unit.lower()]


def split_command_args(raw_args: str) -> tuple[int | None, str | None]:
    """
    Разбирает аргументы команды на (длительность_в_минутах, причина).
    Первый токен интерпретируется как длительность, если он ей соответствует,
    иначе весь текст считается причиной.
    """
    raw_args = raw_args.strip()
    if not raw_args:
        return None, None

    parts = raw_args.split(maxsplit=1)
    duration = parse_duration_minutes(parts[0])

    if duration is not None:
        reason = parts[1].strip() if len(parts) > 1 else None
        return duration, reason

    return None, raw_args
