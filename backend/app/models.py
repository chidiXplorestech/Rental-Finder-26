import enum
import uuid
from datetime import datetime
from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint, Uuid, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class ListingStatus(str, enum.Enum):
    ACTIVE = "active"
    LET_AGREED = "let_agreed"
    REMOVED = "removed"
    EXPIRED = "expired"
    UNKNOWN = "unknown"


class FloorAreaSource(str, enum.Enum):
    LISTING = "listing"
    FLOORPLAN = "floorplan"
    EPC = "epc"
    MANUAL = "manual"
    UNKNOWN = "unknown"


class Property(Base):
    __tablename__ = "properties"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    canonical_key: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    address_line: Mapped[str] = mapped_column(String(300))
    postcode: Mapped[str] = mapped_column(String(12), index=True)
    postcode_district: Mapped[str] = mapped_column(String(5), index=True)
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    bedrooms: Mapped[int] = mapped_column(Integer, index=True)
    floor_area_sqft: Mapped[float | None] = mapped_column(Float, index=True)
    floor_area_source: Mapped[FloorAreaSource] = mapped_column(Enum(FloorAreaSource), default=FloorAreaSource.UNKNOWN)
    commute_minutes: Mapped[int | None] = mapped_column(Integer, index=True)
    commute_mode: Mapped[str | None] = mapped_column(String(50))
    commute_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    listings: Mapped[list["Listing"]] = relationship(back_populates="property")


class Listing(Base):
    __tablename__ = "listings"
    __table_args__ = (
        UniqueConstraint("source", "source_listing_id", name="uq_source_listing"),
        Index("ix_listing_active_search", "status", "rent_pcm", "archived_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    property_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("properties.id", ondelete="CASCADE"), index=True)
    source: Mapped[str] = mapped_column(String(80), index=True)
    source_listing_id: Mapped[str] = mapped_column(String(160))
    source_url: Mapped[str] = mapped_column(Text)
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(Text, default="")
    rent_pcm: Mapped[int] = mapped_column(Integer, index=True)
    status: Mapped[ListingStatus] = mapped_column(Enum(ListingStatus), default=ListingStatus.ACTIVE, index=True)
    is_pbsa: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    is_student_only: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    is_academic_tenancy: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    status_selector: Mapped[str | None] = mapped_column(String(250))
    status_selector_means: Mapped[str | None] = mapped_column(String(50))
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    raw_payload: Mapped[str | None] = mapped_column(Text)

    property: Mapped[Property] = relationship(back_populates="listings")


class ListingEvent(Base):
    __tablename__ = "listing_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    listing_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), index=True)
    event_type: Mapped[str] = mapped_column(String(80), index=True)
    detail: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
