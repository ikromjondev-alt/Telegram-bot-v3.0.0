"""
Централизованная конфигурация приложения.
Все параметры читаются из переменных окружения (.env).
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, PostgresDsn, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- Telegram ---
    bot_token: str = Field(..., description="Токен Telegram-бота от @BotFather")
    webapp_url: str = Field(..., description="Публичный HTTPS URL WebApp панели")

    # --- База данных ---
    database_url: PostgresDsn = Field(..., description="asyncpg DSN PostgreSQL")
    db_pool_size: int = Field(default=20, ge=1, le=100)
    db_max_overflow: int = Field(default=10, ge=0, le=100)
    db_echo: bool = Field(default=False)

    # --- Безопасность / авторизация ---
    secret_key: str = Field(..., min_length=32, description="Ключ для JWT и HMAC подписей")
    auth_code_ttl_seconds: int = Field(default=120, ge=30, le=600)
    auth_code_length: int = Field(default=6, ge=4, le=8)
    jwt_access_ttl_minutes: int = Field(default=30, ge=5, le=1440)
    jwt_algorithm: str = Field(default="HS256")
    fernet_key: str = Field(..., description="32-byte urlsafe base64 ключ для шифрования кодов")

    # --- Главные администраторы (нельзя удалить/изменить) ---
    root_admin_ids: str = Field(
        default="8150331577,7979780050",
        description="Список Telegram ID главных администраторов через запятую",
    )

    # --- Rate limiting ---
    rate_limit_requests: int = Field(default=100, ge=1)
    rate_limit_window_seconds: int = Field(default=60, ge=1)
    auth_rate_limit_attempts: int = Field(default=5, ge=1)
    auth_rate_limit_window_seconds: int = Field(default=300, ge=1)

    # --- Модерация / антиспам по умолчанию ---
    default_mute_minutes: int = Field(default=60, ge=1)
    default_warn_limit: int = Field(default=3, ge=1)
    default_flood_limit: int = Field(default=5, ge=1)
    default_flood_window_seconds: int = Field(default=10, ge=1)
    default_language: Literal["ru", "uz"] = Field(default="ru")

    # --- HTTP сервер (aiohttp) ---
    api_host: str = Field(default="0.0.0.0")
    api_port: int = Field(default=8080, ge=1, le=65535)
    cors_allowed_origins: str = Field(default="")

    # --- Окружение ---
    environment: Literal["development", "production"] = Field(default="production")
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = Field(default="INFO")

    @field_validator("root_admin_ids")
    @classmethod
    def _validate_root_admin_ids(cls, value: str) -> str:
        parts = [p.strip() for p in value.split(",") if p.strip()]
        if not parts:
            raise ValueError("root_admin_ids не может быть пустым")
        for part in parts:
            if not part.isdigit():
                raise ValueError(f"Некорректный Telegram ID в root_admin_ids: {part}")
        return value

    @property
    def root_admin_id_list(self) -> list[int]:
        return [int(p.strip()) for p in self.root_admin_ids.split(",") if p.strip()]

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_allowed_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Возвращает синглтон настроек приложения (кэшируется на весь процесс)."""
    return Settings()
