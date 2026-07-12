"""
Сервис рассылок. Отправка выполняется фоновой asyncio-задачей (не блокирует
HTTP-ответ), с троттлингом ~25 сообщений/сек — безопасный запас относительно
лимита Telegram Bot API (30 msg/sec) для избежания FloodWait на массовой
рассылке.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from aiogram import Bot
from aiogram.exceptions import TelegramForbiddenError, TelegramRetryAfter
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ValidationAppError
from app.db.models.broadcast import Broadcast, BroadcastContentType, BroadcastStatus
from app.db.models.log import AuditEventType
from app.db.models.user import TelegramUser
from app.db.session import SessionFactory
from app.repositories.audit_log_repository import AuditLogRepository
from app.repositories.broadcast_repository import BroadcastRepository
from app.repositories.user_repository import UserRepository

logger = logging.getLogger("app.services.broadcast")

_MESSAGES_PER_SECOND = 25
_PROGRESS_COMMIT_EVERY = 20


def build_keyboard(buttons: list | None) -> InlineKeyboardMarkup | None:
    """buttons: [[{"text": "...", "url": "..."}], [...]] — построчно."""
    if not buttons:
        return None

    rows: list[list[InlineKeyboardButton]] = []
    for row in buttons:
        button_row = [InlineKeyboardButton(text=b["text"], url=b["url"]) for b in row if b.get("text") and b.get("url")]
        if button_row:
            rows.append(button_row)

    return InlineKeyboardMarkup(inline_keyboard=rows) if rows else None


class BroadcastService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._broadcasts = BroadcastRepository(session)

    async def create_broadcast(
        self,
        *,
        created_by: int,
        content_type: BroadcastContentType,
        text: str | None,
        file_id: str | None,
        buttons: list | None,
    ) -> Broadcast:
        if content_type == BroadcastContentType.TEXT and not text:
            raise ValidationAppError("Для текстовой рассылки поле text обязательно")
        if content_type != BroadcastContentType.TEXT and not file_id:
            raise ValidationAppError("Для медиа-рассылки поле file_id обязательно")

        target_count = await UserRepository(self._session).count()

        return await self._broadcasts.create(
            created_by=created_by,
            content_type=content_type,
            text=text,
            file_id=file_id,
            buttons=buttons,
            target_count=target_count,
        )

    async def list_broadcasts(self, limit: int = 50, offset: int = 0) -> list[Broadcast]:
        return await self._broadcasts.list_recent(limit=limit, offset=offset)

    async def get_broadcast(self, broadcast_id: int) -> Broadcast | None:
        return await self._broadcasts.get_by_id(broadcast_id)


async def _send_single(bot: Bot, broadcast: Broadcast, chat_id: int, keyboard) -> bool:
    try:
        if broadcast.content_type == BroadcastContentType.TEXT:
            await bot.send_message(chat_id=chat_id, text=broadcast.text, reply_markup=keyboard)
        elif broadcast.content_type == BroadcastContentType.PHOTO:
            await bot.send_photo(chat_id=chat_id, photo=broadcast.file_id, caption=broadcast.text, reply_markup=keyboard)
        elif broadcast.content_type == BroadcastContentType.VIDEO:
            await bot.send_video(chat_id=chat_id, video=broadcast.file_id, caption=broadcast.text, reply_markup=keyboard)
        elif broadcast.content_type == BroadcastContentType.DOCUMENT:
            await bot.send_document(chat_id=chat_id, document=broadcast.file_id, caption=broadcast.text, reply_markup=keyboard)
        elif broadcast.content_type == BroadcastContentType.ANIMATION:
            await bot.send_animation(chat_id=chat_id, animation=broadcast.file_id, caption=broadcast.text, reply_markup=keyboard)
        return True
    except TelegramRetryAfter as exc:
        await asyncio.sleep(exc.retry_after)
        return await _send_single(bot, broadcast, chat_id, keyboard)
    except TelegramForbiddenError:
        return False
    except Exception:  # noqa: BLE001
        logger.exception("Не удалось отправить рассылку %s пользователю %s", broadcast.id, chat_id)
        return False


async def run_broadcast(broadcast_id: int, bot: Bot) -> None:
    """Фоновая задача полной отправки рассылки. Запускается через asyncio.create_task."""
    async with SessionFactory() as session:
        broadcast = await session.get(Broadcast, broadcast_id)
        if broadcast is None:
            return

        keyboard = build_keyboard(broadcast.buttons)
        broadcast.status = BroadcastStatus.SENDING
        broadcast.started_at = datetime.now(timezone.utc)
        await session.commit()

        result = await session.execute(select(TelegramUser.telegram_id).where(TelegramUser.is_globally_banned.is_(False)))
        user_ids = [row[0] for row in result.all()]

        sent = 0
        failed = 0
        interval = 1.0 / _MESSAGES_PER_SECOND

        for index, chat_id in enumerate(user_ids, start=1):
            success = await _send_single(bot, broadcast, chat_id, keyboard)
            if success:
                sent += 1
            else:
                failed += 1

            if index % _PROGRESS_COMMIT_EVERY == 0:
                broadcast.sent_count = sent
                broadcast.failed_count = failed
                await session.commit()

            await asyncio.sleep(interval)

        broadcast.sent_count = sent
        broadcast.failed_count = failed
        broadcast.status = BroadcastStatus.COMPLETED
        broadcast.completed_at = datetime.now(timezone.utc)
        await session.commit()

        await AuditLogRepository(session).add(
            event_type=AuditEventType.BROADCAST_SENT,
            description=f"Рассылка #{broadcast.id} завершена: отправлено {sent}, ошибок {failed}",
            actor_id=broadcast.created_by,
            details={"broadcast_id": broadcast.id, "sent": sent, "failed": failed},
        )
        await session.commit()
