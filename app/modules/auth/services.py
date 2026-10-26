from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import User
from app.modules.auth.security import hash_password


class EmailAlreadyExistsError(Exception):
    pass


def _normalize_email(email: str) -> str:
    return email.strip().lower()


async def find_user_by_email(session: AsyncSession, email: str) -> User | None:
    user = await session.execute(
        select(User).where(User.email == _normalize_email(email))
    )
    return user.scalar_one_or_none()


async def create_user(session: AsyncSession, email: str, password: str) -> User:
    user = User(email=_normalize_email(email), password_hash=hash_password(password))
    session.add(user)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise EmailAlreadyExistsError from exc
    await session.refresh(user)
    return user
