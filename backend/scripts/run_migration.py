#!/usr/bin/env python3
"""
Database Migration Runner
Runs SQL migration files against the Supabase PostgreSQL database.
"""

import os
import sys
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    import psycopg2
    from psycopg2 import sql
    from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
except ImportError:
    print("❌ Error: psycopg2 is not installed!")
    print("   Please install it by running: uv add psycopg2-binary")
    sys.exit(1)

from dotenv import load_dotenv


def get_database_url():
    """Get DATABASE_URL from environment."""
    # Load environment variables
    env_path = Path(__file__).parent.parent / ".env"
    load_dotenv(env_path)

    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        print("❌ Error: DATABASE_URL not found in environment!")
        print("   Please ensure your .env file contains DATABASE_URL")
        sys.exit(1)

    return database_url


def test_connection(database_url):
    """Test database connection."""
    try:
        print("🔍 Testing database connection...")
        conn = psycopg2.connect(database_url)
        cur = conn.cursor()
        cur.execute("SELECT version();")
        version = cur.fetchone()[0]
        print(f"✅ Connected successfully!")
        print(f"   PostgreSQL version: {version.split(',')[0]}")
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False


def get_migration_files():
    """Get all migration files in order."""
    migrations_dir = Path(__file__).parent.parent / "migrations"

    if not migrations_dir.exists():
        print(f"❌ Error: Migrations directory not found: {migrations_dir}")
        sys.exit(1)

    # Get all .sql files
    sql_files = sorted(migrations_dir.glob("*.sql"))

    if not sql_files:
        print(f"❌ Error: No migration files found in {migrations_dir}")
        sys.exit(1)

    return sql_files


def check_migration_table(conn):
    """Check if migration tracking table exists, create if not."""
    try:
        cur = conn.cursor()

        # Create migrations table if it doesn't exist
        cur.execute("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) UNIQUE NOT NULL,
                executed_at TIMESTAMP DEFAULT NOW(),
                checksum VARCHAR(64)
            );
        """)

        conn.commit()
        cur.close()
        return True
    except Exception as e:
        print(f"❌ Error creating migrations table: {e}")
        return False


def is_migration_applied(conn, filename):
    """Check if a migration has already been applied."""
    try:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM schema_migrations WHERE filename = %s", (filename,))
        count = cur.fetchone()[0]
        cur.close()
        return count > 0
    except Exception as e:
        print(f"⚠️  Warning: Could not check migration status: {e}")
        return False


def record_migration(conn, filename):
    """Record that a migration has been applied."""
    try:
        cur = conn.cursor()
        cur.execute("INSERT INTO schema_migrations (filename) VALUES (%s)", (filename,))
        conn.commit()
        cur.close()
        return True
    except Exception as e:
        print(f"⚠️  Warning: Could not record migration: {e}")
        return False


def run_migration(conn, migration_file):
    """Run a single migration file."""
    filename = migration_file.name

    # Check if already applied
    if is_migration_applied(conn, filename):
        print(f"⏭️  Skipping {filename} (already applied)")
        return True

    print(f"\n📝 Running migration: {filename}")
    print("=" * 60)

    try:
        # Read migration file
        sql_content = migration_file.read_text()

        # Get line count for progress
        line_count = len(sql_content.split("\n"))
        print(f"   Lines: {line_count}")

        # Execute migration as a single statement
        # This properly handles PostgreSQL dollar-quoted strings ($$)
        cur = conn.cursor()

        print("   Executing...", end=" ", flush=True)

        try:
            # Execute the entire migration file at once
            cur.execute(sql_content)
            print("Done!")
        except Exception as e:
            # Show error details
            print(f"\n❌ Error executing migration:")
            print(f"   {str(e)}")
            raise e

        # Commit transaction
        conn.commit()
        cur.close()

        # Record migration
        record_migration(conn, filename)

        print(f"✅ Migration {filename} completed successfully!")
        return True

    except Exception as e:
        print(f"\n❌ Error running migration {filename}:")
        print(f"   {str(e)}")
        conn.rollback()
        return False


def list_applied_migrations(conn):
    """List all applied migrations."""
    try:
        cur = conn.cursor()
        cur.execute("SELECT filename, executed_at FROM schema_migrations ORDER BY executed_at")
        migrations = cur.fetchall()
        cur.close()

        if migrations:
            print("\n📋 Applied Migrations:")
            print("=" * 60)
            for filename, executed_at in migrations:
                print(f"   ✅ {filename} - {executed_at}")
        else:
            print("\n📋 No migrations applied yet")

    except Exception as e:
        print(f"⚠️  Could not list migrations: {e}")


def main():
    """Main migration runner."""
    print("=" * 60)
    print("🗄️  Database Migration Runner")
    print("=" * 60)
    print()

    # Get database URL
    database_url = get_database_url()
    print(f"📍 Database: {database_url.split('@')[1] if '@' in database_url else 'configured'}")
    print()

    # Test connection
    if not test_connection(database_url):
        print("\n❌ Cannot proceed without database connection")
        sys.exit(1)

    print()

    # Get migration files
    migration_files = get_migration_files()
    print(f"📂 Found {len(migration_files)} migration file(s)")
    for f in migration_files:
        print(f"   - {f.name}")
    print()

    # Confirm
    response = input("🚀 Do you want to run these migrations? (yes/no): ").strip().lower()
    if response not in ["yes", "y"]:
        print("❌ Migration cancelled by user")
        sys.exit(0)

    print()

    # Connect to database
    try:
        conn = psycopg2.connect(database_url)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)

        # Create migration tracking table
        print("🔧 Setting up migration tracking...")
        if not check_migration_table(conn):
            print("❌ Failed to set up migration tracking")
            sys.exit(1)
        print("✅ Migration tracking ready")

        # Run migrations
        success_count = 0
        failed_count = 0

        for migration_file in migration_files:
            if run_migration(conn, migration_file):
                success_count += 1
            else:
                failed_count += 1
                print("\n⚠️  Migration failed. Stopping here to prevent data issues.")
                break

        # List applied migrations
        list_applied_migrations(conn)

        # Summary
        print()
        print("=" * 60)
        print("📊 Migration Summary")
        print("=" * 60)
        print(f"   ✅ Successful: {success_count}")
        print(f"   ❌ Failed: {failed_count}")
        print(f"   ⏭️  Skipped: {len(migration_files) - success_count - failed_count}")
        print("=" * 60)

        if failed_count == 0:
            print("\n🎉 All migrations completed successfully!")
            print("\nNext steps:")
            print("1. Verify tables in Supabase Dashboard → Table Editor")
            print("2. Create super-admin: python scripts/create_super_admin.py")
            print("3. Start server: uv run fastapi dev")
        else:
            print("\n⚠️  Some migrations failed. Please check the errors above.")
            sys.exit(1)

        conn.close()

    except Exception as e:
        print(f"\n❌ Database error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n❌ Migration cancelled by user (Ctrl+C)")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)
