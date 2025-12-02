"""
Custom exception classes for the application.
These exceptions provide better error handling and response formatting.
"""

from typing import Any, Optional


class AppException(Exception):
    """Base exception class for all application exceptions."""

    def __init__(
        self,
        message: str,
        status_code: int = 400,
        details: Optional[dict[str, Any]] = None,
    ):
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


class AuthenticationError(AppException):
    """Exception raised for authentication failures."""

    def __init__(
        self,
        message: str = "Authentication failed",
        details: Optional[dict[str, Any]] = None,
    ):
        super().__init__(message=message, status_code=401, details=details)


class AuthorizationError(AppException):
    """Exception raised for authorization/permission failures."""

    def __init__(
        self,
        message: str = "Access denied",
        details: Optional[dict[str, Any]] = None,
    ):
        super().__init__(message=message, status_code=403, details=details)


class NotFoundError(AppException):
    """Exception raised when a resource is not found."""

    def __init__(
        self,
        message: str = "Resource not found",
        details: Optional[dict[str, Any]] = None,
    ):
        super().__init__(message=message, status_code=404, details=details)


class ValidationError(AppException):
    """Exception raised for validation failures."""

    def __init__(
        self,
        message: str = "Validation error",
        details: Optional[dict[str, Any]] = None,
    ):
        super().__init__(message=message, status_code=422, details=details)


class ConflictError(AppException):
    """Exception raised for resource conflicts (e.g., duplicate email)."""

    def __init__(
        self,
        message: str = "Resource conflict",
        details: Optional[dict[str, Any]] = None,
    ):
        super().__init__(message=message, status_code=409, details=details)


class BadRequestError(AppException):
    """Exception raised for bad requests."""

    def __init__(
        self,
        message: str = "Bad request",
        details: Optional[dict[str, Any]] = None,
    ):
        super().__init__(message=message, status_code=400, details=details)


class InternalServerError(AppException):
    """Exception raised for internal server errors."""

    def __init__(
        self,
        message: str = "Internal server error",
        details: Optional[dict[str, Any]] = None,
    ):
        super().__init__(message=message, status_code=500, details=details)


class RateLimitError(AppException):
    """Exception raised when rate limit is exceeded."""

    def __init__(
        self,
        message: str = "Rate limit exceeded",
        details: Optional[dict[str, Any]] = None,
    ):
        super().__init__(message=message, status_code=429, details=details)
