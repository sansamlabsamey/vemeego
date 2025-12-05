"""
Application configuration using Pydantic Settings.
Loads configuration from environment variables.
"""

import os
from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict

# Get the project root directory (backend folder)
BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE = BASE_DIR / ".env"


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application Info
    APP_NAME: str = "Vemeego"
    APP_VERSION: str = "1.0.0"
    # Environment is loaded from .env file (ENVIRONMENT=development or ENVIRONMENT=production)
    # Falls back to "production" if not set in .env (for security)
    ENVIRONMENT: str = "production"
    LOG_LEVEL: str = "INFO"

    # API Configuration
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    API_RELOAD: bool = True

    # Supabase Configuration
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # Database Configuration
    DATABASE_URL: str = ""

    # JWT Configuration
    # Note: JWT signing is handled automatically by Supabase Auth.
    # Supabase uses its own JWT signing keys (managed in Supabase Dashboard).
    # Tokens are validated using Supabase's get_user() method which verifies
    # tokens against Supabase's JWKS endpoint.
    # See: https://supabase.com/docs/guides/auth/signing-keys

    # LiveKit Configuration
    LIVEKIT_URL: str = ""
    LIVEKIT_API_KEY: str = ""
    LIVEKIT_API_SECRET: str = ""

    # CORS Configuration
    CORS_ORIGINS: str = ""

    @property
    def cors_origins_list(self) -> List[str]:
        """Convert CORS_ORIGINS string to list."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.ENVIRONMENT.lower() == "production"

    @property
    def is_development(self) -> bool:
        """Check if running in development environment."""
        return self.ENVIRONMENT.lower() == "development"

    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE) if ENV_FILE.exists() else None,
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="allow",
    )


# Global settings instance
settings = Settings()
