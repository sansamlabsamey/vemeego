# Backend Scripts

This directory contains utility scripts for managing the Vemeego backend.

## Available Scripts

### 1. `run_migration.py` - Database Migration Runner

Runs SQL migration files against your Supabase PostgreSQL database without requiring the Supabase CLI.

**Usage:**
```bash
# From the backend directory
uv run scripts/run_migration.py
```

**Features:**
- ✅ Automatically tracks applied migrations
- ✅ Prevents re-running the same migration
- ✅ Shows progress and detailed error messages
- ✅ Confirms before running
- ✅ Rolls back on errors

**Example Output:**
```
============================================================
🗄️  Database Migration Runner
============================================================

📍 Database: db.naplkspsvrugqoqqzqzc.supabase.co:5432/postgres

🔍 Testing database connection...
✅ Connected successfully!
   PostgreSQL version: PostgreSQL 15.1

📂 Found 1 migration file(s)
   - 001_initial_schema.sql

🚀 Do you want to run these migrations? (yes/no): yes

🔧 Setting up migration tracking...
✅ Migration tracking ready

📝 Running migration: 001_initial_schema.sql
============================================================
   Lines: 429
   Statements: 87
   Executing... 10... 20... 30... Done!
✅ Migration 001_initial_schema.sql completed successfully!

📋 Applied Migrations:
============================================================
   ✅ 001_initial_schema.sql - 2024-01-01 12:00:00

============================================================
📊 Migration Summary
============================================================
   ✅ Successful: 1
   ❌ Failed: 0
   ⏭️  Skipped: 0
============================================================

🎉 All migrations completed successfully!

Next steps:
1. Verify tables in Supabase Dashboard → Table Editor
2. Create super-admin: python scripts/create_super_admin.py
3. Start server: uv run fastapi dev
```

---

### 2. `create_super_admin.py` - Super Admin Creation

Creates a super-admin user in the system. Super-admins have full access and can approve org-admin registrations.

**Usage:**

**Option A: Using JSON config (recommended)**
```bash
# 1. Create config file
cp scripts/super_admin_config.json.example scripts/super_admin_config.json

# 2. Edit the file with your details
nano scripts/super_admin_config.json

# 3. Run the script
python scripts/create_super_admin.py
```

**Option B: Interactive prompt**
```bash
# Run without config file - will prompt for details
python scripts/create_super_admin.py
```

**Configuration File Format:**
```json
{
  "email": "admin@yourdomain.com",
  "password": "SecurePassword123!",
  "user_name": "Super Administrator"
}
```

**Password Requirements:**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one digit

**Example Output:**
```
🎯 Super Admin Creation Script
   Environment: development
   Supabase URL: https://your-project.supabase.co

📁 Loading configuration from scripts/super_admin_config.json

============================================================
📝 Configuration Summary:
============================================================
   Email:     admin@yourdomain.com
   Name:      Super Administrator
   Role:      super-admin
   Status:    active
============================================================

⚠️  Do you want to proceed with creating this super-admin? (yes/no): yes

🚀 Creating super-admin user...

🔍 Checking if user already exists...
📧 Creating auth user for: admin@yourdomain.com
✅ Auth user created with ID: abc-123-def
👤 Creating user profile...
✅ User profile created

============================================================
✨ SUCCESS! Super-admin user created successfully!
============================================================

📋 User Details:
   User ID:       xyz-789-abc
   Auth User ID:  abc-123-def
   Email:         admin@yourdomain.com
   Name:          Super Administrator
   Role:          super-admin
   Status:        active

🔑 The super-admin can now login with:
   Email:    admin@yourdomain.com
   Password: [as provided]

============================================================
```

**Important Notes:**
- Super-admins are NOT tied to any organization
- Only one super-admin is typically needed per system
- Keep credentials secure - super-admins have full system access
- Cannot be created via API - only through this script

---

## Prerequisites

Before running any scripts, ensure:

1. **Environment variables are set:**
   ```bash
   # Check if .env file exists and is configured
   cat ../.env
   ```

2. **Dependencies are installed:**
   ```bash
   # Install all dependencies
   cd .. && uv sync
   ```

3. **Database is accessible:**
   ```bash
   # Test connection
   psql $DATABASE_URL -c "SELECT 1;"
   ```

---

## Script Execution Order

For initial setup, run scripts in this order:

```bash
# 1. Run database migrations
python scripts/run_migration.py

# 2. Create super-admin user
python scripts/create_super_admin.py

# 3. Start the backend server
cd .. && uv run fastapi dev
```

---

## Troubleshooting

### Issue: "ModuleNotFoundError: No module named 'psycopg2'"

**Solution:**
```bash
cd .. && uv add psycopg2-binary
```

### Issue: "DATABASE_URL not found in environment"

**Solution:**
```bash
# Ensure .env file exists in backend directory
ls -la ../.env

# Check if DATABASE_URL is set
grep DATABASE_URL ../.env
```

### Issue: "Connection refused" when running migration

**Solution:**
- Verify your Supabase project is active
- Check DATABASE_URL has correct password
- Test: `psql $DATABASE_URL -c "SELECT version();"`

### Issue: "User already exists" when creating super-admin

**Solution:**
```bash
# Option 1: Delete from Supabase Dashboard → Authentication → Users
# Option 2: Use a different email address
```

### Issue: Script shows "permission denied"

**Solution:**
```bash
# Make script executable
chmod +x scripts/run_migration.py
chmod +x scripts/create_super_admin.py

# Or run with python explicitly
python scripts/run_migration.py
```

---

## Security Notes

1. **Never commit `super_admin_config.json`** to version control
   - It's already in `.gitignore`
   - Contains sensitive credentials

2. **Rotate super-admin password regularly**
   - Change password through the API: `POST /auth/update-password`

3. **Limit super-admin creation**
   - Only create when absolutely necessary
   - Consider using a separate super-admin for each environment

4. **Keep service role key secure**
   - Never expose `SUPABASE_SERVICE_ROLE_KEY`
   - Only use server-side

---

## Adding New Scripts

When adding new scripts to this directory:

1. Add proper documentation in this README
2. Include error handling and user-friendly messages
3. Use the same code style (emojis for status, clear output)
4. Add to `.gitignore` if script generates sensitive files
5. Test in development environment first

---

## Resources

- **Full Setup Guide:** `../SETUP_GUIDE.md`
- **Auth Documentation:** `../AUTH_IMPLEMENTATION.md`
- **Quick Start:** `../QUICK_START.md`
- **API Docs:** http://localhost:8000/docs (when server is running)