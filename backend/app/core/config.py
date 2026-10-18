from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    # Resolve .env relative to backend/, not the shell's current directory.
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        extra="ignore",
    )

    hms_env: str = "development"
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"


settings = Settings()
