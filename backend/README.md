
# Vemeego Backend

## Quick Start

### 1. Initialize and Install Dependencies

```bash
# Initialize uv project
uv init --python=3.11

# Install FastAPI with extras
uv add fastapi --extra standard

# Install all project dependencies
uv sync
```

### 2. Setup Database

```bash
# Run setup check
uv run check_setup.py

# Run database migration
uv run scripts/run_migration.py
```

### 3. Create Super Admin

```bash
# Create super admin user (REQUIRED for first-time setup)
uv run scripts/create_super_admin.py
```

**⚠️ IMPORTANT**: If you previously created a super admin and are getting 401 errors when logging in, see [QUICK_FIX.md](./QUICK_FIX.md) for the solution.

### 4. Run Backend Server

```bash
uv run fastapi dev

```

The API will be available at `http://localhost:8000`

## Common Issues

### Super Admin Creation Error (401 on Login)

If you created a super admin but get 401 Unauthorized errors:

**Quick Fix:**
```bash
# 1. Clean up the incorrect user
uv run scripts/cleanup_super_admin.py

# 2. Create super admin correctly
uv run scripts/create_super_admin.py
```

See [FIX_SUPER_ADMIN.md](./FIX_SUPER_ADMIN.md) for detailed explanation.

## Documentation

- **[AUTH_IMPLEMENTATION.md](./AUTH_IMPLEMENTATION.md)** - Complete authentication guide
- **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** - Detailed setup instructions
- **[FIX_SUPER_ADMIN.md](./FIX_SUPER_ADMIN.md)** - Fix super admin creation issues
- **[QUICK_FIX.md](./QUICK_FIX.md)** - Quick commands for common issues

## Environment Variables

Create a `.env` file in the backend directory:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database
DATABASE_URL=postgresql://user:password@host:port/database

# JWT Configuration
JWT_SECRET=your-jwt-secret
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

Get Supabase credentials from: **Supabase Dashboard → Settings → API**

## Deployment

### Docker Deployment

```dockerfile
FROM python:3.11-slim

# Install uv.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy the application into the container.
COPY . /app

# Install the application dependencies.
WORKDIR /app
RUN uv sync --frozen --no-cache

# Run the application.
CMD ["/app/.venv/bin/fastapi", "run", "app/main.py", "--port", "80", "--host", "0.0.0.0"]
```

Build and run:
```bash
docker build -t vemeego-backend .
docker run -p 8000:80 vemeego-backend
```

## API Endpoints

Once running, access:
- **API Documentation**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`
- **Health Check**: `http://localhost:8000/health`

## Testing

```bash
# Run tests (if configured)
uv run pytest

# Check code quality
uv run ruff check .
uv run mypy .
```

## Support

For issues:
1. Check the documentation files listed above
2. Verify environment variables are set correctly
3. Ensure database is accessible
4. Check backend logs for error details