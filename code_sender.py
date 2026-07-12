"""
Реализация протокола CodeSender (см. app.services.auth_service) поверх
aiogram Bot — отправляет одноразовый код подтверждения в личные сообщения
администратору.
"""

from __future__ import annotations

from aiogram import Bot
from aiogram.exceptions import TelegramForbiddenError


class TelegramCodeSender:
    def __init__(self, bot: Bot) -> None:
        self._bot = bot

    async def send_code(self, telegram_id: int, code: str, ttl_seconds: int) -> None:
        text = (
            "🔐 <b>Код подтверждения входа в панель</b>\n\n"
            f"<code>{code}</code>\n\n"
            f"Код действителен {ttl_seconds} секунд и уничтожается после использования.\n"
            "Если вы не запрашивали вход — проигнорируйте это сообщение."
        )
        try:
            await self._bot.send_message(chat_id=telegram_id, text=text, parse_mode="HTML")
        except TelegramForbiddenError as exc:
            raise RuntimeError(
                "Не удалось отправить код: администратор должен сначала написать боту /start"
            ) from exc
