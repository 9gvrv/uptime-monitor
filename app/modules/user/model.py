from sqlalchemy import String
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm.base import Mapped

from app.db.base import Base, TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "user"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String)
    password_hash: Mapped[str] = mapped_column(String)

    def __repr__(self) -> str:
        return f"User(id: {self.id}, email: {self.email})"
