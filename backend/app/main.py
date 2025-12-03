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
from app.routers import auth, messaging, organizations, storage


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Handles startup and shutdown events.
    """
    # Startup
    print(f"🚀 Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    print(f"   Environment: {settings.ENVIRONMENT}")

    # Validate Supabase configuration
    if not settings.SUPABASE_URL or settings.SUPABASE_URL.startswith("https://your-project"):
        print("\n⚠️  WARNING: Supabase credentials not configured!")
        print("   Please update your .env file with actual Supabase credentials:")
        print("   1. Go to your Supabase project dashboard")
        print("   2. Click Settings -> API")
        print("   3. Copy the following:")
        print("      - Project URL -> SUPABASE_URL")
        print("      - anon/public key -> SUPABASE_ANON_KEY")
        print("      - service_role key -> SUPABASE_SERVICE_ROLE_KEY")
        print("\n   The API will not work until these are set correctly.\n")
    else:
        print(f"   Supabase URL: {settings.SUPABASE_URL}")

    yield
    # Shutdown
    print(f"👋 Shutting down {settings.APP_NAME}")


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


# ============================================================================
# Include Routers
# ============================================================================

app.include_router(auth.router)
# Include organizations router
app.include_router(organizations.router)
# Include messaging router
app.include_router(messaging.router)
app.include_router(storage.router)


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
