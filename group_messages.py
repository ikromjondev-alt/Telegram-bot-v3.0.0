"""
Основной хендлер сообщений в группах, подключённых к модерации.
Прогоняет каждое сообщение через антиспам и антифлуд, до любой другой
обработки (порядок роутеров важен — этот роутер регистрируется первым
среди обработчиков сообщений группы).
"""

from __future__ import annotations

from aiogram import F, Router
from aiogram.types import Message
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.group_repository import GroupRepository
from app.services.antiflood_service import antiflood_service
from app.services.antispam_service import antispam_service
from app.services.moderation_service import ModerationService
from app.repositories.user_repository import UserRepository

router = Router(name="group_messages")


def _entity_types(message: Message) -> list[str]:
    entities = message.entities or message.caption_entities or []
    return [entity.type for entity in entities]


@router.message(F.chat.type.in_({"group", "supergroup"}))
async def handle_group_message(message: Message, session: AsyncSession) -> None:
    if message.from_user is None or message.from_user.is_bot:
        return

    group_repo = GroupRepository(session)
    group = await group_repo.get_by_chat_id(message.chat.id, with_settings=True)
    if group is None or not group.is_active:
        return

    await UserRepository(session).get_or_create(
        telegram_id=message.from_user.id,
        username=message.from_user.username,
        first_name=message.from_user.first_name,
        last_name=message.from_user.last_name,
    )
    await UserRepository(session).increment_message_count(message.from_user.id, message.chat.id)

    settings = group.settings
    moderation = ModerationService(session, message.bot)

    # --- Антиспам ---
    if settings.antispam_enabled:
        text = message.text or message.caption
        detection = antispam_service.detect(
            text=text,
            entity_types=_entity_types(message),
            is_forwarded=message.forward_origin is not None,
        )
        if detection.is_spam:
            await moderation.delete_message(
                group_id=message.chat.id,
                message_id=message.message_id,
                target_user_id=message.from_user.id,
                admin_id=None,
                reason=f"Антиспам: {detection.reason_summary}",
                is_auto=True,
            )
            return  # сообщение удалено — дальнейшие проверки (антифлуд) не нужны

    # --- Антифлуд ---
    if settings.antiflood_enabled:
        exceeded = await antiflood_service.register_message(
            group_id=message.chat.id,
            user_id=message.from_user.id,
            limit=settings.flood_limit,
            window_seconds=settings.flood_window_seconds,
        )
        if exceeded:
            await moderation.mute(
                group_id=message.chat.id,
                target_user_id=message.from_user.id,
                admin_id=None,
                reason="Превышен лимит сообщений (антифлуд)",
                is_auto=True,
            )
