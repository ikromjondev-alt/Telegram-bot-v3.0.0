"""
Сервис модерации — единая точка входа для всех действий над участниками
группы: мут, бан, кик, warn, снятие ограничений, массовая очистка.

Последовательность любого действия:
  1. Применить ограничение через Telegram Bot API.
  2. Записать ModerationAction (источник для Dashboard/Логов).
  3. Обновить агрегированную статистику пользователя (UserGroupStat).
  4. Отправить в группу уведомление о применённом наказании.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from aiogram import Bot
from aiogram.types import ChatPermissions
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.db.models.moderation import ModerationActionType
from app.repositories.group_repository import GroupRepository
from app.repositories.moderation_repository import ModerationRepository
from app.repositories.user_repository import UserRepository

_MUTED_PERMISSIONS = ChatPermissions(
    can_send_messages=False,
    can_send_audios=False,
    can_send_documents=False,
    can_send_photos=False,
    can_send_videos=False,
    can_send_video_notes=False,
    can_send_voice_notes=False,
    can_send_polls=False,
    can_send_other_messages=False,
    can_add_web_page_previews=False,
)

_UNMUTED_PERMISSIONS = ChatPermissions(
    can_send_messages=True,
    can_send_audios=True,
    can_send_documents=True,
    can_send_photos=True,
    can_send_videos=True,
    can_send_video_notes=True,
    can_send_voice_notes=True,
    can_send_polls=True,
    can_send_other_messages=True,
    can_add_web_page_previews=True,
)


class ModerationService:
    def __init__(self, session: AsyncSession, bot: Bot) -> None:
        self._session = session
        self._bot = bot
        self._groups = GroupRepository(session)
        self._users = UserRepository(session)
        self._actions = ModerationRepository(session)

    async def _require_group(self, group_id: int):
        group = await self._groups.get_by_chat_id(group_id, with_settings=True)
        if group is None:
            raise NotFoundError("Группа не найдена или не подключена к модерации")
        return group

    async def mute(
        self,
        *,
        group_id: int,
        target_user_id: int,
        admin_id: int | None,
        duration_minutes: int | None = None,
        reason: str | None = None,
        is_auto: bool = False,
    ) -> None:
        group = await self._require_group(group_id)
        minutes = duration_minutes or group.settings.mute_duration_minutes
        until = datetime.now(timezone.utc) + timedelta(minutes=minutes)

        await self._bot.restrict_chat_member(
            chat_id=group_id,
            user_id=target_user_id,
            permissions=_MUTED_PERMISSIONS,
            until_date=until,
        )

        stat = await self._users.get_or_create_group_stat(target_user_id, group_id)
        stat.is_muted = True
        stat.muted_until = until
        await self._session.flush()

        await self._actions.add(
            group_id=group_id,
            target_user_id=target_user_id,
            action_type=ModerationActionType.AUTO_ANTIFLOOD if is_auto else ModerationActionType.MUTE,
            admin_id=admin_id,
            reason=reason,
            duration_seconds=minutes * 60,
            expires_at=until,
        )

        await self._notify(
            group_id, "🔇 Мут", target_user_id, reason, extra=f"до {until.strftime('%d.%m.%Y %H:%M UTC')}"
        )

    async def unmute(self, *, group_id: int, target_user_id: int, admin_id: int | None) -> None:
        await self._require_group(group_id)

        await self._bot.restrict_chat_member(
            chat_id=group_id, user_id=target_user_id, permissions=_UNMUTED_PERMISSIONS
        )

        stat = await self._users.get_or_create_group_stat(target_user_id, group_id)
        stat.is_muted = False
        stat.muted_until = None
        await self._session.flush()

        await self._actions.add(
            group_id=group_id,
            target_user_id=target_user_id,
            action_type=ModerationActionType.UNMUTE,
            admin_id=admin_id,
        )
        await self._notify(group_id, "🔊 Мут снят", target_user_id, None)

    async def ban(
        self,
        *,
        group_id: int,
        target_user_id: int,
        admin_id: int | None,
        reason: str | None = None,
        is_auto: bool = False,
    ) -> None:
        await self._require_group(group_id)

        await self._bot.ban_chat_member(chat_id=group_id, user_id=target_user_id)

        stat = await self._users.get_or_create_group_stat(target_user_id, group_id)
        stat.is_banned = True
        stat.banned_at = datetime.now(timezone.utc)
        await self._session.flush()

        await self._actions.add(
            group_id=group_id,
            target_user_id=target_user_id,
            action_type=ModerationActionType.AUTO_ANTISPAM if is_auto else ModerationActionType.BAN,
            admin_id=admin_id,
            reason=reason,
        )
        await self._notify(group_id, "⛔ Бан", target_user_id, reason)

    async def unban(self, *, group_id: int, target_user_id: int, admin_id: int | None) -> None:
        await self._require_group(group_id)

        await self._bot.unban_chat_member(chat_id=group_id, user_id=target_user_id, only_if_banned=True)

        stat = await self._users.get_or_create_group_stat(target_user_id, group_id)
        stat.is_banned = False
        stat.banned_at = None
        await self._session.flush()

        await self._actions.add(
            group_id=group_id,
            target_user_id=target_user_id,
            action_type=ModerationActionType.UNBAN,
            admin_id=admin_id,
        )
        await self._notify(group_id, "✅ Бан снят", target_user_id, None)

    async def kick(
        self, *, group_id: int, target_user_id: int, admin_id: int | None, reason: str | None = None
    ) -> None:
        await self._require_group(group_id)

        # Кик = бан + немедленный анбан (Telegram API не имеет отдельного метода "kick").
        await self._bot.ban_chat_member(chat_id=group_id, user_id=target_user_id)
        await self._bot.unban_chat_member(chat_id=group_id, user_id=target_user_id, only_if_banned=True)

        await self._actions.add(
            group_id=group_id,
            target_user_id=target_user_id,
            action_type=ModerationActionType.KICK,
            admin_id=admin_id,
            reason=reason,
        )
        await self._notify(group_id, "👢 Кик", target_user_id, reason)

    async def warn(
        self, *, group_id: int, target_user_id: int, admin_id: int | None, reason: str | None = None
    ) -> tuple[int, int]:
        """Возвращает (текущее число warn, лимит). Автоматически мутит при достижении лимита."""
        group = await self._require_group(group_id)

        stat = await self._users.get_or_create_group_stat(target_user_id, group_id)
        stat.warns_count += 1
        await self._session.flush()

        await self._actions.add(
            group_id=group_id,
            target_user_id=target_user_id,
            action_type=ModerationActionType.WARN,
            admin_id=admin_id,
            reason=reason,
        )

        limit = group.settings.warn_limit
        await self._notify(
            group_id, "⚠️ Предупреждение", target_user_id, reason, extra=f"{stat.warns_count}/{limit}"
        )

        if stat.warns_count >= limit:
            stat.warns_count = 0
            await self._session.flush()
            await self.mute(
                group_id=group_id,
                target_user_id=target_user_id,
                admin_id=admin_id,
                reason="Достигнут лимит предупреждений",
            )

        return stat.warns_count, limit

    async def clear_messages(
        self, *, group_id: int, message_ids: list[int], admin_id: int | None
    ) -> int:
        await self._require_group(group_id)

        deleted = 0
        for message_id in message_ids:
            try:
                await self._bot.delete_message(chat_id=group_id, message_id=message_id)
                deleted += 1
            except Exception:  # noqa: BLE001 — сообщение могло быть уже удалено
                continue

        await self._actions.add(
            group_id=group_id,
            target_user_id=admin_id or 0,
            action_type=ModerationActionType.CLEAR,
            admin_id=admin_id,
            reason=f"Удалено сообщений: {deleted}",
        )
        return deleted

    async def delete_message(
        self,
        *,
        group_id: int,
        message_id: int,
        target_user_id: int,
        admin_id: int | None,
        reason: str,
        is_auto: bool = False,
    ) -> None:
        try:
            await self._bot.delete_message(chat_id=group_id, message_id=message_id)
        except Exception:  # noqa: BLE001
            pass

        await self._users.increment_deleted_count(target_user_id, group_id)

        await self._actions.add(
            group_id=group_id,
            target_user_id=target_user_id,
            action_type=ModerationActionType.AUTO_ANTISPAM if is_auto else ModerationActionType.DELETE_MESSAGE,
            admin_id=admin_id,
            reason=reason,
        )

    async def _notify(
        self,
        group_id: int,
        title: str,
        target_user_id: int,
        reason: str | None,
        extra: str | None = None,
    ) -> None:
        lines = [f"{title}", f"Пользователь: <a href='tg://user?id={target_user_id}'>{target_user_id}</a>"]
        if reason:
            lines.append(f"Причина: {reason}")
        if extra:
            lines.append(extra)
        lines.append(f"Время: {datetime.now(timezone.utc).strftime('%d.%m.%Y %H:%M UTC')}")

        try:
            await self._bot.send_message(chat_id=group_id, text="\n".join(lines), parse_mode="HTML")
        except Exception:  # noqa: BLE001 — уведомление не должно ломать основной flow
            pass
