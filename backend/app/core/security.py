"""
Security utilities - JWT, password hashing, token generation.
"""

import hashlib
import bcrypt
from datetime import datetime, timedelta, UTC
from typing import Optional
from uuid import UUID

from jose import JWTError, jwt

from app.core.config import settings


def hash_password(password: str) -> str:
    """
    Hash a password using bcrypt.
    
    Bcrypt has a 72-byte limit, so we truncate if necessary.
    
    Args:
        password: Plain text password
        
    Returns:
        Hashed password
    """
    # Bcrypt has a 72-byte limit, truncate if necessary
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]
    
    # Generate salt and hash
    salt = bcrypt.gensalt(rounds=settings.BCRYPT_COST_FACTOR)
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against a hash.
    
    Bcrypt has a 72-byte limit, so we truncate if necessary.
    
    Args:
        plain_password: Plain text password
        hashed_password: Bcrypt hashed password
        
    Returns:
        True if password matches, False otherwise
    """
    try:
        # Bcrypt has a 72-byte limit, truncate if necessary
        password_bytes = plain_password.encode('utf-8')
        if len(password_bytes) > 72:
            password_bytes = password_bytes[:72]
        
        # Verify password
        hashed_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create JWT access token.
    
    Args:
        data: Data to encode in token (user_id, school_id, role, etc.)
        expires_delta: Optional custom expiry time
        
    Returns:
        Encoded JWT token
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.now(UTC) + expires_delta
    else:
        expire = datetime.now(UTC) + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire, "type": "access"})
    
    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM
    )
    
    return encoded_jwt


def create_refresh_token(data: dict, remember_me: bool = False) -> str:
    """
    Create JWT refresh token.
    
    Args:
        data: Data to encode in token
        remember_me: If True, token expires in 30 days, else 24 hours
        
    Returns:
        Encoded JWT refresh token
    """
    to_encode = data.copy()
    
    if remember_me:
        expire = datetime.now(UTC) + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    else:
        expire = datetime.now(UTC) + timedelta(hours=settings.JWT_REFRESH_TOKEN_EXPIRE_HOURS)
    
    to_encode.update({"exp": expire, "type": "refresh"})
    
    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM
    )
    
    return encoded_jwt


def decode_token(token: str) -> dict:
    """
    Decode and verify JWT token.
    
    Args:
        token: JWT token string
        
    Returns:
        Decoded token payload
        
    Raises:
        JWTError: If token is invalid or expired
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except JWTError as e:
        raise JWTError(f"Invalid token: {e}")


def hash_token(token: str) -> str:
    """
    Hash a token (refresh token, setup token, etc.) using SHA256.
    
    This is used for tokens that may be longer than bcrypt's 72-byte limit.
    SHA256 is sufficient for tokens since they're already cryptographically secure.
    
    Args:
        token: Token string to hash
        
    Returns:
        SHA256 hash of the token (hex string)
    """
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


def verify_token(plain_token: str, token_hash: str) -> bool:
    """
    Verify a token against its hash.
    
    Args:
        plain_token: Plain text token
        token_hash: SHA256 hash of the token
        
    Returns:
        True if token matches hash, False otherwise
    """
    computed_hash = hashlib.sha256(plain_token.encode('utf-8')).hexdigest()
    return computed_hash == token_hash


def generate_secure_token() -> str:
    """
    Generate a secure random token for setup/reset.
    
    Returns:
        Secure random token string
    """
    import secrets
    return secrets.token_urlsafe(32)

