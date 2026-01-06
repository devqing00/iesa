"""
MongoDB Transaction Helpers

Provides utilities for running multi-document operations atomically.
Ensures data consistency for critical operations.
"""

from motor.motor_asyncio import AsyncIOMotorClientSession
from typing import Callable, Any, Optional
from functools import wraps
import logging

logger = logging.getLogger("iesa_backend")


async def run_in_transaction(
    client,
    callback: Callable,
    *args,
    max_retries: int = 3,
    **kwargs
) -> Any:
    """
    Run a callback function within a MongoDB transaction.
    
    Automatically handles retries for transient errors.
    
    Args:
        client: MongoDB client (from get_database_client())
        callback: Async function to run in transaction
        max_retries: Number of retry attempts for transient errors
        *args, **kwargs: Arguments to pass to callback
        
    Returns:
        Result from callback function
        
    Example:
        async def transfer_payment(session):
            await db.payments.update_one(...)
            await db.transactions.insert_one(...)
            
        result = await run_in_transaction(client, transfer_payment)
    """
    
    for attempt in range(max_retries):
        async with await client.start_session() as session:
            try:
                async with session.start_transaction():
                    result = await callback(session, *args, **kwargs)
                    await session.commit_transaction()
                    return result
                    
            except Exception as e:
                await session.abort_transaction()
                
                # Check if this is a transient error we can retry
                error_labels = getattr(e, "error_labels", [])
                if "TransientTransactionError" in error_labels and attempt < max_retries - 1:
                    logger.warning(f"Transaction attempt {attempt + 1} failed with transient error, retrying...")
                    continue
                    
                # Non-transient error or out of retries
                logger.error(f"Transaction failed: {str(e)}")
                raise


def transactional(max_retries: int = 3):
    """
    Decorator to automatically wrap a function in a MongoDB transaction.
    
    The decorated function must accept 'session' as its first parameter.
    
    Example:
        @transactional()
        async def create_payment_with_transaction(session, payment_data):
            result = await db.payments.insert_one(payment_data, session=session)
            await db.transactions.insert_one({...}, session=session)
            return result
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            from app.db import get_database_client
            client = get_database_client()
            
            async def callback(session):
                return await func(session, *args, **kwargs)
                
            return await run_in_transaction(client, callback, max_retries=max_retries)
            
        return wrapper
    return decorator


# Specific transaction helpers for common operations

async def activate_session_atomically(client, session_id: str):
    """
    Atomically activate a session and deactivate all others.
    
    This prevents race conditions where multiple sessions could be active.
    """
    from bson import ObjectId
    from app.db import get_database
    
    async def _activate(session):
        db = get_database()
        sessions = db["sessions"]
        
        # First, deactivate all sessions
        await sessions.update_many(
            {},
            {"$set": {"isActive": False}},
            session=session
        )
        
        # Then, activate only the target session
        result = await sessions.update_one(
            {"_id": ObjectId(session_id)},
            {"$set": {"isActive": True}},
            session=session
        )
        
        return result.modified_count > 0
    
    return await run_in_transaction(client, _activate)


async def delete_session_with_data(client, session_id: str):
    """
    Atomically delete a session and all its associated data.
    
    Ensures data consistency - either all data is deleted or none.
    """
    from bson import ObjectId
    from app.db import get_database
    from datetime import datetime
    
    async def _delete(session):
        db = get_database()
        
        # Delete session-scoped data
        collections_to_clean = [
            "enrollments",
            "payments", 
            "transactions",
            "roles",
            "grades",
            "events",
            "announcements"
        ]
        
        for collection_name in collections_to_clean:
            result = await db[collection_name].delete_many(
                {"sessionId": session_id},
                session=session
            )
            logger.info(f"Deleted {result.deleted_count} documents from {collection_name}")
        
        # Finally, delete the session itself
        await db["sessions"].delete_one(
            {"_id": ObjectId(session_id)},
            session=session
        )
        
        return True
    
    return await run_in_transaction(client, _delete)


async def create_payment_with_transaction(
    client,
    payment_data: dict,
    transaction_data: Optional[dict] = None
):
    """
    Create a payment and optionally an initial transaction atomically.
    """
    from app.db import get_database
    from datetime import datetime
    
    async def _create(session):
        db = get_database()
        
        # Insert payment
        payment_data["createdAt"] = datetime.utcnow()
        result = await db["payments"].insert_one(payment_data, session=session)
        payment_id = str(result.inserted_id)
        
        # Insert transaction if provided
        if transaction_data:
            transaction_data["paymentId"] = payment_id
            transaction_data["createdAt"] = datetime.utcnow()
            await db["transactions"].insert_one(transaction_data, session=session)
        
        return payment_id
    
    return await run_in_transaction(client, _create)


async def assign_role_atomically(
    client,
    user_id: str,
    session_id: str,
    position: str,
    permissions: list,
    revoke_existing: bool = True
):
    """
    Assign a role to a user, optionally revoking their existing role in the session.
    
    Args:
        revoke_existing: If True, revokes any existing role for this user in the session
    """
    from bson import ObjectId
    from app.db import get_database
    from datetime import datetime
    
    async def _assign(session):
        db = get_database()
        roles = db["roles"]
        
        if revoke_existing:
            # Deactivate any existing roles for this user in this session
            await roles.update_many(
                {
                    "userId": user_id,
                    "sessionId": session_id,
                    "isActive": True
                },
                {"$set": {"isActive": False}},
                session=session
            )
        
        # Create new role
        role_data = {
            "userId": user_id,
            "sessionId": session_id,
            "position": position,
            "permissions": permissions,
            "isActive": True,
            "assignedAt": datetime.utcnow()
        }
        
        result = await roles.insert_one(role_data, session=session)
        return str(result.inserted_id)
    
    return await run_in_transaction(client, _assign)
