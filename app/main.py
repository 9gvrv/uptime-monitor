from fastapi import FastAPI

from app.core.config import get_settings


def create_app():
    app = FastAPI()
    settings = get_settings()

    @app.get("/")
    def home():
        return {
            "message": {
                "app": settings.APP_NAME,
                "version": settings.APP_VERSION,
                "db_url": settings.DATABASE_URL,
            }
        }

    return app


app = create_app()
