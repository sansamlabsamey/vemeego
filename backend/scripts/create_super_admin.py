#!/usr/bin/env python3
"""
Super Admin Creation Script

This script creates a super-admin user in the system using Supabase Auth.
Super-admins have full access to the platform and can approve org-admin registrations.

Usage:
    python scripts/create_super_admin.py

The script will read credentials from a JSON file or prompt for input.
"""

import json
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


def load_super_admin_config():
    """
    Load super-admin configuration from JSON file.

    Expected JSON format:
    {
        "email": "admin@example.com",
        "password": "SecurePass123",
        "user_name": "Super Administrator"
    }
    """
    config_path = Path(__file__).parent / "super_admin_config.json"

    if config_path.exists():
        print(f"📁 Loading configuration from {config_path}")
        with open(config_path, "r") as f:
            config = json.load(f)
        return config
    else:
        print("⚠️  Configuration file not found. Please provide details manually.")
        return None


def prompt_for_details():
    """Prompt user to enter super-admin details."""
    print("\n" + "=" * 60)
    print("🔐 CREATE SUPER ADMIN USER")
    print("=" * 60)
    print("\nPlease provide the following details:\n")

    email = input("Email: ").strip()
    password = input("Password (min 8 chars, must include uppercase, lowercase, digit): ").strip()
    user_name = input("Full Name: ").strip()

    return {
        "email": email,
        "password": password,
        "user_name": user_name,
    }


def validate_config(config: dict) -> dict:
    """
    Validate super-admin configuration.

    Args:
        config: Dictionary with super-admin details

    Returns:
        dict: Validated configuration

    Raises:
        SystemExit: If configuration is invalid
    """
    # Validate required fields
    if not config.get("email"):
        print("\n❌ Validation Error: Email is required")
        sys.exit(1)

    if not config.get("password"):
        print("\n❌ Validation Error: Password is required")
        sys.exit(1)

    if not config.get("user_name"):
        print("\n❌ Validation Error: User name is required")
        sys.exit(1)

    # Validate password strength
    password = config["password"]
    if len(password) < 8:
        print("\n❌ Validation Error: Password must be at least 8 characters long")
        sys.exit(1)

    if not any(c.isupper() for c in password):
        print("\n❌ Validation Error: Password must contain at least one uppercase letter")
        sys.exit(1)

    if not any(c.islower() for c in password):
        print("\n❌ Validation Error: Password must contain at least one lowercase letter")
        sys.exit(1)

    if not any(c.isdigit() for c in password):
        print("\n❌ Validation Error: Password must contain at least one digit")
        sys.exit(1)

    return config


def create_super_admin(config: dict):
    """
    Create super-admin user using Supabase Admin API.

    Args:
        config: Validated super-admin configuration
    """
    print("\n🚀 Creating super-admin user...\n")

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

        print("🔍 Checking if user already exists...")

        # Check if user exists in auth.users
        try:
            existing_users = supabase.auth.admin.list_users()
            for user in existing_users:
                if user.email == config["email"]:
                    print(
                        f"\n❌ ERROR: User with email '{config['email']}' already exists in auth!"
                    )
                    print("   Cannot create duplicate super-admin.")
                    return False
        except Exception as e:
            print(f"⚠️  Warning: Could not check existing users: {e}")

        # Check if user exists in public.users
        existing_user_response = (
            supabase.table("users").select("id, email").eq("email", config["email"]).execute()
        )

        if existing_user_response.data:
            print(f"\n❌ ERROR: User with email '{config['email']}' already exists in database!")
            print("   Cannot create duplicate super-admin.")
            return False

        print(f"📧 Creating super-admin user in Supabase Auth: {config['email']}")

        # Step 1: Create user in Supabase Auth
        auth_response = supabase.auth.admin.create_user(
            {
                "email": config["email"],
                "password": config["password"],
                "email_confirm": True,  # Auto-confirm email for super admin
                "user_metadata": {
                    "user_name": config["user_name"],
                    "role": "super-admin",
                },
            }
        )

        if not auth_response or not auth_response.user:
            print("\n❌ ERROR: Failed to create user in Supabase Auth")
            return False

        auth_user_id = auth_response.user.id
        print(f"✅ User created in Supabase Auth (ID: {auth_user_id})")

        # Step 2: Create user record in public.users table
        print("📝 Creating user record in database...")

        user_data = {
            "auth_user_id": auth_user_id,
            "email": config["email"],
            "user_name": config["user_name"],
            "role": "super-admin",
            "status": "active",
            "is_verified": True,
            "organization_id": None,
        }

        db_response = supabase.table("users").insert(user_data).execute()

        if not db_response.data:
            print("\n❌ ERROR: Failed to create user record in database")
            print("   Cleaning up auth user...")
            try:
                supabase.auth.admin.delete_user(auth_user_id)
                print("   ✅ Auth user cleaned up")
            except Exception as e:
                print(f"   ⚠️  Could not clean up auth user: {e}")
            return False

        created_user = db_response.data[0]
        print("✅ User record created in database")

        # Success message
        print("\n" + "=" * 60)
        print("✨ SUCCESS! Super-admin user created successfully!")
        print("=" * 60)
        print(f"\n📋 User Details:")
        print(f"   User ID:       {created_user['id']}")
        print(f"   Auth ID:       {auth_user_id}")
        print(f"   Email:         {created_user['email']}")
        print(f"   Name:          {created_user['user_name']}")
        print(f"   Role:          {created_user['role']}")
        print(f"   Status:        {created_user['status']}")
        print(f"\n🎉 You can now login with:")
        print(f"   Email:    {config['email']}")
        print(f"   Password: [the password you provided]")
        print("\n" + "=" * 60)

        return True

    except Exception as e:
        print(f"\n❌ ERROR: Failed to create super-admin user")
        print(f"   Error details: {str(e)}")
        print(f"   Error type: {type(e).__name__}")
        print("\n   Please check your Supabase credentials and try again.")
        return False


def main():
    """Main function to run the super-admin creation script."""
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

    print("\n🎯 Super Admin Creation Script")
    print(f"   Supabase URL: {supabase_url}")

    # Load or prompt for configuration
    config_data = load_super_admin_config()

    if not config_data:
        config_data = prompt_for_details()

    # Validate configuration
    config = validate_config(config_data)

    # Confirm before creating
    print("\n" + "=" * 60)
    print("📝 Configuration Summary:")
    print("=" * 60)
    print(f"   Email:     {config['email']}")
    print(f"   Name:      {config['user_name']}")
    print(f"   Role:      super-admin")
    print(f"   Status:    active")
    print("=" * 60)

    confirm = (
        input("\n⚠️  Do you want to proceed with creating this super-admin? (yes/no): ")
        .strip()
        .lower()
    )

    if confirm not in ["yes", "y"]:
        print("\n❌ Operation cancelled by user.")
        sys.exit(0)

    # Create super-admin
    try:
        success = create_super_admin(config)

        if success:
            print("\n✅ Super-admin creation completed successfully!")
            sys.exit(0)
        else:
            print("\n❌ Super-admin creation failed!")
            sys.exit(1)

    except KeyboardInterrupt:
        print("\n\n❌ Operation cancelled by user (Ctrl+C)")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
