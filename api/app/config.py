from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    port: int = 8080
    public_base_url: str = "http://localhost:8080"

    telegram_bot_token: str = ""
    telegram_allowed_user_ids: str = ""
    telegram_webhook_secret: str = ""

    supabase_url: str = ""
    supabase_service_role_key: str = ""

    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-6"

    elevenlabs_api_key: str = ""
    elevenlabs_voice_a: str = "Rachel"
    elevenlabs_voice_b: str = "Adam"

    openai_api_key: str = ""

    napkin_api_key: str = ""
    runwayml_api_key: str = ""

    youtube_cookies_file: str = ""

    @property
    def allowed_user_ids(self) -> list[int]:
        if not self.telegram_allowed_user_ids:
            return []
        return [int(x.strip()) for x in self.telegram_allowed_user_ids.split(",") if x.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
