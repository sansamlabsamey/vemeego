# Vemeego Backend - Complete Setup Guide

This guide will walk you through setting up the Vemeego backend with Supabase authentication from scratch.

## Prerequisites

Before you begin, ensure you have:

- ✅ Python 3.11 or higher
- ✅ A Supabase account ([sign up free](https://supabase.com))
- ✅ Terminal/command line access
- ✅ Text editor (VS Code, Sublime, etc.)

## Step 1: Install uv Package Manager

```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows (PowerShell)
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"

# Verify installation
uv --version
```

## Step 2: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign in or create an account
3. Click "New Project"
4. Fill in:
   - Project name: `vemeego` (or your choice)
   - Database password: **Save this password!** You'll need it later
   - Region: Choose closest to you
5. Wait for project to finish setting up (2-3 minutes)

## Step 3: Get Supabase Credentials

Once your project is ready:

1. In your Supabase dashboard, click on **Settings** (gear icon in sidebar)
2. Click on **API** in the settings menu
3. You'll see a section called "Project API keys"

**Copy these three values** (you'll need them in Step 5):

- **Project URL** - looks like: `https://xxxxxxxxxxxxx.supabase.co`
- **anon public** key - long string starting with `eyJ...`
- **service_role** key - another long string starting with `eyJ...`

4. Now go to **Settings** → **Database**
5. Scroll down to **Connection string** section
6. Click on **URI** tab
7. Copy the connection string (it will have `[YOUR-PASSWORD]` placeholder)

## Step 4: Install Dependencies

```bash
# Navigate to backend directory
cd vemeego/backend

# Install all dependencies
uv sync
```

This will install all required packages including:
- FastAPI
- Supabase Python client
- Pydantic
- Authentication libraries
- And more...

## Step 5: Configure Environment Variables

1. **Copy the example environment file:**

```bash
cp .env.example .env
```

2. **Open the `.env` file in your text editor**

3. **Replace the placeholder values with your Supabase credentials:**

```env
# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Database Configuration
DATABASE_URL=postgresql://postgres:YOUR_DATABASE_PASSWORD@db.your-project-id.supabase.co:5432/postgres
```

**Important Notes:**
- Replace `YOUR_DATABASE_PASSWORD` with the password you set when creating the Supabase project
- The service_role key is **very sensitive** - never commit it to git or share it publicly
- Keep your `.env` file secure and never commit it to version control

4. **The rest of the `.env` file can stay as default values:**

```env
# FastAPI Configuration
API_HOST=0.0.0.0
API_PORT=8000
API_RELOAD=true
ENVIRONMENT=development

# CORS Configuration
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# JWT Configuration
JWT_SECRET=your-jwt-secret-here-change-in-production
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=30

# Application Configuration
LOG_LEVEL=INFO
APP_NAME=Vemeego
APP_VERSION=1.0.0
```

## Step 6: Verify Configuration

Run the setup validation script:

```bash
python check_setup.py
```

This will check if:
- ✅ `.env` file exists
- ✅ Supabase credentials are configured
- ✅ Database URL is set

**Expected output:**
```
============================================================
🔍 Vemeego Backend Setup Validation
============================================================

✅ .env file exists
✅ Supabase credentials configured
✅ DATABASE_URL configured
```

If you see any ❌ errors, fix them before proceeding.

## Step 7: Run Database Migration

The migration will create all necessary database tables, triggers, and security policies.

**Option A: Using psql (Direct Database Connection)**

```bash
# Make sure you're in the backend directory
cd vemeego/backend

# Run the migration
psql $DATABASE_URL -f migrations/001_initial_schema.sql
```

**Option B: Using Supabase CLI**

```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Initialize Supabase in your project
supabase init

# Link to your project
supabase link --project-ref your-project-ref

# Copy the migration content
cp migrations/001_initial_schema.sql supabase/migrations/20240101000000_initial_schema.sql

# Push to Supabase
supabase db push
```

**What this migration creates:**
- ✅ `users` table (extends Supabase auth.users)
- ✅ `organizations` table
- ✅ User roles: super-admin, org-admin, user
- ✅ User statuses: active, pending, suspended, deleted
- ✅ Row Level Security (RLS) policies
- ✅ Database triggers for auto-sync
- ✅ Helper functions for role checking

**Verify migration succeeded:**

Go to your Supabase dashboard → **Table Editor**. You should see:
- `organizations` table
- `users` table

## Step 8: Create Super-Admin User

A super-admin is required to approve org-admin registrations.

1. **Create configuration file:**

```bash
cd vemeego/backend/scripts
cp super_admin_config.json.example super_admin_config.json
```

2. **Edit `super_admin_config.json`:**

```json
{
  "email": "admin@yourdomain.com",
  "password": "YourSecurePassword123!",
  "user_name": "Super Administrator"
}
```

**Password requirements:**
- At least 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one digit

3. **Run the script:**

```bash
cd ..  # Go back to backend directory
python scripts/create_super_admin.py
```

**Expected output:**
```
🎯 Super Admin Creation Script
   Environment: development
   Supabase URL: https://your-project.supabase.co

📁 Loading configuration from scripts/super_admin_config.json

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

4. **Save your credentials!** You'll use these to login.

## Step 9: Start the Backend Server

```bash
# Make sure you're in the backend directory
cd vemeego/backend

# Start the development server
uv run fastapi dev
```

**Expected output:**
```
FastAPI   Starting development server 🚀

    server   Server started at http://127.0.0.1:8000
    server   Documentation at http://127.0.0.1:8000/docs

🚀 Starting Vemeego v1.0.0
   Environment: development
   Supabase URL: https://your-project.supabase.co

INFO   Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

**Warning message (if credentials not set):**
```
⚠️  WARNING: Supabase credentials not configured!
   Please update your .env file with actual Supabase credentials
```

If you see this warning, go back to Step 5 and verify your credentials.

## Step 10: Test the API

### Open API Documentation

Visit http://localhost:8000/docs in your browser

You should see the interactive Swagger UI with all API endpoints.

### Test Health Check

```bash
curl http://localhost:8000/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "environment": "development"
}
```

### Test Super-Admin Login

1. In Swagger UI, find `POST /auth/signin`
2. Click "Try it out"
3. Enter your super-admin credentials:
   ```json
   {
     "email": "admin@yourdomain.com",
     "password": "YourSecurePassword123!"
   }
   ```
4. Click "Execute"

**Expected response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": {
    "id": "uuid-here",
    "email": "admin@yourdomain.com",
    "user_name": "Super Administrator",
    "role": "super-admin",
    "status": "active"
  }
}
```

✅ **Success!** Your backend is now fully operational.

## Step 11: Test Complete User Flows

### Flow 1: Org-Admin Signup (Self-Registration)

1. In Swagger UI, find `POST /auth/signup/org-admin`
2. Click "Try it out"
3. Enter test data:
   ```json
   {
     "email": "orgadmin@testcompany.com",
     "password": "TestPass123",
     "user_name": "Test Org Admin",
     "phone_number": "+1234567890",
     "job_title": "CEO",
     "organization_name": "Test Company",
     "organization_description": "A test organization"
   }
   ```
4. Click "Execute"

**Expected response (201 Created):**
```json
{
  "message": "Signup successful. Please wait for admin approval.",
  "user_id": "uuid",
  "organization_id": "uuid",
  "status": "pending",
  "email": "orgadmin@testcompany.com"
}
```

### Flow 2: Super-Admin Approval

1. **Authorize with Super-Admin token:**
   - Click the "Authorize" button (padlock icon) at the top
   - Enter: `Bearer your-super-admin-access-token`
   - Click "Authorize"

2. **Get pending org-admins:**
   - Find `GET /auth/pending-org-admins`
   - Click "Try it out" → "Execute"
   - You should see the org-admin you just created

3. **Approve the org-admin:**
   - Find `POST /auth/approve-org-admin`
   - Click "Try it out"
   - Enter:
     ```json
     {
       "user_id": "uuid-from-pending-list",
       "approved": true,
       "subscription_plan": "FREE",
       "max_users": 10,
       "max_storage_gb": 1
     }
     ```
   - Click "Execute"

**Expected response (200 OK):**
```json
{
  "user_id": "uuid",
  "status": "active",
  "message": "Org-admin approved successfully"
}
```

### Flow 3: Org-Admin Login

1. Find `POST /auth/signin`
2. Enter the org-admin credentials:
   ```json
   {
     "email": "orgadmin@testcompany.com",
     "password": "TestPass123"
   }
   ```
3. Click "Execute"

**Expected response (200 OK):**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": {
    "id": "uuid",
    "email": "orgadmin@testcompany.com",
    "role": "org-admin",
    "status": "active",
    "organization_id": "uuid"
  }
}
```

### Flow 4: User Invitation (by Org-Admin)

1. **Authorize with Org-Admin token:**
   - Click "Authorize" button
   - Enter: `Bearer org-admin-access-token`

2. **Invite a user:**
   - Find `POST /auth/invite-user`
   - Click "Try it out"
   - Enter:
     ```json
     {
       "email": "user@testcompany.com",
       "user_name": "Test User",
       "job_title": "Developer",
       "phone_number": "+1234567890"
     }
     ```
   - Click "Execute"

**Expected response (201 Created):**
```json
{
  "message": "User invited successfully. Magic link sent to email.",
  "user_id": "uuid",
  "email": "user@testcompany.com"
}
```

**Note:** In a real scenario, the user would receive an email with a magic link to set their password and login.

## Troubleshooting

### Issue: "Import error: No module named 'gotrue'"

**Solution:**
```bash
uv add gotrue
```

### Issue: "Field required: DATABASE_URL"

**Solution:**
- Check that `.env` file exists in the backend directory
- Verify DATABASE_URL is set in `.env`
- Make sure there are no typos in variable names

### Issue: "Connection refused" to database

**Solution:**
- Verify your Supabase project is active
- Check DATABASE_URL has the correct password
- Test connection: `psql $DATABASE_URL -c "SELECT 1;"`

### Issue: "Invalid Supabase credentials"

**Solution:**
- Go to Supabase Dashboard → Settings → API
- Copy the correct keys
- Replace in `.env` file
- Restart the server

### Issue: Super-admin script fails with "User already exists"

**Solution:**
```bash
# Check existing users in Supabase Dashboard → Authentication → Users
# Delete the existing user if needed, then run script again
```

### Issue: "Your account is pending approval" when logging in

**Solution:**
- This is expected for org-admins after signup
- Login as super-admin
- Use `POST /auth/approve-org-admin` to approve
- Then org-admin can login

### Issue: CORS errors in frontend

**Solution:**
- Add your frontend URL to `CORS_ORIGINS` in `.env`
- Example: `CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:4200`
- Restart the backend server

### Issue: Magic link not working for invited users

**Solution:**
- Check email delivery in Supabase Dashboard → Authentication → Email Templates
- Ensure Email Auth is enabled: Authentication → Providers → Email
- Check spam folder
- Verify magic link hasn't expired (default: 24 hours)

## Production Deployment Checklist

Before deploying to production:

- [ ] Change `JWT_SECRET` to a secure random string
- [ ] Update `CORS_ORIGINS` to only include production domains
- [ ] Set `ENVIRONMENT=production` in .env
- [ ] Use strong passwords for all admin accounts
- [ ] Enable database backups in Supabase
- [ ] Set up monitoring and error tracking
- [ ] Configure rate limiting
- [ ] Review and test all RLS policies
- [ ] Enable SSL/HTTPS
- [ ] Rotate service_role key regularly
- [ ] Set up proper logging
- [ ] Test disaster recovery procedures

## Next Steps

Now that your backend is running:

1. **Build the Frontend:**
   - Connect to the API endpoints
   - Implement login/signup forms
   - Add protected routes
   - Handle token storage securely

2. **Customize Email Templates:**
   - Go to Supabase Dashboard → Authentication → Email Templates
   - Customize the magic link email
   - Add your branding

3. **Add More Features:**
   - User profile management
   - Organization settings
   - Meeting management
   - File uploads
   - Real-time features

4. **Read Full Documentation:**
   - `AUTH_IMPLEMENTATION.md` - Detailed auth guide
   - `QUICK_START.md` - Quick reference
   - API Docs at `/docs` - Interactive API documentation

## Useful Commands

```bash
# Start development server
uv run fastapi dev

# Start production server
uv run fastapi run app/main.py --host 0.0.0.0 --port 8000

# Install new package
uv add package-name

# Update dependencies
uv sync

# Run setup validation
python check_setup.py

# Create super-admin
python scripts/create_super_admin.py

# Run database migration
psql $DATABASE_URL -f migrations/001_initial_schema.sql
```

## Resources

- **Supabase Documentation:** https://supabase.com/docs
- **FastAPI Documentation:** https://fastapi.tiangolo.com
- **Supabase Python Client:** https://github.com/supabase-community/supabase-py
- **API Documentation:** http://localhost:8000/docs (when server is running)

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review the logs in your terminal
3. Check Supabase Dashboard → Logs for database errors
4. Verify all environment variables are set correctly
5. Ensure migrations were applied successfully

---

**Congratulations! 🎉** Your Vemeego backend is now fully set up and running.