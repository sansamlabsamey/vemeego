# Authentication & Authorization Implementation Guide

## Overview
This document provides a comprehensive guide for implementing authentication and authorization using Supabase Auth in the FastAPI backend. The system supports email/password authentication, MFA, RBAC (Role-Based Access Control) with three roles, and prepares for future SSO integration.

## Table of Contents
1. [Architecture](#architecture)
2. [User Roles](#user-roles)
3. [Supabase Auth Setup](#supabase-auth-setup)
4. [Backend Implementation](#backend-implementation)
5. [JWT Management](#jwt-management)
6. [MFA Implementation](#mfa-implementation)
7. [RBAC Implementation](#rbac-implementation)
8. [SSO Preparation](#sso-preparation)
9. [Security Best Practices](#security-best-practices)
10. [API Endpoints](#api-endpoints)

---

## Architecture

### Authentication Flow
```
Frontend → FastAPI Backend → Supabase Auth → Database
                ↓
           JWT Validation
                ↓
           Role Extraction
                ↓
           Authorization Check
                ↓
           Business Logic
```

### Key Principles
1. **Backend-Only Auth**: Frontend never directly calls Supabase Auth
2. **JWT Validation**: Every protected endpoint validates JWT using `supabase.auth.get_user()`
3. **Custom Claims**: User roles stored in JWT custom claims
4. **RLS Integration**: Database-level authorization via Row Level Security
5. **Secure Tokens**: Service role key never exposed to frontend

---

## User Roles

### Role Hierarchy
```
super-admin (Highest privileges)
    ↓
org-admin (Organization-level management)
    ↓
user (Basic user access)
```

### Role Definitions

#### 1. super-admin
**Capabilities:**
- Full system access
- Manage all organizations
- Manage all users across organizations
- System configuration
- View all analytics and logs
- Bypass most restrictions

**Use Cases:**
- Platform administrators
- Technical support staff
- System maintenance

#### 2. org-admin
**Capabilities:**
- Manage their organization
- Invite/remove users in their organization
- Manage organization settings
- View organization analytics
- Create/manage meetings for organization
- Cannot access other organizations

**Use Cases:**
- Company administrators
- Team leaders
- Department heads

#### 3. user
**Capabilities:**
- Join meetings
- Send messages
- Upload files (within limits)
- View own profile
- Participate in conferences
- Limited to their organization scope

**Use Cases:**
- Regular meeting participants
- End users
- Employees/members

### Default Role
- New users default to `user` role
- Role elevation requires admin approval
- Role changes logged for audit

---

## Supabase Auth Setup

### 1. Project Configuration

#### Enable Auth Providers
In Supabase Dashboard → Authentication → Providers:
```yaml
Email: Enabled
  - Confirm email: true
  - Secure email change: true
  - Email OTP: false (use password)

Phone: Optional (for future SMS MFA)

OAuth Providers (for future SSO):
  - Google: Configure later
  - Microsoft: Configure later
  - GitHub: Configure later
```

#### Auth Settings
```yaml
Site URL: https://yourdomain.com
Redirect URLs:
  - http://localhost:3000/*
  - https://yourdomain.com/*
  
JWT Expiry: 3600 (1 hour)
Refresh Token Expiry: 2592000 (30 days)

Email Templates:
  - Customize confirmation email
  - Customize password reset email
  - Add company branding
```

### 2. Database Preparation

#### User Metadata Table
Create a custom users table in the public schema to store additional user data:

```sql
-- Custom users table
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('super-admin', 'org-admin', 'user')),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    avatar_url TEXT,
    phone TEXT,
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    last_sign_in_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_organization ON public.users(organization_id);
CREATE INDEX idx_users_role ON public.users(role);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- RLS Policies (see section below)
```

#### Organizations Table
```sql
CREATE TABLE public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    logo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_organizations_slug ON public.organizations(slug);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
```

#### Trigger to Sync Auth User with Custom User
```sql
-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, email_verified)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.email_confirmed_at IS NOT NULL
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Function to update user metadata
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.users
    SET 
        email_verified = NEW.email_confirmed_at IS NOT NULL,
        last_sign_in_at = NEW.last_sign_in_at,
        updated_at = NOW()
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for updates
CREATE TRIGGER on_auth_user_updated
    AFTER UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_user_update();
```

### 3. Custom Claims Setup

#### Function to Get User Claims
```sql
-- Function to retrieve user role and organization
CREATE OR REPLACE FUNCTION public.get_user_claims(user_id UUID)
RETURNS JSON AS $$
DECLARE
    user_claims JSON;
BEGIN
    SELECT json_build_object(
        'role', u.role,
        'organization_id', u.organization_id,
        'email_verified', u.email_verified,
        'is_active', u.is_active
    )
    INTO user_claims
    FROM public.users u
    WHERE u.id = user_id;
    
    RETURN user_claims;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Backend Implementation

### 1. Supabase Client Initialization

**File: `app/core/supabase.py`**

```python
from supabase import create_client, Client
from supabase.lib.client_options import ClientOptions
from app.config import settings
from functools import lru_cache

@lru_cache()
def get_supabase_client() -> Client:
    """
    Create Supabase client with anon key for standard operations.
    Used for operations that respect RLS policies.
    """
    return create_client(
        supabase_url=settings.SUPABASE_URL,
        supabase_key=settings.SUPABASE_ANON_KEY,
        options=ClientOptions(
            auto_refresh_token=True,
            persist_session=False,  # Server-side, no persistence needed
        )
    )

@lru_cache()
def get_supabase_admin_client() -> Client:
    """
    Create Supabase admin client with service role key.
    ONLY use for admin operations that need to bypass RLS.
    NEVER expose this client or its methods to frontend.
    """
    return create_client(
        supabase_url=settings.SUPABASE_URL,
        supabase_key=settings.SUPABASE_SERVICE_ROLE_KEY,
        options=ClientOptions(
            auto_refresh_token=False,
            persist_session=False,
        )
    )

# Usage
supabase = get_supabase_client()
supabase_admin = get_supabase_admin_client()
```

### 2. Configuration

**File: `app/config.py`**

```python
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    # Supabase
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str  # Keep secret!
    
    # FastAPI
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    API_RELOAD: bool = True
    
    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]
    
    # JWT
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Application
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
```

### 3. JWT Validation & User Extraction

**File: `app/core/security.py`**

```python
from fastapi import HTTPException, status, Depends, Header
from typing import Optional, Dict, Any
from app.core.supabase import supabase, supabase_admin
from gotrue.errors import AuthApiError
import logging

logger = logging.getLogger(__name__)

class AuthenticationError(HTTPException):
    def __init__(self, detail: str = "Could not validate credentials"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )

class AuthorizationError(HTTPException):
    def __init__(self, detail: str = "Not enough permissions"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
        )

async def get_current_user(
    authorization: Optional[str] = Header(None)
) -> Dict[str, Any]:
    """
    Extract and validate JWT token from Authorization header.
    Returns user data with custom claims.
    
    IMPORTANT: Uses supabase.auth.get_user() which validates token
    against Supabase Auth server. Never use get_session() server-side!
    """
    if not authorization:
        raise AuthenticationError("Missing authorization header")
    
    # Extract Bearer token
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise AuthenticationError("Invalid authentication scheme")
    except ValueError:
        raise AuthenticationError("Invalid authorization header format")
    
    # Validate token with Supabase
    try:
        # This makes a request to Supabase to validate the JWT
        response = await supabase.auth.get_user(token)
        
        if not response or not response.user:
            raise AuthenticationError("Invalid or expired token")
        
        user = response.user
        
        # Get custom claims (role, organization) from database
        user_data = await get_user_with_claims(user.id)
        
        return user_data
        
    except AuthApiError as e:
        logger.error(f"Auth API error: {e}")
        raise AuthenticationError("Token validation failed")
    except Exception as e:
        logger.error(f"Unexpected error during authentication: {e}")
        raise AuthenticationError()

async def get_user_with_claims(user_id: str) -> Dict[str, Any]:
    """
    Fetch user data including custom claims from database.
    """
    try:
        response = supabase.table("users").select(
            "id, email, full_name, role, organization_id, "
            "is_active, email_verified, avatar_url"
        ).eq("id", user_id).single().execute()
        
        if not response.data:
            raise AuthenticationError("User not found")
        
        user_data = response.data
        
        # Check if user is active
        if not user_data.get("is_active"):
            raise AuthenticationError("User account is inactive")
        
        return user_data
        
    except Exception as e:
        logger.error(f"Error fetching user claims: {e}")
        raise AuthenticationError("Failed to load user data")

async def get_current_active_user(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Dependency that ensures user is active.
    """
    if not current_user.get("is_active"):
        raise AuthenticationError("User account is inactive")
    return current_user

async def verify_email_verified(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Dependency that ensures email is verified.
    """
    if not current_user.get("email_verified"):
        raise AuthenticationError("Email not verified")
    return current_user
```

### 4. Role-Based Authorization Decorators

**File: `app/core/security.py` (continued)**

```python
from typing import List
from functools import wraps

def require_roles(allowed_roles: List[str]):
    """
    Decorator to restrict endpoint access based on user roles.
    
    Usage:
        @router.get("/admin")
        @require_roles(["super-admin", "org-admin"])
        async def admin_endpoint(current_user: dict = Depends(get_current_user)):
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract current_user from kwargs
            current_user = kwargs.get('current_user')
            if not current_user:
                raise AuthorizationError("User context not found")
            
            user_role = current_user.get('role')
            if user_role not in allowed_roles:
                raise AuthorizationError(
                    f"This action requires one of these roles: {', '.join(allowed_roles)}"
                )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator

def require_super_admin(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Dependency that ensures user is super-admin.
    """
    if current_user.get("role") != "super-admin":
        raise AuthorizationError("Super admin access required")
    return current_user

def require_org_admin(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Dependency that ensures user is org-admin or super-admin.
    """
    if current_user.get("role") not in ["super-admin", "org-admin"]:
        raise AuthorizationError("Organization admin access required")
    return current_user

async def verify_organization_access(
    organization_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> bool:
    """
    Verify user has access to specific organization.
    Super-admins can access all organizations.
    """
    if current_user.get("role") == "super-admin":
        return True
    
    if current_user.get("organization_id") != organization_id:
        raise AuthorizationError("Access denied to this organization")
    
    return True
```

---

## JWT Management

### Token Lifecycle

#### 1. Token Generation (Handled by Supabase)
```python
# In auth_service.py

async def sign_in(email: str, password: str) -> Dict[str, Any]:
    """
    Authenticate user and return tokens.
    """
    try:
        response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })
        
        if not response.session:
            raise AuthenticationError("Invalid credentials")
        
        # Supabase returns:
        # - access_token: JWT for API authentication
        # - refresh_token: For getting new access tokens
        # - expires_in: Token expiration time
        # - expires_at: Exact expiration timestamp
        
        return {
            "access_token": response.session.access_token,
            "refresh_token": response.session.refresh_token,
            "expires_in": response.session.expires_in,
            "expires_at": response.session.expires_at,
            "token_type": "bearer",
            "user": {
                "id": response.user.id,
                "email": response.user.email,
            }
        }
    except Exception as e:
        logger.error(f"Sign in error: {e}")
        raise AuthenticationError("Authentication failed")
```

#### 2. Token Refresh
```python
async def refresh_token(refresh_token: str) -> Dict[str, Any]:
    """
    Refresh access token using refresh token.
    """
    try:
        response = supabase.auth.refresh_session(refresh_token)
        
        if not response.session:
            raise AuthenticationError("Invalid refresh token")
        
        return {
            "access_token": response.session.access_token,
            "refresh_token": response.session.refresh_token,
            "expires_in": response.session.expires_in,
            "expires_at": response.session.expires_at,
            "token_type": "bearer"
        }
    except Exception as e:
        logger.error(f"Token refresh error: {e}")
        raise AuthenticationError("Token refresh failed")
```

#### 3. Token Validation
```python
async def validate_token(token: str) -> Dict[str, Any]:
    """
    Validate JWT and extract user info.
    This is called automatically by get_current_user dependency.
    """
    try:
        # get_user() sends request to Supabase Auth to validate token
        response = await supabase.auth.get_user(token)
        
        if not response.user:
            return None
        
        return {
            "user_id": response.user.id,
            "email": response.user.email,
            "email_confirmed_at": response.user.email_confirmed_at,
            "last_sign_in_at": response.user.last_sign_in_at
        }
    except:
        return None
```

### JWT Claims Structure

Supabase JWT includes:
```json
{
  "aud": "authenticated",
  "exp": 1234567890,
  "iat": 1234567890,
  "sub": "user-uuid",
  "email": "user@example.com",
  "phone": "",
  "app_metadata": {
    "provider": "email",
    "providers": ["email"]
  },
  "user_metadata": {
    "full_name": "John Doe"
  },
  "role": "authenticated",
  "aal": "aal1",
  "amr": [
    {
      "method": "password",
      "timestamp": 1234567890
    }
  ],
  "session_id": "session-uuid"
}
```

Custom claims stored in database and retrieved via `get_user_with_claims()`.

---

## MFA Implementation

### 1. Enable MFA in Supabase

In Supabase Dashboard → Authentication → Settings:
```yaml
MFA: Enabled
Allowed factors:
  - TOTP (Time-based One-Time Password)
  - Phone (optional, for SMS)
```

### 2. MFA Enrollment Flow

**File: `app/routers/auth.py`**

```python
from fastapi import APIRouter, Depends
from app.core.security import get_current_user
from app.models.auth import MFAEnrollRequest, MFAVerifyRequest

router = APIRouter(prefix="/auth/mfa", tags=["MFA"])

@router.post("/enroll")
async def enroll_mfa(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Enroll user in MFA. Returns QR code and secret for TOTP app.
    
    User flow:
    1. Call this endpoint
    2. Scan QR code with authenticator app (Google Authenticator, Authy, etc.)
    3. Verify with code from app
    """
    try:
        # Enroll TOTP factor
        response = await supabase.auth.mfa.enroll({
            "factor_type": "totp",
            "friendly_name": "Authenticator App"
        })
        
        # Returns QR code data and secret
        return {
            "id": response.id,
            "type": response.type,
            "totp": {
                "qr_code": response.totp.qr_code,  # QR code SVG/image
                "secret": response.totp.secret,     # Secret for manual entry
                "uri": response.totp.uri            # otpauth:// URI
            }
        }
    except Exception as e:
        logger.error(f"MFA enrollment error: {e}")
        raise HTTPException(status_code=400, detail="MFA enrollment failed")

@router.post("/verify-enrollment")
async def verify_mfa_enrollment(
    request: MFAVerifyRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Verify MFA enrollment with code from authenticator app.
    
    Request body:
    {
        "factor_id": "factor-uuid",
        "code": "123456"
    }
    """
    try:
        # Create challenge
        challenge_response = await supabase.auth.mfa.challenge({
            "factor_id": request.factor_id
        })
        
        # Verify code
        verify_response = await supabase.auth.mfa.verify({
            "factor_id": request.factor_id,
            "challenge_id": challenge_response.id,
            "code": request.code
        })
        
        if verify_response:
            return {
                "message": "MFA enabled successfully",
                "access_token": verify_response.access_token,
                "refresh_token": verify_response.refresh_token
            }
        
        raise HTTPException(status_code=400, detail="Invalid code")
        
    except Exception as e:
        logger.error(f"MFA verification error: {e}")
        raise HTTPException(status_code=400, detail="MFA verification failed")

@router.get("/factors")
async def list_mfa_factors(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    List all MFA factors for current user.
    """
    try:
        response = await supabase.auth.mfa.list_factors()
        return {
            "factors": [
                {
                    "id": factor.id,
                    "type": factor.factor_type,
                    "friendly_name": factor.friendly_name,
                    "status": factor.status,
                    "created_at": factor.created_at
                }
                for factor in response.all
            ]
        }
    except Exception as e:
        logger.error(f"Error listing MFA factors: {e}")
        raise HTTPException(status_code=400, detail="Failed to list MFA factors")

@router.delete("/unenroll/{factor_id}")
async def unenroll_mfa(
    factor_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Disable MFA for a specific factor.
    """
    try:
        await supabase.auth.mfa.unenroll({"factor_id": factor_id})
        return {"message": "MFA disabled successfully"}
    except Exception as e:
        logger.error(f"MFA unenroll error: {e}")
        raise HTTPException(status_code=400, detail="MFA disable failed")
```

### 3. MFA Login Flow

```python
@router.post("/signin-with-mfa")
async def signin_with_mfa(email: str, password: str, code: Optional[str] = None):
    """
    Sign in with MFA.
    
    Two-step process:
    1. Sign in with email/password
    2. If MFA enabled, provide TOTP code
    """
    try:
        # Step 1: Initial sign in
        response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })
        
        # Check if MFA is required
        if response.user.factors and len(response.user.factors) > 0:
            if not code:
                return {
                    "mfa_required": True,
                    "message": "MFA code required"
                }
            
            # Step 2: Verify MFA code
            factor_id = response.user.factors[0].id
            
            # Challenge and verify in one step
            mfa_response = await supabase.auth.mfa.challenge_and_verify({
                "factor_id": factor_id,
                "code": code
            })
            
            return {
                "access_token": mfa_response.access_token,
                "refresh_token": mfa_response.refresh_token,
                "expires_in": mfa_response.expires_in,
                "user": {
                    "id": response.user.id,
                    "email": response.user.email
                }
            }
        
        # No MFA required
        return {
            "access_token": response.session.access_token,
            "refresh_token": response.session.refresh_token,
            "expires_in": response.session.expires_in,
            "user": {
                "id": response.user.id,
                "email": response.user.email
            }
        }
        
    except Exception as e:
        logger.error(f"MFA sign in error: {e}")
        raise AuthenticationError("Authentication failed")
```

---

## RBAC Implementation

### 1. Row Level Security Policies

#### Users Table Policies

```sql
-- Super admins can see all users
CREATE POLICY "super_admin_all_users" ON public.users
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role = 'super-admin'
        )
    );

-- Org admins can see users in their organization
CREATE POLICY "org_admin_org_users" ON public.users
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
            AND u.role = 'org-admin'
            AND u.organization_id = users.organization_id
        )
    );

-- Org admins can update users in their organization (except role)
CREATE POLICY "org_admin_update_org_users" ON public.users
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
            AND u.role = 'org-admin'
            AND u.organization_id = users.organization_id
        )
    )
    WITH CHECK (
        -- Cannot change role
        role = (SELECT role FROM public.users WHERE id = users.id)
    );

-- Users can see their own profile
CREATE POLICY "users_own_profile" ON public.users
    FOR SELECT
    USING (auth.uid() = id);

-- Users can update their own profile (limited fields)
CREATE POLICY "users_update_own_profile" ON public.users
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (
        -- Cannot change role, organization, or active status
        role = (SELECT role FROM public.users WHERE id = auth.uid())
        AND organization_id = (SELECT organization_id FROM public.users WHERE id = auth.uid())
        AND is_active = (SELECT is_active FROM public.users WHERE id = auth.uid())
    );
```

#### Organizations Table Policies

```sql
-- Super admins can manage all organizations
CREATE POLICY "super_admin_all_orgs" ON public.organizations
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role = 'super-admin'
        )
    );

-- Org admins can manage their organization
CREATE POLICY "org_admin_own_org" ON public.organizations
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
            AND u.role = 'org-admin'
            AND u.organization_id = organizations.id
        )
    );

-- Users can view their organization
CREATE POLICY "users_view_own_org" ON public.organizations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
            AND u.organization_id = organizations.id
        )
    );
```

### 2. Application-Level Authorization

**File: `app/services/auth_service.py`**

```python
from typing import Dict, Any, Optional
from app.core.supabase import supabase, supabase_admin
from app.core.security import AuthorizationError

class AuthorizationService:
    """
    Service for handling authorization logic.
    """
    
    @staticmethod
    def can_manage_user(current_user: Dict[str, Any], target_user_id: str) -> bool:
        """
        Check if current user can manage target user.
        """
        # Super admins can manage anyone
        if current_user["role"] == "super-admin":
            return True
        
        # Org admins can manage users in their organization
        if current_user["role"] == "org-admin":
            target_user = supabase.table("users").select("organization_id").eq(
                "id", target_user_id
            ).single().execute()
            
            return target_user.data["organization_id"] == current_user["organization_id"]
        
        # Regular users cannot manage others
        return False
    
    @staticmethod
    def can_access_organization(
        current_user: Dict[str, Any], 
        organization_id: str
    ) -> bool:
        """
        Check if user can access organization.
        """
        if current_user["role"] == "super-admin":
            return True
        
        return current_user["organization_id"] == organization_id
    
    @staticmethod
    async def assign_role(
        admin_user: Dict[str, Any],
        target_user_id: str,
        new_role: str
    ) -> bool:
        """
        Assign role to user. Only super-admins can do this.
        """
        if admin_user["role"] != "super-admin":
            raise AuthorizationError("Only super-admins can assign roles")
        
        if new_role not in ["super-admin", "org-admin", "user"]:
            raise ValueError("Invalid role")
        
        try:
            # Use admin client to bypass RLS for role changes
            response = supabase_admin.table("users").update({
                "role": new_role,
                "updated_at": "now()"
            }).eq("id", target_user_id).execute()
            
            return True
        except Exception as e:
            logger.error(f"Error assigning role: {e}")
            return False
```

---

## SSO Preparation

### 1. Configure OAuth Providers (Future)

When ready to add SSO:

#### Google OAuth
```yaml
# In Supabase Dashboard
Provider: Google
Client ID: your-google-client-id
Client Secret: your-google-client-secret
Redirect URL: https://your-project.supabase.co/auth/v1/callback
```

#### Microsoft OAuth (Azure AD)
```yaml
Provider: Azure
Client ID: your-azure-client-id
Client Secret: your-azure-client-secret
Redirect URL: https://your-project.supabase.co/auth/v1/callback
```

### 2. SSO Endpoint Implementation

```python
@router.post("/sso/initiate")
async def initiate_sso(provider: str, redirect_url: Optional[str] = None):
    """
    Initiate SSO flow with OAuth provider.
    
    Providers: google, azure, github
    """
    try:
        response = supabase.auth.sign_in_with_oauth({
            "provider": provider,
            "options": {
                "redirect_to": redirect_url or settings.DEFAULT_REDIRECT_URL
            }
        })
        
        return {
            "url": response.url,  # Redirect user to this URL
            "provider": provider
        }
    except Exception as e:
        logger.error(f"SSO initiation error: {e}")
        raise HTTPException(status_code=400, detail="SSO initiation failed")

@router.post("/sso/callback")
async def sso_callback(code: str, provider: str):
    """
    Handle OAuth callback after user authenticates with provider.
    """
    try:
        # Exchange code for session
        response = supabase.auth.exchange_code_for_session(code)
        
        if not response.session:
            raise AuthenticationError("SSO authentication failed")
        
        # Check if user exists in our system
        user_data = await get_user_with_claims(response.user.id)
        
        return {
            "access_token": response.session.access_token,
            "refresh_token": response.session.refresh_token,
            "expires_in": response.session.expires_in,
            "user": user_data
        }
    except Exception as e:
        logger.error(f"SSO callback error: {e}")
        raise AuthenticationError("SSO authentication failed")

@router.post("/sso/domain")
async def sso_by_domain(domain: str):
    """
    Initiate SSO by email domain.
    Useful for enterprise customers with configured SAML/SSO.
    """
    try:
        response = supabase.auth.sign_in_with_sso({
            "domain": domain
        })
        
        return {
            "url": response.url,
            "domain": domain
        }
    except Exception as e:
        logger.error(f"Domain SSO error: {e}")
        raise HTTPException(status_code=400, detail="Domain SSO failed")
```

### 3. Link External Identity to Existing User

```python
@router.post("/link-identity")
async def link_identity(
    provider: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Link OAuth identity to existing user account.
    Allows users to sign in with multiple methods.
    """
    try:
        response = await supabase.auth.link_identity({
            "provider": provider
        })
        
        return {
            "message": f"{provider} identity linked successfully",
            "url": response.url  # User needs to complete OAuth flow
        }
    except Exception as e:
        logger.error(f"Identity linking error: {e}")
        raise HTTPException(status_code=400, detail="Identity linking failed")
```

---

## Security Best Practices

### 1. Token Security

#### ✅ DO:
- Store tokens in httpOnly cookies (preferred) or secure storage
- Implement token refresh before expiration
- Validate tokens on every protected request
- Use short-lived access tokens (15-60 minutes)
- Use long-lived refresh tokens (7-30 days)
- Implement token revocation
- Log authentication attempts

#### ❌ DON'T:
- Store tokens in localStorage (XSS vulnerable)
- Trust client-provided user data
- Use `get_session()` server-side
- Expose service role key
- Skip token validation
- Use overly long token expiration

### 2. Password Security

```python
# Password requirements
MIN_PASSWORD_LENGTH = 12
REQUIRE_UPPERCASE = True
REQUIRE_LOWERCASE = True
REQUIRE_DIGIT = True
REQUIRE_SPECIAL = True

def validate_password(password: str) -> bool:
    """Validate password strength"""
    if len(password) < MIN_PASSWORD_LENGTH:
        return False
    if REQUIRE_UPPERCASE and not any(c.isupper() for c in password):
        return False
    if REQUIRE_LOWERCASE and not any(c.islower() for c in password):
        return False
    if REQUIRE_DIGIT and not any(c.isdigit() for c in password):
        return False
    if REQUIRE_SPECIAL and not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password):
        return False
    return True
```

### 3. Rate Limiting

```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@router.post("/signin")
@limiter.limit("5/minute")  # 5 attempts per minute
async def signin(request: Request, credentials: SignInRequest):
    """Sign in with rate limiting"""
    # ... implementation
```

### 4. Audit Logging

```python
async def log_auth_event(
    user_id: Optional[str],
    event_type: str,
    success: bool,
    ip_address: str,
    user_agent: str,
    metadata: Optional[Dict] = None
):
    """
    Log authentication events for security audit.
    """
    await supabase.table("auth_audit_log").insert({
        "user_id": user_id,
        "event_type": event_type,  # login, logout, mfa_enroll, password_reset, etc.
        "success": success,
        "ip_address": ip_address,
        "user_agent": user_agent,
        "metadata": metadata,
        "timestamp": "now()"
    }).execute()
```

---

## API Endpoints

### Complete Auth Router

**File: `app/routers/auth.py`**

```python
from fastapi import APIRouter, Depends, Request, HTTPException, status
from app.models.auth import (
    SignUpRequest, SignInRequest, ResetPasswordRequest,
    UpdatePasswordRequest, VerifyEmailRequest
)
from app.core.security import get_current_user, get_current_active_user
from app.services.auth_service import AuthService
from typing import Dict, Any

router = APIRouter(prefix="/auth", tags=["Authentication"])
auth_service = AuthService()

@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(request: SignUpRequest):
    """
    Register new user.
    
    Creates user in Supabase Auth and custom users table.
    Sends verification email.
    """
    return await auth_service.sign_up(
        email=request.email,
        password=request.password,
        full_name=request.full_name,
        organization_id=request.organization_id
    )

@router.post("/signin")
async def signin(request: Request, credentials: SignInRequest):
    """
    Sign in with email and password.
    Returns access token and refresh token.
    """
    return await auth_service.sign_in(
        email=credentials.email,
        password=credentials.password,
        ip_address=request.client.host,
        user_agent=request.headers.get("user-agent")
    )

@router.post("/signout")
async def signout(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Sign out current user.
    Invalidates current session.
    """
    return await auth_service.sign_out()

@router.post("/refresh")
async def refresh(refresh_token: str):
    """
    Refresh access token using refresh token.
    """
    return await auth_service.refresh_token(refresh_token)

@router.post("/verify-email")
async def verify_email(request: VerifyEmailRequest):
    """
    Verify email with token from email.
    """
    return await auth_service.verify_email(request.token)

@router.post("/resend-verification")
async def resend_verification(email: str):
    """
    Resend email verification.
    """
    return await auth_service.resend_verification(email)

@router.post("/forgot-password")
async def forgot_password(email: str):
    """
    Initiate password reset flow.
    Sends reset email.
    """
    return await auth_service.forgot_password(email)

@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """
    Reset password with token from email.
    """
    return await auth_service.reset_password(
        token=request.token,
        new_password=request.new_password
    )

@router.put("/update-password")
async def update_password(
    request: UpdatePasswordRequest,
    current_user: Dict[str, Any] = Depends(get_current_active_user)
):
    """
    Update password for authenticated user.
    """
    return await auth_service.update_password(
        current_password=request.current_password,
        new_password=request.new_password
    )

@router.get("/me")
async def get_current_user_info(
    current_user: Dict[str, Any] = Depends(get_current_active_user)
):
    """
    Get current user information.
    """
    return current_user

@router.put("/me")
async def update_current_user(
    update_data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_active_user)
):
    """
    Update current user profile.
    """
    return await auth_service.update_user_profile(
        user_id=current_user["id"],
        update_data=update_data
    )
```

---

## Testing Checklist

### Authentication Tests
- [ ] User registration
- [ ] Email verification
- [ ] Sign in with valid credentials
- [ ] Sign in with invalid credentials
- [ ] Password reset flow
- [ ] Token refresh
- [ ] Token expiration handling
- [ ] Sign out

### MFA Tests
- [ ] MFA enrollment
- [ ] MFA verification
- [ ] Sign in with MFA
- [ ] MFA unenrollment
- [ ] Multiple MFA factors

### Authorization Tests
- [ ] Super-admin access to all resources
- [ ] Org-admin access to org resources
- [ ] User access to own resources
- [ ] Cross-organization access denial
- [ ] Role-based endpoint access
- [ ] RLS policy enforcement

### Security Tests
- [ ] JWT validation
- [ ] Expired token handling
- [ ] Invalid token handling
- [ ] Rate limiting
- [ ] CSRF protection
- [ ] XSS prevention

---

## Frontend Integration Guide

### 1. API Client Setup

```typescript
// api/authClient.ts
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export const authClient = axios.create({
  baseURL: `${API_BASE_URL}/api/auth`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
authClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token refresh
authClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        const { data } = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
          refresh_token: refreshToken,
        });
        
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
        
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
        return authClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);
```

### 2. Auth Context

```typescript
// contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { authClient } from '../api/authClient';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  organization_id: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signin: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName: string) => Promise<void>;
  signout: () => Promise<void>;
  hasRole: (roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType>(null!);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Load user on mount
    const loadUser = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          const { data } = await authClient.get('/me');
          setUser(data);
        } catch (error) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
        }
      }
      setLoading(false);
    };
    
    loadUser();
  }, []);
  
  const signin = async (email: string, password: string) => {
    const { data } = await authClient.post('/signin', { email, password });
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    setUser(data.user);
  };
  
  const signup = async (email: string, password: string, fullName: string) => {
    await authClient.post('/signup', { 
      email, 
      password, 
      full_name: fullName 
    });
  };
  
  const signout = async () => {
    await authClient.post('/signout');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
  };
  
  const hasRole = (roles: string[]) => {
    return user ? roles.includes(user.role) : false;
  };
  
  return (
    <AuthContext.Provider value={{ user, loading, signin, signup, signout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
```

### 3. Protected Routes

```typescript
// components/ProtectedRoute.tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiredRoles 
}) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  if (requiredRoles && !requiredRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" />;
  }
  
  return <>{children}</>;
};
```

---

## Troubleshooting

### Common Issues

#### 1. "Invalid or expired token"
- Check token expiration
- Implement token refresh
- Verify JWT_SECRET matches

#### 2. "User not found"
- Ensure trigger creates user in public.users table
- Check if auth.users and public.users are in sync

#### 3. "Access denied"
- Verify RLS policies
- Check user role
- Ensure organization_id is set

#### 4. MFA not working
- Verify MFA is enabled in Supabase
- Check TOTP time synchronization
- Ensure factor is enrolled

#### 5. SSO redirect loop
- Check redirect URLs configuration
- Verify callback handler
- Check OAuth credentials

---

## Summary

This implementation provides:
- ✅ Secure authentication with Supabase Auth
- ✅ MFA support with TOTP
- ✅ Three-tier RBAC (super-admin, org-admin, user)
- ✅ JWT-based session management
- ✅ Row Level Security policies
- ✅ SSO preparation for future
- ✅ Comprehensive security measures
- ✅ Frontend integration examples

**Next Steps:**
1. Implement database schema (see `02-DATABASE-SCHEMA.md`)
2. Set up file storage (see `03-FILE-STORAGE.md`)
3. Implement real-time features (see `04-REALTIME-MESSAGING.md`)