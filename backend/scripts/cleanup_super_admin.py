#!/usr/bin/env python3
"""
Super Admin Cleanup Script

This script removes incorrectly created super-admin users from the system.
Use this to clean up users that were created without proper Supabase Auth integration.

Usage:
    python scripts/cleanup_super_admin.py
"""

import os
import sys
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv

try:
    from supabase import Client, create_client
except ImportError:
    print("❌ Error: supabase is not installed!")
    print("   Please install it by running: uv add supabase")
    sys.exit(1)


def cleanup_super_admin(email: str):
    """
    Remove super-admin user from both auth.users and public.users.

    Args:
        email: Email of the super-admin to remove
    """
    print(f"\n🧹 Cleaning up super-admin user: {email}\n")

    # Get Supabase credentials
    load_dotenv()
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_service_key:
        print("❌ ERROR: Missing Supabase credentials!")
        print("   Please ensure your .env file contains:")
        print("   - SUPABASE_URL")
        print("   - SUPABASE_SERVICE_ROLE_KEY")
        return False

    try:
        # Create Supabase client with service role key
        supabase: Client = create_client(supabase_url, supabase_service_key)

        # Step 1: Find user in public.users table
        print("🔍 Searching for user in database...")
        user_response = supabase.table("users").select("*").eq("email", email).execute()

        if not user_response.data:
            print(f"⚠️  No user found with email: {email}")
            return False

        user_data = user_response.data[0]
        user_id = user_data["id"]
        auth_user_id = user_data.get("auth_user_id")

        print(f"✅ Found user in database:")
        print(f"   User ID:     {user_id}")
        print(f"   Auth ID:     {auth_user_id}")
        print(f"   Email:       {user_data['email']}")
        print(f"   Name:        {user_data['user_name']}")
        print(f"   Role:        {user_data['role']}")

        # Step 2: Delete from public.users table
        print("\n🗑️  Deleting user from database...")
        delete_response = supabase.table("users").delete().eq("id", user_id).execute()

        if delete_response.data:
            print("✅ User deleted from public.users table")
        else:
            print("⚠️  Could not delete user from public.users table")

        # Step 3: Delete from auth.users if auth_user_id exists
        if auth_user_id:
            print(f"\n🗑️  Deleting user from Supabase Auth (ID: {auth_user_id})...")
            try:
                supabase.auth.admin.delete_user(auth_user_id)
                print("✅ User deleted from auth.users")
            except Exception as e:
                print(f"⚠️  Could not delete from auth.users: {e}")
        else:
            print("\n⚠️  No auth_user_id found, skipping auth deletion")
            print("   This user was likely created incorrectly without Supabase Auth")

        # Success message
        print("\n" + "=" * 60)
        print("✨ Cleanup completed successfully!")
        print("=" * 60)
        print(f"\nUser '{email}' has been removed from the system.")
        print("\nYou can now run the create_super_admin.py script to create")
        print("a new super-admin with proper Supabase Auth integration.")
        print("=" * 60)

        return True

    except Exception as e:
        print(f"\n❌ ERROR: Failed to clean up super-admin user")
        print(f"   Error details: {str(e)}")
        print(f"   Error type: {type(e).__name__}")
        return False


def main():
    """Main function to run the cleanup script."""
    # Load environment variables
    load_dotenv()

    # Check if required environment variables are set
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_service_key:
        print("\n❌ ERROR: Missing required environment variables!")
        print("   Please ensure your .env file contains:")
        print("   - SUPABASE_URL")
        print("   - SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)

    print("\n🎯 Super Admin Cleanup Script")
    print(f"   Supabase URL: {supabase_url}")

    # Prompt for email
    print("\n" + "=" * 60)
    print("🧹 CLEANUP SUPER ADMIN USER")
    print("=" * 60)
    print("\nThis script will remove a super-admin user from:")
    print("  1. public.users table")
    print("  2. auth.users (if auth_user_id exists)")
    print("\n⚠️  WARNING: This action cannot be undone!")
    print("=" * 60)

    email = input("\nEnter the email of the super-admin to remove: ").strip()

    if not email:
        print("\n❌ Email is required!")
        sys.exit(1)

    # Confirm before deleting
    print(f"\n⚠️  You are about to remove super-admin: {email}")
    confirm = input("Are you sure you want to proceed? (yes/no): ").strip().lower()

    if confirm not in ["yes", "y"]:
        print("\n❌ Operation cancelled by user.")
        sys.exit(0)

    # Perform cleanup
    try:
        success = cleanup_super_admin(email)

        if success:
            print("\n✅ Cleanup completed successfully!")
            sys.exit(0)
        else:
            print("\n❌ Cleanup failed!")
            sys.exit(1)

    except KeyboardInterrupt:
        print("\n\n❌ Operation cancelled by user (Ctrl+C)")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
