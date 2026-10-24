from sqlalchemy import Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class Monitor(Base, TimestampMixin):
    __tablename__ = "monitors"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    url: Mapped[str] = mapped_column(String(2048), nullable=False)
    timeout_seconds: Mapped[float] = mapped_column(Float, nullable=False, default=10.0)

    def __repr__(self) -> str:
        return f"Monitor(id: {self.id}, name: {self.name}, url: {self.url})"
