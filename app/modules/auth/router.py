from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.modules.auth import services

from .schema import SignupUser, UserRead

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post(
    "/signup",
    status_code=status.HTTP_201_CREATED,
    response_model=UserRead,
)
async def signup(
    user: SignupUser,
    session: Annotated[AsyncSession, Depends(get_db)],
):
    try:
        created = await services.create_user(session, user.email, user.password)
    except services.EmailAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        ) from exc
    return created
