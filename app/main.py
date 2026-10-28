from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.router import api_router
from app.core.config import get_settings
from app.core.logging import logger
from app.db.session import engine


def create_app():

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        yield
        await engine.dispose()

    settings = get_settings()

    app = FastAPI(title=settings.APP_NAME, lifespan=lifespan)

    @app.get("/")
    def home():
        logger.info("get request on home page")
        return {
            "message": {
                "app": settings.APP_NAME,
                "version": settings.APP_VERSION,
            }
        }

    app.include_router(api_router)

    return app


app = create_app()
