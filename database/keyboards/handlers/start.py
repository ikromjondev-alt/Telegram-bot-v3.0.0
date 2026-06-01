from aiogram import Router, F
from aiogram.filters import CommandStart
from aiogram.types import Message, CallbackQuery
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database.models import User
from keyboards.inline import lang_kb, main_menu_kb
from i18n import t

router = Router()


async def get_or_create_user(session: AsyncSession, tg_user, referral_by=None):
    result = await session.execute(
        select(User).where(User.telegram_id == tg_user.id)
    )
    user = result.scalar_one_or_none()
    if not user:
        user = User(
            telegram_id=tg_user.id,
            username=tg_user.username or "",
            language="",
            referral_by=referral_by,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
    return user


@router.message(CommandStart())
async def cmd_start(message: Message, session: AsyncSession):
    args = message.text.split(maxsplit=1)
    referral_by = None
    if len(args) > 1:
        try:
            ref = int(args[1])
            if ref != message.from_user.id:
                referral_by = ref
        except ValueError:
            pass

    user = await get_or_create_user(session, message.from_user, referral_by)

    if user.language in ("ru", "uz"):
        await message.answer(
            t(user.language, "main_menu"),
            reply_markup=main_menu_kb(user.language, user.telegram_id)
        )
    else:
        await message.answer(
            "👋 Добро пожаловать! / Xush kelibsiz!\n\nВыберите язык / Tilni tanlang:",
            reply_markup=lang_kb()
        )


@router.callback_query(F.data.startswith("lang:"))
async def set_language(call: CallbackQuery, session: AsyncSession):
    lang = call.data.split(":")[1]
    result = await session.execute(
        select(User).where(User.telegram_id == call.from_user.id)
    )
    user = result.scalar_one_or_none()
    if user:
        user.language = lang
        await session.commit()
    await call.message.edit_text(
        t(lang, "main_menu"),
        reply_markup=main_menu_kb(lang, call.from_user.id)
    )
    await call.answer()


@router.callback_query(F.data == "cancel")
async def cancel_action(call: CallbackQuery, session: AsyncSession):
    result = await session.execute(
        select(User).where(User.telegram_id == call.from_user.id)
    )
    user = result.scalar_one_or_none()
    lang = user.language if user and user.language else "ru"
    await call.message.edit_text(
        t(lang, "main_menu"),
        reply_markup=main_menu_kb(lang, call.from_user.id)
    )
    await call.answer()
