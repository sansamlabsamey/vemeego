import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

def update_org_limit(email, limit):
    load_dotenv()
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_key:
        print("Error: Missing Supabase credentials")
        return

    supabase = create_client(supabase_url, supabase_key)

    # Get user to find organization
    response = supabase.table("users").select("organization_id").eq("email", email).execute()
    if not response.data:
        print(f"User {email} not found")
        return

    org_id = response.data[0]['organization_id']
    if not org_id:
        print("User has no organization")
        return

    # Update organization limit
    supabase.table("organizations").update({"max_users": limit}).eq("id", org_id).execute()
    print(f"Organization {org_id} limit updated to {limit}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python update_org_limit.py <email> <limit>")
    else:
        update_org_limit(sys.argv[1], int(sys.argv[2]))
