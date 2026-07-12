"""
Криптографическое ядро приложения.

Содержит:
  * генерацию и шифрование одноразовых кодов авторизации;
  * выпуск и проверку JWT сессионных токенов панели;
  * валидацию Telegram WebApp initData (официальный алгоритм Telegram);
  * генерацию/проверку CSRF-токенов (double-submit cookie pattern).

Ничего из этого не должно логироваться в открытом виде.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import parse_qsl

import jwt
from cryptography.fernet import Fernet, InvalidToken

from app.config import get_settings
from app.core.exceptions import InvalidInitDataError, InvalidTokenError

_settings = get_settings()
_fernet = Fernet(_settings.fernet_key.encode() if isinstance(_settings.fernet_key, str) else _settings.fernet_key)


# --------------------------------------------------------------------------
# Одноразовые коды авторизации
# --------------------------------------------------------------------------

def generate_auth_code(length: int | None = None) -> str:
    """Криптографически стойкий числовой код (например, '482913')."""
    length = length or _settings.auth_code_length
    lower = 10 ** (length - 1)
    upper = (10 ** length) - 1
    return str(secrets.randbelow(upper - lower + 1) + lower)


def encrypt_auth_code(code: str) -> str:
    """Шифрует код перед сохранением в БД (Fernet, AES128-CBC + HMAC)."""
    return _fernet.encrypt(code.encode("utf-8")).decode("utf-8")


def decrypt_auth_code(encrypted_code: str) -> str | None:
    """Расшифровывает код. Возвращает None если токен повреждён/некорректен."""
    try:
        return _fernet.decrypt(encrypted_code.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        return None


def verify_auth_code(encrypted_code: str, provided_code: str) -> bool:
    """Сравнение в постоянное время, чтобы избежать timing-атак."""
    decrypted = decrypt_auth_code(encrypted_code)
    if decrypted is None:
        return False
    return hmac.compare_digest(decrypted, provided_code)


def auth_code_expiry(now: datetime | None = None) -> datetime:
    now = now or datetime.now(timezone.utc)
    return now + timedelta(seconds=_settings.auth_code_ttl_seconds)


# --------------------------------------------------------------------------
# JWT сессионные токены панели
# --------------------------------------------------------------------------

@dataclass(frozen=True, slots=True)
class SessionTokenPayload:
    telegram_id: int
    role: str
    session_id: str
    issued_at: datetime
    expires_at: datetime


def issue_session_token(telegram_id: int, role: str) -> str:
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=_settings.jwt_access_ttl_minutes)
    payload: dict[str, Any] = {
        "sub": str(telegram_id),
        "role": role,
        "sid": secrets.token_urlsafe(16),
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    return jwt.encode(payload, _settings.secret_key, algorithm=_settings.jwt_algorithm)


def decode_session_token(token: str) -> SessionTokenPayload:
    try:
        payload = jwt.decode(token, _settings.secret_key, algorithms=[_settings.jwt_algorithm])
    except jwt.ExpiredSignatureError as exc:
        raise InvalidTokenError("Сессия истекла, требуется повторный вход") from exc
    except jwt.InvalidTokenError as exc:
        raise InvalidTokenError("Недействительный токен сессии") from exc

    try:
        return SessionTokenPayload(
            telegram_id=int(payload["sub"]),
            role=str(payload["role"]),
            session_id=str(payload["sid"]),
            issued_at=datetime.fromtimestamp(payload["iat"], tz=timezone.utc),
            expires_at=datetime.fromtimestamp(payload["exp"], tz=timezone.utc),
        )
    except (KeyError, ValueError, TypeError) as exc:
        raise InvalidTokenError("Повреждённая структура токена сессии") from exc


# --------------------------------------------------------------------------
# Telegram WebApp initData validation
# https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
# --------------------------------------------------------------------------

def validate_telegram_init_data(init_data: str, max_age_seconds: int = 86400) -> dict[str, str]:
    """
    Проверяет подпись initData, присланного Telegram WebApp клиентом.
    Возвращает распарсенные поля при успешной проверке.
    Бросает InvalidInitDataError при любой неудаче (нет "мягкого" пути).
    """
    if not init_data:
        raise InvalidInitDataError("Пустой initData")

    pairs = parse_qsl(init_data, strict_parsing=True, keep_blank_values=True)
    data = dict(pairs)

    received_hash = data.pop("hash", None)
    if not received_hash:
        raise InvalidInitDataError("Отсутствует поле hash")

    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(data.items()))

    secret_key = hmac.new(b"WebAppData", _settings.bot_token.encode("utf-8"), hashlib.sha256).digest()
    computed_hash = hmac.new(secret_key, data_check_string.encode("utf-8"), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(computed_hash, received_hash):
        raise InvalidInitDataError("Подпись initData не прошла проверку")

    auth_date_raw = data.get("auth_date")
    if not auth_date_raw or not auth_date_raw.isdigit():
        raise InvalidInitDataError("Некорректное поле auth_date")

    if time.time() - int(auth_date_raw) > max_age_seconds:
        raise InvalidInitDataError("initData устарел")

    return data


# --------------------------------------------------------------------------
# CSRF (double-submit token)
# --------------------------------------------------------------------------

def generate_csrf_token(session_id: str) -> str:
    signature = hmac.new(
        _settings.secret_key.encode("utf-8"), session_id.encode("utf-8"), hashlib.sha256
    ).hexdigest()
    return f"{session_id}.{signature}"


def verify_csrf_token(token: str, session_id: str) -> bool:
    try:
        token_session_id, signature = token.split(".", 1)
    except ValueError:
        return False
    if not hmac.compare_digest(token_session_id, session_id):
        return False
    expected = hmac.new(
        _settings.secret_key.encode("utf-8"), session_id.encode("utf-8"), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)
