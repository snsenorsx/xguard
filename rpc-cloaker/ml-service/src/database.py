import asyncio
from typing import Optional

import asyncpg
import redis.asyncio as redis
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from src.config import settings

# Global database connections
pg_pool: Optional[asyncpg.Pool] = None
redis_client: Optional[redis.Redis] = None
async_engine = None
AsyncSessionLocal = None


async def init_db():
    """Initialize database connections."""
    global pg_pool, redis_client, async_engine, AsyncSessionLocal
    
    # PostgreSQL connection pool
    pg_pool = await asyncpg.create_pool(
        settings.database_url,
        min_size=2,
        max_size=10,
        command_timeout=60
    )
    
    # Redis connection
    redis_client = await redis.from_url(
        settings.redis_url,
        decode_responses=True
    )
    
    # SQLAlchemy async engine
    async_engine = create_async_engine(
        settings.database_url.replace('postgresql://', 'postgresql+asyncpg://'),
        poolclass=NullPool
    )
    
    AsyncSessionLocal = sessionmaker(
        async_engine,
        class_=AsyncSession,
        expire_on_commit=False
    )


async def close_db():
    """Close database connections."""
    global pg_pool, redis_client, async_engine
    
    if pg_pool:
        await pg_pool.close()
    
    if redis_client:
        await redis_client.close()
    
    if async_engine:
        await async_engine.dispose()


async def get_pg_connection():
    """Get PostgreSQL connection from pool."""
    if not pg_pool:
        raise RuntimeError("Database not initialized")
    return await pg_pool.acquire()


async def get_redis():
    """Get Redis client."""
    if not redis_client:
        raise RuntimeError("Redis not initialized")
    return redis_client


async def get_session() -> AsyncSession:
    """Get SQLAlchemy async session."""
    if not AsyncSessionLocal:
        raise RuntimeError("Database not initialized")
    async with AsyncSessionLocal() as session:
        yield session