from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from config import settings
from i18n import t


def lang_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="🇷🇺 Русский", callback_data="lang:ru"),
        InlineKeyboardButton(text="🇺🇿 O'zbek",  callback_data="lang:uz"),
    ]])


def main_menu_kb(lang: str, tg_id: int) -> InlineKeyboardMarkup:
    webapp_url = f"https://{settings.RENDER_EXTERNAL_HOSTNAME}/app?tg_id={tg_id}&lang={lang}"
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text=t(lang, "open_shop"),
            web_app=WebAppInfo(url=webapp_url)
        )],
        [InlineKeyboardButton(text=t(lang, "profile_btn"), callback_data="profile")],
        [InlineKeyboardButton(text=t(lang, "topup_btn"),   callback_data="topup")],
        [InlineKeyboardButton(
            text=t(lang, "support_btn"),
            url=f"https://t.me/{settings.SUPPORT_USERNAME.lstrip('@')}"
        )],
    ])


def topup_cancel_kb(lang: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(
            text="❌ Отмена" if lang == "ru" else "❌ Bekor",
            callback_data="cancel"
        )
    ]])


def admin_topup_kb(request_id: int, user_id: int, amount: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="✅ Подтвердить", callback_data=f"topup_ok:{request_id}:{user_id}:{amount}"),
        InlineKeyboardButton(text="❌ Отклонить",   callback_data=f"topup_no:{request_id}:{user_id}"),
    ]])


def admin_order_kb(order_id: int, user_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="✅ Выполнен", callback_data=f"order_done:{order_id}:{user_id}"),
        InlineKeyboardButton(text="❌ Отменить", callback_data=f"order_cancel:{order_id}:{user_id}"),
    ]])


def review_kb(lang: str, order_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text=t(lang, "review_yes"), callback_data=f"review_yes:{order_id}"),
        InlineKeyboardButton(text=t(lang, "review_no"),  callback_data=f"review_no:{order_id}"),
    ]])
