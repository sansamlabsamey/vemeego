#!/usr/bin/env python3
"""
Setup Validation Script
Checks if all required configuration is in place before running the server.
"""

import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))


def check_env_file():
    """Check if .env file exists."""
    env_path = Path(__file__).parent / ".env"
    if not env_path.exists():
        print("❌ .env file not found!")
        print("   Please create a .env file. You can copy from .env.example")
        print("   Command: cp .env.example .env")
        return False
    print("✅ .env file exists")
    return True


def check_supabase_credentials():
    """Check if Supabase credentials are configured."""
    try:
        from app.core.config import settings

        issues = []

        if not settings.SUPABASE_URL or settings.SUPABASE_URL.startswith("https://your-project"):
            issues.append("SUPABASE_URL")

        if not settings.SUPABASE_ANON_KEY or settings.SUPABASE_ANON_KEY == "your-anon-key-here":
            issues.append("SUPABASE_ANON_KEY")

        if (
            not settings.SUPABASE_SERVICE_ROLE_KEY
            or settings.SUPABASE_SERVICE_ROLE_KEY == "your-service-role-key-here"
        ):
            issues.append("SUPABASE_SERVICE_ROLE_KEY")

        if issues:
            print("⚠️  Supabase credentials not configured properly!")
            print(f"   Missing or invalid: {', '.join(issues)}")
            print("\n   To fix this:")
            print("   1. Go to your Supabase project dashboard (https://supabase.com)")
            print("   2. Click on your project")
            print("   3. Go to Settings → API")
            print("   4. Copy the following values to your .env file:")
            print("      - Project URL → SUPABASE_URL")
            print("      - anon/public key → SUPABASE_ANON_KEY")
            print("      - service_role key → SUPABASE_SERVICE_ROLE_KEY")
            return False

        print("✅ Supabase credentials configured")
        return True

    except Exception as e:
        print(f"❌ Error checking Supabase credentials: {e}")
        return False


def check_database_url():
    """Check if DATABASE_URL is configured."""
    try:
        from app.core.config import settings

        if not settings.DATABASE_URL or settings.DATABASE_URL.startswith(
            "postgresql://postgres:[YOUR_PASSWORD]"
        ):
            print("⚠️  DATABASE_URL not configured!")
            print("   Please update DATABASE_URL in your .env file")
            print("   Get it from: Supabase Dashboard → Settings → Database → Connection string")
            return False

        print("✅ DATABASE_URL configured")
        return True

    except Exception as e:
        print(f"❌ Error checking DATABASE_URL: {e}")
        return False


def check_migrations():
    """Check if database migrations have been run."""
    print("\nℹ️  Database Migration Check:")
    print("   Have you run the database migration?")
    print("   Command: psql $DATABASE_URL -f migrations/001_initial_schema.sql")
    print("   Or using Supabase CLI: supabase db push")
    return None  # Can't automatically verify


def check_super_admin():
    """Check if super admin has been created."""
    print("\nℹ️  Super Admin Check:")
    print("   Have you created a super-admin user?")
    print("   Command: python scripts/create_super_admin.py")
    return None  # Can't automatically verify


def main():
    """Run all checks."""
    print("=" * 60)
    print("🔍 Vemeego Backend Setup Validation")
    print("=" * 60)
    print()

    checks_passed = True

    # Check .env file
    if not check_env_file():
        checks_passed = False
        print()

    # Check Supabase credentials
    if not check_supabase_credentials():
        checks_passed = False
        print()

    # Check DATABASE_URL
    if not check_database_url():
        checks_passed = False
        print()

    # Info checks (can't verify automatically)
    check_migrations()
    print()
    check_super_admin()

    print()
    print("=" * 60)

    if checks_passed:
        print("✅ All automated checks passed!")
        print()
        print("Next steps:")
        print("1. Ensure database migrations are applied")
        print("2. Create a super-admin user if not already done")
        print("3. Start the server: uv run fastapi dev")
        print()
        print("Once running, visit:")
        print("  - API Docs: http://localhost:8000/docs")
        print("  - Health Check: http://localhost:8000/health")
    else:
        print("❌ Some checks failed!")
        print("   Please fix the issues above before starting the server.")

    print("=" * 60)

    return 0 if checks_passed else 1


if __name__ == "__main__":
    sys.exit(main())
