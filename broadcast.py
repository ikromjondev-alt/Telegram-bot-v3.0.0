"""
Массовые рассылки сообщений от администраторов панели.
"""

from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Enum, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class BroadcastContentType(str, enum.Enum):
    TEXT = "text"
    PHOTO = "photo"
    VIDEO = "video"
    DOCUMENT = "document"
    ANIMATION = "animation"  # GIF


class BroadcastStatus(str, enum.Enum):
    DRAFT = "draft"
    QUEUED = "queued"
    SENDING = "sending"
    COMPLETED = "completed"
    FAILED = "failed"


class Broadcast(Base, TimestampMixin):
    __tablename__ = "broadcasts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    created_by: Mapped[int] = mapped_column(BigInteger, nullable=False)

    content_type: Mapped[BroadcastContentType] = mapped_column(
        Enum(BroadcastContentType, name="broadcast_content_type", native_enum=True), nullable=False
    )
    text: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Inline-кнопки: [{"text": "...", "url": "..."} , ...] построчно.
    buttons: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    status: Mapped[BroadcastStatus] = mapped_column(
        Enum(BroadcastStatus, name="broadcast_status", native_enum=True),
        default=BroadcastStatus.DRAFT,
        nullable=False,
    )

    target_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sent_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    failed_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Broadcast id={self.id} status={self.status.value} sent={self.sent_count}>"
