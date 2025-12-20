"""
Application configuration using Pydantic Settings.
All settings are loaded from environment variables and validated.
"""

from typing import Optional
from pydantic import Field, PostgresDsn, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings with validation.
    
    All settings are loaded from environment variables or .env file.
    """
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )
    
    # ============================================================================
    # Application Settings
    # ============================================================================
    APP_NAME: str = Field(default="School Management Platform", description="Application name")
    APP_VERSION: str = Field(default="1.0.0", description="Application version")
    ENVIRONMENT: str = Field(default="development", description="Environment: development, staging, production")
    DEBUG: bool = Field(default=False, description="Debug mode")
    API_V1_PREFIX: str = Field(default="/api/v1", description="API v1 prefix")
    
    # ============================================================================
    # Database Settings (PostgreSQL)
    # ============================================================================
    DATABASE_URL: PostgresDsn = Field(
        ...,
        description="PostgreSQL database URL (async driver: postgresql+asyncpg://user:pass@host:port/db)"
    )
    DATABASE_POOL_SIZE: int = Field(default=10, description="Database connection pool size")
    DATABASE_MAX_OVERFLOW: int = Field(default=20, description="Max overflow connections")
    DATABASE_POOL_TIMEOUT: int = Field(default=30, description="Pool timeout in seconds")
    DATABASE_ECHO: bool = Field(default=False, description="Echo SQL queries (debug)")
    
    @field_validator("DATABASE_URL")
    @classmethod
    def validate_database_url(cls, v: PostgresDsn) -> str:
        """Ensure async driver is used."""
        url_str = str(v)
        if not url_str.startswith("postgresql+asyncpg://"):
            # Convert to async driver if needed
            if url_str.startswith("postgresql://"):
                url_str = url_str.replace("postgresql://", "postgresql+asyncpg://", 1)
            else:
                raise ValueError("DATABASE_URL must use postgresql+asyncpg:// driver for async support")
        return url_str
    
    # ============================================================================
    # JWT Authentication Settings
    # ============================================================================
    JWT_SECRET_KEY: str = Field(
        ...,
        min_length=32,
        description="Secret key for JWT token signing (min 32 chars, use strong random string)"
    )
    JWT_ALGORITHM: str = Field(default="HS256", description="JWT signing algorithm")
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        default=1440,  # 24 hours
        description="Access token expiry in minutes"
    )
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = Field(
        default=30,
        description="Refresh token expiry in days (with remember me)"
    )
    JWT_REFRESH_TOKEN_EXPIRE_HOURS: int = Field(
        default=24,
        description="Refresh token expiry in hours (without remember me)"
    )
    
    # ============================================================================
    # Password Hashing Settings
    # ============================================================================
    BCRYPT_COST_FACTOR: int = Field(
        default=12,
        ge=10,
        le=14,
        description="Bcrypt cost factor (10-14 recommended, 12 is balanced)"
    )
    
    # ============================================================================
    # Token Settings
    # ============================================================================
    ACCOUNT_SETUP_TOKEN_EXPIRE_DAYS: int = Field(
        default=7,
        description="Account setup token expiry in days"
    )
    PASSWORD_RESET_TOKEN_EXPIRE_HOURS: int = Field(
        default=1,
        description="Password reset token expiry in hours"
    )
    
    # ============================================================================
    # Rate Limiting Settings
    # ============================================================================
    RATE_LIMIT_LOGIN_ATTEMPTS: int = Field(
        default=5,
        description="Max login attempts per window"
    )
    RATE_LIMIT_LOGIN_WINDOW_MINUTES: int = Field(
        default=15,
        description="Login rate limit window in minutes"
    )
    RATE_LIMIT_PASSWORD_RESET_ATTEMPTS: int = Field(
        default=3,
        description="Max password reset requests per window"
    )
    RATE_LIMIT_PASSWORD_RESET_WINDOW_HOURS: int = Field(
        default=1,
        description="Password reset rate limit window in hours"
    )
    
    # ============================================================================
    # AWS S3 Settings (File Storage)
    # ============================================================================
    AWS_ACCESS_KEY_ID: Optional[str] = Field(default=None, description="AWS access key ID")
    AWS_SECRET_ACCESS_KEY: Optional[str] = Field(default=None, description="AWS secret access key")
    AWS_REGION: str = Field(default="us-east-1", description="AWS region")
    AWS_S3_BUCKET_NAME: Optional[str] = Field(default=None, description="S3 bucket name for file storage")
    AWS_S3_ENDPOINT_URL: Optional[str] = Field(
        default=None,
        description="Custom S3 endpoint (for local dev with LocalStack/MinIO)"
    )
    
    # File upload settings
    MAX_FILE_SIZE_MB: int = Field(default=10, description="Max file upload size in MB")
    ALLOWED_FILE_TYPES: list[str] = Field(
        default=[
            "application/pdf",
            "image/jpeg",
            "image/png",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ],
        description="Allowed MIME types for file uploads"
    )
    
    # ============================================================================
    # SMS Settings (Africa's Talking)
    # ============================================================================
    SMS_PROVIDER: str = Field(default="africas_talking", description="SMS provider")
    AFRICAS_TALKING_USERNAME: Optional[str] = Field(default=None, description="Africa's Talking username")
    AFRICAS_TALKING_API_KEY: Optional[str] = Field(default=None, description="Africa's Talking API key")
    AFRICAS_TALKING_SENDER_ID: Optional[str] = Field(default=None, description="SMS sender ID")
    SMS_ENABLED: bool = Field(default=False, description="Enable SMS sending (False for dev)")
    
    # ============================================================================
    # Email Settings (SendGrid)
    # ============================================================================
    EMAIL_PROVIDER: str = Field(default="sendgrid", description="Email provider")
    SENDGRID_API_KEY: Optional[str] = Field(default=None, description="SendGrid API key")
    EMAIL_FROM_ADDRESS: str = Field(
        default="noreply@schoolmanagement.com",
        description="From email address"
    )
    EMAIL_FROM_NAME: str = Field(
        default="School Management Platform",
        description="From name for emails"
    )
    EMAIL_ENABLED: bool = Field(default=False, description="Enable email sending (False for dev)")
    
    # ============================================================================
    # Redis Settings (for Celery/Caching)
    # ============================================================================
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Redis URL for Celery and caching"
    )
    
    # ============================================================================
    # Celery Settings (Background Tasks)
    # ============================================================================
    CELERY_BROKER_URL: Optional[str] = Field(
        default=None,
        description="Celery broker URL (defaults to REDIS_URL if not set)"
    )
    CELERY_RESULT_BACKEND: Optional[str] = Field(
        default=None,
        description="Celery result backend (defaults to REDIS_URL if not set)"
    )
    
    @field_validator("CELERY_BROKER_URL", mode="before")
    @classmethod
    def set_celery_broker(cls, v: Optional[str], info) -> str:
        """Default to REDIS_URL if not set."""
        if v is None and "REDIS_URL" in info.data:
            return info.data["REDIS_URL"]
        return v or "redis://localhost:6379/0"
    
    @field_validator("CELERY_RESULT_BACKEND", mode="before")
    @classmethod
    def set_celery_backend(cls, v: Optional[str], info) -> str:
        """Default to REDIS_URL if not set."""
        if v is None and "REDIS_URL" in info.data:
            return info.data["REDIS_URL"]
        return v or "redis://localhost:6379/0"
    
    # ============================================================================
    # CORS Settings
    # ============================================================================
    CORS_ORIGINS: list[str] = Field(
        default=[
            "http://localhost:3000",
            "http://localhost:5173",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:5173"
        ],
        description="Allowed CORS origins"
    )
    CORS_ALLOW_CREDENTIALS: bool = Field(default=True, description="Allow credentials in CORS")
    CORS_ALLOW_METHODS: list[str] = Field(default=["*"], description="Allowed HTTP methods")
    CORS_ALLOW_HEADERS: list[str] = Field(default=["*"], description="Allowed headers")
    
    # ============================================================================
    # Security Settings
    # ============================================================================
    ALLOWED_HOSTS: list[str] = Field(default=["*"], description="Allowed hosts")
    
    # ============================================================================
    # Logging Settings
    # ============================================================================
    LOG_LEVEL: str = Field(default="INFO", description="Logging level")
    LOG_FORMAT: str = Field(
        default="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        description="Log format"
    )
    
    # ============================================================================
    # Testing Settings
    # ============================================================================
    TESTING: bool = Field(default=False, description="Testing mode")
    TEST_DATABASE_URL: Optional[PostgresDsn] = Field(
        default=None,
        description="Test database URL (overrides DATABASE_URL in tests)"
    )
    
    # ============================================================================
    # Helper Properties
    # ============================================================================
    @property
    def is_development(self) -> bool:
        """Check if running in development mode."""
        return self.ENVIRONMENT.lower() == "development"
    
    @property
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return self.ENVIRONMENT.lower() == "production"
    
    @property
    def is_testing(self) -> bool:
        """Check if running in testing mode."""
        return self.TESTING or self.ENVIRONMENT.lower() == "testing"
    
    @property
    def max_file_size_bytes(self) -> int:
        """Get max file size in bytes."""
        return self.MAX_FILE_SIZE_MB * 1024 * 1024
    
    def model_post_init(self, __context) -> None:
        """Validate settings after initialization."""
        # Ensure JWT secret is strong in production
        if self.is_production and len(self.JWT_SECRET_KEY) < 64:
            raise ValueError("JWT_SECRET_KEY must be at least 64 characters in production")
        
        # Ensure required services are configured in production
        if self.is_production:
            if not self.AWS_ACCESS_KEY_ID or not self.AWS_SECRET_ACCESS_KEY:
                raise ValueError("AWS credentials must be set in production")
            if not self.SENDGRID_API_KEY:
                raise ValueError("SendGrid API key must be set in production")
            if not self.AFRICAS_TALKING_API_KEY:
                raise ValueError("Africa's Talking API key must be set in production")


# ============================================================================
# Global Settings Instance
# ============================================================================
settings = Settings()


# ============================================================================
# Helper Functions
# ============================================================================
def get_settings() -> Settings:
    """
    Get settings instance.
    
    This function can be used as a FastAPI dependency:
    
    @app.get("/info")
    def info(settings: Settings = Depends(get_settings)):
        return {"environment": settings.ENVIRONMENT}
    """
    return settings

