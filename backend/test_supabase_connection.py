"""
Quick script to test Supabase database connection and verify DATABASE_URL format.
"""

import os
import sys
from urllib.parse import urlparse

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from app.core.config import settings
    
    print("=" * 60)
    print("DATABASE_URL Configuration Test")
    print("=" * 60)
    
    # Get the DATABASE_URL
    db_url = str(settings.DATABASE_URL)
    
    # Parse the URL (hide password)
    parsed = urlparse(db_url)
    
    print(f"\n[OK] DATABASE_URL loaded successfully")
    print(f"\nURL Format Check:")
    print(f"  Scheme: {parsed.scheme}")
    print(f"  Username: {parsed.username}")
    print(f"  Password: {'*' * len(parsed.password) if parsed.password else 'NOT SET'}")
    print(f"  Hostname: {parsed.hostname}")
    print(f"  Port: {parsed.port}")
    print(f"  Database: {parsed.path.lstrip('/')}")
    
    # Check if it's using asyncpg
    if "asyncpg" in parsed.scheme:
        print(f"\n[OK] Using asyncpg driver (correct for application)")
    else:
        print(f"\n[WARN] Warning: Not using asyncpg driver")
        print(f"  Expected: postgresql+asyncpg://")
        print(f"  Got: {parsed.scheme}://")
    
    # Check hostname
    if parsed.hostname:
        print(f"\n[OK] Hostname found: {parsed.hostname}")
        
        # Try to resolve hostname
        import socket
        try:
            ip = socket.gethostbyname(parsed.hostname)
            print(f"[OK] Hostname resolves to: {ip}")
        except socket.gaierror as e:
            print(f"\n[ERROR] Cannot resolve hostname '{parsed.hostname}'")
            print(f"   Error: {e}")
            print(f"\n   Common issues:")
            print(f"   1. Hostname has a typo")
            print(f"   2. Missing brackets around password if it contains special chars")
            print(f"   3. Using wrong connection string (use Connection Pooling string)")
            print(f"   4. Network connectivity issue")
    else:
        print(f"\n[ERROR] No hostname found in DATABASE_URL")
    
    # Common Supabase format check
    if parsed.hostname and "supabase.co" in parsed.hostname:
        print(f"\n[OK] Detected Supabase hostname")
    elif parsed.hostname:
        print(f"\n[WARN] Hostname doesn't look like Supabase ({parsed.hostname})")
    
    print(f"\n" + "=" * 60)
    print(f"\nFull URL (password hidden):")
    safe_url = db_url
    if parsed.password:
        safe_url = db_url.replace(parsed.password, "*" * len(parsed.password))
    print(f"  {safe_url}")
    print(f"\n" + "=" * 60)
    
except Exception as e:
    print(f"\n[ERROR] ERROR loading configuration: {e}")
    print(f"\nMake sure:")
    print(f"  1. You're in the backend/ directory")
    print(f"  2. .env file exists and has DATABASE_URL set")
    print(f"  3. All dependencies are installed (pip install -r requirements.txt)")
    sys.exit(1)

