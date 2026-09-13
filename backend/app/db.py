from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import Session, sessionmaker

from .config import get_settings

settings = get_settings()


if settings.database_url.startswith("sqlite://"):
    # Dependency-light local development path. It intentionally uses the
    # synchronous stdlib sqlite3 driver behind an async-shaped shim so the same
    # service layer can boot in environments without aiosqlite/PostgreSQL.
    _sync_engine = create_engine(settings.database_url, future=True)
    _SyncSession = sessionmaker(_sync_engine, expire_on_commit=False, class_=Session)

    class _ConnectionShim:
        def __init__(self, context):
            self._context = context
            self._connection = None

        async def __aenter__(self):
            self._connection = self._context.__enter__()
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return self._context.__exit__(exc_type, exc, tb)

        async def run_sync(self, fn):
            return fn(self._connection)

    class _EngineShim:
        def begin(self):
            return _ConnectionShim(_sync_engine.begin())

    class _SessionShim:
        def __init__(self):
            self._session = _SyncSession()

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            if exc_type is not None:
                self._session.rollback()
            self._session.close()

        async def scalar(self, statement):
            return self._session.scalar(statement)

        async def scalars(self, statement):
            return self._session.scalars(statement)

        async def execute(self, statement):
            return self._session.execute(statement)

        def add(self, instance):
            return self._session.add(instance)

        async def flush(self):
            return self._session.flush()

        async def commit(self):
            return self._session.commit()

        async def rollback(self):
            return self._session.rollback()

    class _SessionFactory:
        def __call__(self):
            return _SessionShim()

    engine = _EngineShim()
    SessionLocal = _SessionFactory()

else:
    engine = create_async_engine(settings.database_url, pool_pre_ping=True)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_session():
    async with SessionLocal() as session:
        yield session
