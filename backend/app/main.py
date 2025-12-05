"""
Vemeego Backend Application
Main FastAPI application with authentication, CORS, and error handling.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.exceptions import AppException
from app.core.logger import log_startup, log_info
from app.routers import auth, messaging, organizations, storage, meetings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Handles startup and shutdown events.
    """
    # Startup
    log_startup(f"🚀 Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    log_startup(f"   Environment: {settings.ENVIRONMENT}")

    # Validate Supabase configuration
    if not settings.SUPABASE_URL or settings.SUPABASE_URL.startswith("https://your-project"):
        log_info("\n⚠️  WARNING: Supabase credentials not configured!")
        log_info("   Please update your .env file with actual Supabase credentials:")
        log_info("   1. Go to your Supabase project dashboard")
        log_info("   2. Click Settings -> API")
        log_info("   3. Copy the following:")
        log_info("      - Project URL -> SUPABASE_URL")
        log_info("      - anon/public key -> SUPABASE_ANON_KEY")
        log_info("      - service_role key -> SUPABASE_SERVICE_ROLE_KEY")
        log_info("\n   The API will not work until these are set correctly.\n")
    else:
        log_info(f"   Supabase URL: {settings.SUPABASE_URL}")

    yield
    # Shutdown
    log_startup(f"👋 Shutting down {settings.APP_NAME}")


# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Vemeego Backend API with Supabase Authentication",
    docs_url="/docs" if settings.is_development else None,
    redoc_url="/redoc" if settings.is_development else None,
    lifespan=lifespan,
)


# ============================================================================
# CORS Configuration
# ============================================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# Exception Handlers
# ============================================================================


@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    """Handle custom application exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.message,
            "details": exc.details,
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle FastAPI HTTP exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
        },
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle all other exceptions."""
    if settings.is_development:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "Internal server error",
                "details": str(exc),
            },
        )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal server error",
        },
    )


# ============================================================================
# Routes
# ============================================================================


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint - API health check."""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "environment": settings.ENVIRONMENT,
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
    }


@app.get("/health/db", tags=["Health"])
async def database_health_check():
    """Database health check - verifies Supabase connection and table access."""
    try:
        from app.core.supabase_client import get_admin_client
        
        admin_client = get_admin_client()
        
        # Test access to meetings table
        response = admin_client.table("meetings").select("id").limit(1).execute()
        
        return {
            "status": "healthy",
            "supabase_url": settings.SUPABASE_URL,
            "meetings_table": {
                "accessible": True,
                "row_count": len(response.data) if response.data else 0,
            },
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "supabase_url": settings.SUPABASE_URL,
        }


# ============================================================================
# Include Routers
# ============================================================================

app.include_router(auth.router)
# Include organizations router
app.include_router(organizations.router)
# Include messaging router
app.include_router(messaging.router)
app.include_router(storage.router)
app.include_router(meetings.router)


# ============================================================================
# Additional Configuration
# ============================================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=settings.API_RELOAD,
    )
