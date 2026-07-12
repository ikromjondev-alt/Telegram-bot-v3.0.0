"""
Антиспам-детектор.

По ТЗ бот должен без исключений удалять:
  - все ссылки/сайты (http/https/www);
  - сокращённые ссылки;
  - Telegram-ссылки (t.me, telegram.me, tg://) и invite-линки;
  - ссылки на каналы/группы/ботов;
  - любые внешние URL по списку доменных зон;
  - пересланные сообщения, содержащие ссылки;
  - упоминания username, содержащего "bot"/"Bot".

Проверка построена на двух уровнях:
  1. Entities сообщения (Telegram сам размечает url/text_link/mention/
     text_mention — это надёжнее и быстрее regex по сырому тексту).
  2. Regex по тексту — подстраховка для доменов, которые Telegram
     не размечает как entity (например "example.com" без протокола).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum

# Доменные зоны, явно перечисленные в ТЗ.
_FLAGGED_TLDS = (
    "ru", "uz", "com", "net", "io", "xyz", "co", "biz", "site", "online", "store", "shop",
)

_TLD_PATTERN = "|".join(_FLAGGED_TLDS)

# example.com / sub.example.ru / example.io/path — домен + одна из зон из ТЗ.
_BARE_DOMAIN_RE = re.compile(
    rf"\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{{0,61}}[a-zA-Z0-9])?\.)+(?:{_TLD_PATTERN})\b",
    re.IGNORECASE,
)

_PROTOCOL_RE = re.compile(r"(https?://|tg://|www\.)", re.IGNORECASE)
_TELEGRAM_LINK_RE = re.compile(r"(t\.me/|telegram\.me/)", re.IGNORECASE)
_BOT_USERNAME_RE = re.compile(r"@\w*bot\w*", re.IGNORECASE)


class SpamReason(str, Enum):
    URL = "url"
    TELEGRAM_LINK = "telegram_link"
    BOT_MENTION = "bot_mention"
    FORWARDED_WITH_LINK = "forwarded_with_link"


@dataclass(frozen=True, slots=True)
class SpamDetectionResult:
    is_spam: bool
    reasons: tuple[SpamReason, ...] = ()

    @property
    def reason_summary(self) -> str:
        return ", ".join(r.value for r in self.reasons) if self.reasons else ""


class AntispamService:
    def detect(
        self,
        *,
        text: str | None,
        entity_types: list[str] | None = None,
        is_forwarded: bool = False,
    ) -> SpamDetectionResult:
        """
        entity_types — список типов entities сообщения от aiogram
        (например ["url", "mention", "text_link"]), если есть.
        """
        reasons: list[SpamReason] = []
        entity_types = entity_types or []
        text = text or ""

        has_url_entity = any(t in ("url", "text_link") for t in entity_types)
        has_mention_entity = any(t in ("mention", "text_mention") for t in entity_types)

        has_protocol = bool(_PROTOCOL_RE.search(text))
        has_bare_domain = bool(_BARE_DOMAIN_RE.search(text))
        has_telegram_link = bool(_TELEGRAM_LINK_RE.search(text))
        has_bot_mention = bool(_BOT_USERNAME_RE.search(text))

        if has_telegram_link:
            reasons.append(SpamReason.TELEGRAM_LINK)
        elif has_url_entity or has_protocol or has_bare_domain:
            reasons.append(SpamReason.URL)

        if has_mention_entity and has_bot_mention:
            reasons.append(SpamReason.BOT_MENTION)
        elif has_bot_mention:
            reasons.append(SpamReason.BOT_MENTION)

        if is_forwarded and (has_url_entity or has_protocol or has_bare_domain or has_telegram_link):
            reasons.append(SpamReason.FORWARDED_WITH_LINK)

        unique_reasons = tuple(dict.fromkeys(reasons))
        return SpamDetectionResult(is_spam=bool(unique_reasons), reasons=unique_reasons)


antispam_service = AntispamService()
