"""
Logging utility that respects environment settings.
Only logs in development mode to prevent sensitive information exposure.
"""

import logging
import sys
from typing import Optional

from app.core.config import settings

# Configure root logger
logger = logging.getLogger("vemeego")
logger.setLevel(getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))

# Only add handlers if not already configured
if not logger.handlers:
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(logging.DEBUG)
    
    # Format: [LEVEL] message
    formatter = logging.Formatter(
        "[%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)


def log_debug(message: str, *args, **kwargs):
    """Log debug message only in development."""
    if settings.is_development:
        logger.debug(message, *args, **kwargs)


def log_info(message: str, *args, **kwargs):
    """Log info message only in development."""
    if settings.is_development:
        logger.info(message, *args, **kwargs)


def log_warning(message: str, *args, **kwargs):
    """Log warning message only in development."""
    if settings.is_development:
        logger.warning(message, *args, **kwargs)


def log_error(message: str, *args, **kwargs):
    """Log error message only in development."""
    if settings.is_development:
        logger.error(message, *args, **kwargs)


def log_critical(message: str, *args, **kwargs):
    """Log critical message only in development."""
    if settings.is_development:
        logger.critical(message, *args, **kwargs)


# For startup/shutdown messages that should always be shown
def log_startup(message: str):
    """Log startup message (always shown, but respects environment for details)."""
    if settings.is_development:
        logger.info(message)
    else:
        # In production, only log critical startup info
        logger.info(message)


# Convenience function for print() replacement
def safe_print(message: str, level: str = "info"):
    """
    Safe replacement for print() that respects environment.
    
    Args:
        message: Message to log
        level: Log level (debug, info, warning, error, critical)
    """
    if settings.is_development:
        level_func = {
            "debug": log_debug,
            "info": log_info,
            "warning": log_warning,
            "error": log_error,
            "critical": log_critical,
        }.get(level.lower(), log_info)
        level_func(message)

