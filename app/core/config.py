# app/core/config.py

from functools import lru_cache
from pathlib import Path
from urllib.parse import parse_qs, parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    db_echo: bool = False

    APP_NAME: str
    APP_VERSION: float
    DATABASE_URL: str

    model_config = SettingsConfigDict(
        env_file=Path(__file__).parents[2] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Changes the URL scheme and removes incompatible parameters.
    @property
    def database_url(self) -> str:
        parsed = urlsplit(self.DATABASE_URL)

        # Replace the scheme
        scheme = "postgresql+asyncpg"

        # Parse query parameters and remove the unwanted ones
        query_params = parse_qsl(parsed.query, keep_blank_values=True)
        excluded = {"sslmode", "channel_binding", "sslnegotiation"}

        filtered_params = [
            (key, value) for key, value in query_params if key not in excluded
        ]

        # Reconstruct the URL, preserving everything else
        return urlunsplit(
            (
                scheme,
                parsed.netloc,
                parsed.path,
                urlencode(filtered_params),
                parsed.fragment,
            )
        )

    # Builds the driver's connection options from the original URL.
    @property
    def database_connect_args(self) -> dict:
        parsed = urlsplit(self.DATABASE_URL)
        query_params = parse_qs(parsed.query)

        connect_args = {"statement_cache_size": 0}

        if query_params.get("sslmode", [None])[0] == "require":
            connect_args["ssl"] = True

        return connect_args


@lru_cache
def get_settings() -> Settings:
    return Settings()
