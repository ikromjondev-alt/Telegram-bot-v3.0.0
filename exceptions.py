"""
Единая иерархия исключений приложения.
Позволяет API-слою корректно транслировать ошибки в HTTP-статусы.
"""

from __future__ import annotations


class AppError(Exception):
    """Базовая ошибка приложения."""

    http_status: int = 500
    code: str = "internal_error"

    def __init__(self, message: str | None = None) -> None:
        super().__init__(message or self.code)
        self.message = message or self.code


class NotFoundError(AppError):
    http_status = 404
    code = "not_found"


class ForbiddenError(AppError):
    http_status = 403
    code = "forbidden"


class UnauthorizedError(AppError):
    http_status = 401
    code = "unauthorized"


class ValidationAppError(AppError):
    http_status = 422
    code = "validation_error"


class RateLimitExceededError(AppError):
    http_status = 429
    code = "rate_limit_exceeded"


class AdminNotFoundError(NotFoundError):
    code = "admin_not_found"


class RootAdminProtectedError(ForbiddenError):
    code = "root_admin_protected"

    def __init__(self, message: str | None = None) -> None:
        super().__init__(message or "Главного администратора нельзя удалить или изменить")


class InvalidAuthCodeError(UnauthorizedError):
    code = "invalid_auth_code"


class AuthCodeExpiredError(UnauthorizedError):
    code = "auth_code_expired"


class AuthCodeAttemptsExceededError(UnauthorizedError):
    code = "auth_code_attempts_exceeded"


class InvalidInitDataError(UnauthorizedError):
    code = "invalid_init_data"


class InvalidTokenError(UnauthorizedError):
    code = "invalid_token"


class CSRFValidationError(ForbiddenError):
    code = "csrf_validation_failed"
