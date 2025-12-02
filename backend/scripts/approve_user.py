import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

def approve_user(email):
    load_dotenv()
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_key:
        print("Error: Missing Supabase credentials")
        return

    supabase = create_client(supabase_url, supabase_key)

    # Get user
    response = supabase.table("users").select("*").eq("email", email).execute()
    if not response.data:
        print(f"User {email} not found")
        return

    user = response.data[0]
    print(f"Found user: {user['id']} (Status: {user['status']})")

    # Update user status
    supabase.table("users").update({"status": "active"}).eq("id", user['id']).execute()
    print("User status updated to active")

    # Update organization status if exists
    if user.get("organization_id"):
        supabase.table("organizations").update({
            "subscription_status": "ACTIVE",
            "subscription_plan": "FREE" # Ensure plan is set
        }).eq("id", user['organization_id']).execute()
        print(f"Organization {user['organization_id']} updated to ACTIVE")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python approve_user.py <email>")
    else:
        approve_user(sys.argv[1])
