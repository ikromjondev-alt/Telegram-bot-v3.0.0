"""
Команды ручной модерации. Все команды выполняются ответом (reply) на
сообщение нарушителя и доступны только администраторам панели с правом
на модерацию (см. IsPanelAdmin).

Примеры:
  /mute 30m спам
  /mute 2h
  /ban реклама
  /kick
  /warn флуд
  /unmute
  /unban
  /clear 20   — удалить последние 20 сообщений отправителя в этом чате
"""

from __future__ import annotations

from aiogram import F, Router
from aiogram.filters import Command, CommandObject
from aiogram.types import Message
from sqlalchemy.ext.asyncio import AsyncSession

from app.bot.filters.admin_filter import IsPanelAdmin
from app.core.exceptions import AppError
from app.core.parsing import split_command_args
from app.db.models.admin import Admin
from app.services.moderation_service import ModerationService

router = Router(name="moderation_commands")
router.message.filter(F.chat.type.in_({"group", "supergroup"}), IsPanelAdmin())


async def _require_reply_target(message: Message) -> Message | None:
    if message.reply_to_message is None or message.reply_to_message.from_user is None:
        await message.reply("Эта команда используется ответом (reply) на сообщение пользователя.")
        return None
    return message.reply_to_message


@router.message(Command("mute"))
async def cmd_mute(message: Message, command: CommandObject, session: AsyncSession, panel_admin: Admin) -> None:
    target = await _require_reply_target(message)
    if target is None:
        return

    duration_minutes, reason = split_command_args(command.args or "")
    service = ModerationService(session, message.bot)
    try:
        await service.mute(
            group_id=message.chat.id,
            target_user_id=target.from_user.id,
            admin_id=panel_admin.telegram_id,
            duration_minutes=duration_minutes,
            reason=reason,
        )
    except AppError as exc:
        await message.reply(f"Ошибка: {exc.message}")


@router.message(Command("unmute"))
async def cmd_unmute(message: Message, session: AsyncSession, panel_admin: Admin) -> None:
    target = await _require_reply_target(message)
    if target is None:
        return

    service = ModerationService(session, message.bot)
    try:
        await service.unmute(
            group_id=message.chat.id, target_user_id=target.from_user.id, admin_id=panel_admin.telegram_id
        )
    except AppError as exc:
        await message.reply(f"Ошибка: {exc.message}")


@router.message(Command("ban"))
async def cmd_ban(message: Message, command: CommandObject, session: AsyncSession, panel_admin: Admin) -> None:
    target = await _require_reply_target(message)
    if target is None:
        return

    _, reason = split_command_args(command.args or "")
    service = ModerationService(session, message.bot)
    try:
        await service.ban(
            group_id=message.chat.id,
            target_user_id=target.from_user.id,
            admin_id=panel_admin.telegram_id,
            reason=reason,
        )
    except AppError as exc:
        await message.reply(f"Ошибка: {exc.message}")


@router.message(Command("unban"))
async def cmd_unban(message: Message, command: CommandObject, session: AsyncSession, panel_admin: Admin) -> None:
    args = (command.args or "").strip()
    target_id: int | None = None

    if message.reply_to_message and message.reply_to_message.from_user:
        target_id = message.reply_to_message.from_user.id
    elif args.isdigit():
        target_id = int(args)

    if target_id is None:
        await message.reply("Укажите Telegram ID пользователя или ответьте на его сообщение.")
        return

    service = ModerationService(session, message.bot)
    try:
        await service.unban(group_id=message.chat.id, target_user_id=target_id, admin_id=panel_admin.telegram_id)
    except AppError as exc:
        await message.reply(f"Ошибка: {exc.message}")


@router.message(Command("kick"))
async def cmd_kick(message: Message, command: CommandObject, session: AsyncSession, panel_admin: Admin) -> None:
    target = await _require_reply_target(message)
    if target is None:
        return

    _, reason = split_command_args(command.args or "")
    service = ModerationService(session, message.bot)
    try:
        await service.kick(
            group_id=message.chat.id,
            target_user_id=target.from_user.id,
            admin_id=panel_admin.telegram_id,
            reason=reason,
        )
    except AppError as exc:
        await message.reply(f"Ошибка: {exc.message}")


@router.message(Command("warn"))
async def cmd_warn(message: Message, command: CommandObject, session: AsyncSession, panel_admin: Admin) -> None:
    target = await _require_reply_target(message)
    if target is None:
        return

    _, reason = split_command_args(command.args or "")
    service = ModerationService(session, message.bot)
    try:
        await service.warn(
            group_id=message.chat.id,
            target_user_id=target.from_user.id,
            admin_id=panel_admin.telegram_id,
            reason=reason,
        )
    except AppError as exc:
        await message.reply(f"Ошибка: {exc.message}")


@router.message(Command("clear"))
async def cmd_clear(message: Message, command: CommandObject, session: AsyncSession, panel_admin: Admin) -> None:
    args = (command.args or "").strip()
    if not args.isdigit():
        await message.reply("Укажите количество сообщений для удаления, например: /clear 20")
        return

    count = min(int(args), 100)  # защита от случайной массовой очистки всей истории
    first_id = message.message_id - count
    message_ids = list(range(first_id, message.message_id))

    service = ModerationService(session, message.bot)
    deleted = await service.clear_messages(
        group_id=message.chat.id, message_ids=message_ids, admin_id=panel_admin.telegram_id
    )
    await message.reply(f"Удалено сообщений: {deleted}")
