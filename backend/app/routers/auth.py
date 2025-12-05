"""
Authentication Router
Handles all authentication-related API endpoints including:
- Org-admin signup
- User signin/signout
- User invitation (by org-admin)
- Token refresh
- Password reset
- Org-admin approval (by super-admin)
"""

import time

from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.logger import log_warning, log_info

security = HTTPBearer()

from app.core.exceptions import (
    AuthenticationError,
    AuthorizationError,
    BadRequestError,
    ConflictError,
    NotFoundError,
)
from app.middleware.auth import (
    get_current_active_user,
    get_current_user_allow_pending,
    require_org_admin,
    require_super_admin,
)
from app.models.organization import (
    ApproveOrgAdminRequest,
    OrganizationSetup,
    OrganizationSetupResponse,
)
from app.models.user import (
    PasswordReset,
    PasswordUpdate,
    RefreshTokenRequest,
    TokenResponse,
    UserInvite,
    UserResponse,
    UserSignIn,
    UserSignUp,
    UserWithOrganization,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/signup", status_code=201)
async def signup_org_admin(signup_data: UserSignUp):
    """
    Sign up as an organization admin (Step 1).

    This endpoint allows a new user to register with basic information.
    After signup, user receives tokens and verification email.

    **Process:**
    1. User signs up with email, password, user_name, and phone_number
    2. Account is created with status='pending' and no organization
    3. User receives access token and verification email
    4. User verifies email via link
    5. User proceeds to organization setup to select a plan

    **No authentication required.**
    """
    try:
        # Create user without organization
        from app.core.supabase_client import get_admin_client

        admin_client = get_admin_client()

        # Check if user already exists
        try:
            admin_response = admin_client.auth.admin.list_users()
            existing_users = [u for u in admin_response if u.email == signup_data.email]
            if existing_users:
                raise ConflictError(f"User with email {signup_data.email} already exists")
        except Exception:
            pass

        # Create user in Supabase Auth with auto-confirm
        auth_response = admin_client.auth.admin.create_user(
            {
                "email": signup_data.email,
                "password": signup_data.password,
                "email_confirm": True,  # Auto-confirm to allow immediate login
                "user_metadata": {
                    "user_name": signup_data.user_name,
                    "role": "org-admin",
                    "status": "pending",
                    "phone_number": signup_data.phone_number,
                },
            }
        )

        if not auth_response or not auth_response.user:
            raise BadRequestError("Failed to create user in authentication system")

        auth_user_id = auth_response.user.id

        # Wait for the trigger to create the user in public.users table
        # The trigger runs asynchronously, so we need to retry a few times
        user_response = None
        max_retries = 10
        retry_delay = 0.3  # seconds

        for attempt in range(max_retries):
            try:
                # Query with maybe_single() to avoid error if no rows found
                response = (
                    admin_client.table("users")
                    .select("*")
                    .eq("auth_user_id", auth_user_id)
                    .execute()
                )

                if response.data and len(response.data) > 0:
                    user_response = response
                    break
                else:
                    # No data yet, wait and retry
                    if attempt < max_retries - 1:
                        time.sleep(retry_delay)
            except Exception as e:
                # Log the error but continue retrying
                log_warning(f"Attempt {attempt + 1} failed: {str(e)}")
                if attempt < max_retries - 1:
                    time.sleep(retry_delay)

        # If trigger didn't create the user, create it manually as fallback
        if not user_response or not user_response.data or len(user_response.data) == 0:
            log_info("Trigger didn't create user, creating manually as fallback")
            try:
                # Manually create user in public.users table
                insert_response = (
                    admin_client.table("users")
                    .insert(
                        {
                            "auth_user_id": auth_user_id,
                            "email": signup_data.email,
                            "user_name": signup_data.user_name,
                            "role": "org-admin",
                            "status": "pending",
                            "phone_number": signup_data.phone_number,
                            "is_verified": True,
                        }
                    )
                    .execute()
                )

                if insert_response.data and len(insert_response.data) > 0:
                    user_response = insert_response
                else:
                    # Clean up the auth user if profile creation failed
                    try:
                        admin_client.auth.admin.delete_user(auth_user_id)
                    except:
                        pass
                    raise BadRequestError("Failed to create user profile in database")
            except Exception as e:
                # Clean up the auth user if profile creation failed
                try:
                    admin_client.auth.admin.delete_user(auth_user_id)
                except:
                    pass
                raise BadRequestError(f"Failed to create user profile: {str(e)}")

        # Get the first user from the response
        user_data = user_response.data[0]

        # Update user with phone_number if provided (trigger doesn't handle this)
        if signup_data.phone_number:
            try:
                update_response = (
                    admin_client.table("users")
                    .update({"phone_number": signup_data.phone_number})
                    .eq("auth_user_id", auth_user_id)
                    .execute()
                )

                if update_response.data and len(update_response.data) > 0:
                    user_data = update_response.data[0]
            except Exception as e:
                log_warning(f"Failed to update phone number: {str(e)}")

        # Sign in the user to get tokens
        from app.core.supabase_client import get_client

        client = get_client()
        try:
            signin_response = client.auth.sign_in_with_password(
                {"email": signup_data.email, "password": signup_data.password}
            )

            if not signin_response or not signin_response.session:
                raise BadRequestError("Failed to generate authentication tokens")

            # Send verification email (optional - for user to verify later)
            try:
                admin_client.auth.admin.generate_link(
                    {
                        "type": "magiclink",
                        "email": signup_data.email,
                    }
                )
            except Exception as e:
                log_warning(f"Failed to send verification email: {str(e)}")

            return {
                "message": "Signup successful. Please complete organization setup.",
                "user_id": user_data["id"],
                "auth_user_id": auth_user_id,
                "email": signup_data.email,
                "status": "pending",
                "access_token": signin_response.session.access_token,
                "refresh_token": signin_response.session.refresh_token,
                "token_type": "bearer",
                "expires_in": signin_response.session.expires_in or 3600,
            }
        except Exception as e:
            # If sign-in fails, still return success but without tokens
            # User can login manually
            log_warning(f"Auto sign-in failed: {str(e)}")
            return {
                "message": "Signup successful. Please login to continue.",
                "user_id": user_data["id"],
                "auth_user_id": auth_user_id,
                "email": signup_data.email,
                "status": "pending",
            }

    except ConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=e.message)
    except BadRequestError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Signup failed: {str(e)}",
        )


@router.post("/organization-setup", response_model=OrganizationSetupResponse, status_code=201)
async def setup_organization(
    setup_data: OrganizationSetup,
    current_user: dict = Depends(get_current_user_allow_pending),
):
    """
    Complete organization setup and select a plan (Step 2).

    After signing up, the org-admin must complete this step to create
    their organization and select a subscription plan. The request will
    be pending until a super-admin approves it.

    **Process:**
    1. Org-admin enters organization details and selects a plan
    2. Organization is created and linked to the user
    3. User status remains 'pending' awaiting super-admin approval
    4. Once approved, user can access the org-admin dashboard

    **Requires authentication.**
    """
    try:
        # Verify user is an org-admin without an organization
        if current_user["role"] != "org-admin":
            raise AuthorizationError("Only org-admin users can setup organizations")

        if current_user["organization_id"] is not None:
            raise BadRequestError("User already has an organization")

        from app.core.supabase_client import get_admin_client

        admin_client = get_admin_client()

        # Map plan names to subscription details
        plan_configs = {
            "STARTER": {
                "subscription_plan": "FREE",
                "max_users": 10,
                "max_storage_gb": 1,
            },
            "PRO": {
                "subscription_plan": "BASIC",
                "max_users": 50,
                "max_storage_gb": 10,
            },
            "BUSINESS": {
                "subscription_plan": "PREMIUM",
                "max_users": 200,
                "max_storage_gb": 100,
            },
        }

        plan_config = plan_configs.get(setup_data.selected_plan, plan_configs["STARTER"])

        # Use custom values if provided, otherwise use plan defaults
        max_users = (
            setup_data.max_users if setup_data.max_users is not None else plan_config["max_users"]
        )
        max_storage_gb = (
            setup_data.max_storage_gb
            if setup_data.max_storage_gb is not None
            else plan_config["max_storage_gb"]
        )

        # Create organization
        org_data = {
            "name": setup_data.organization_name,
            "description": setup_data.organization_description,
            "subscription_plan": plan_config["subscription_plan"],
            "subscription_status": "INACTIVE",  # Will be activated upon approval
            "max_users": max_users,
            "max_storage_gb": max_storage_gb,
        }

        org_response = admin_client.table("organizations").insert(org_data).execute()

        if not org_response.data:
            raise BadRequestError("Failed to create organization")

        organization_id = org_response.data[0]["id"]

        # Update user with organization_id and keep status as pending
        user_update = (
            admin_client.table("users")
            .update(
                {
                    "organization_id": organization_id,
                    "status": "pending",
                }
            )
            .eq("id", current_user["id"])
            .execute()
        )

        if not user_update.data:
            # Rollback: delete organization
            admin_client.table("organizations").delete().eq("id", organization_id).execute()
            raise BadRequestError("Failed to update user profile")

        return OrganizationSetupResponse(
            message="Organization setup complete. Awaiting super-admin approval.",
            organization_id=organization_id,
            organization_name=setup_data.organization_name,
            selected_plan=setup_data.selected_plan,
            status="pending",
            max_users=max_users,
            max_storage_gb=max_storage_gb,
        )

    except AuthorizationError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.message)
    except BadRequestError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Organization setup failed: {str(e)}",
        )


@router.post("/signin", response_model=TokenResponse)
async def signin(signin_data: UserSignIn, response: Response):
    """
    Sign in with email and password.

    Authenticates a user and returns access and refresh tokens.
    User must have 'active' status to sign in.

    **Returns:**
    - access_token: JWT token for API authentication
    - refresh_token: Token to refresh the access token
    - user: User profile data

    **No authentication required.**
    """
    try:
        auth_service = AuthService()
        result = await auth_service.signin(
            email=signin_data.email,
            password=signin_data.password,
        )

        # Set refresh token cookie if keep_me_signed_in is True
        if signin_data.keep_me_signed_in and result.get("refresh_token"):
            from app.core.config import settings
            
            response.set_cookie(
                key="refresh_token",
                value=result["refresh_token"],
                httponly=True,
                secure=settings.is_production,  # Only require HTTPS in production
                samesite="lax",
                max_age=30 * 24 * 60 * 60,  # 30 days
            )

        return TokenResponse(
            access_token=result["access_token"],
            refresh_token=result["refresh_token"],
            token_type=result["token_type"],
            expires_in=result["expires_in"],
            user=UserResponse(**result["user"]),
        )
    except AuthenticationError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Signin failed: {str(e)}",
        )


@router.post("/signout")
async def signout(current_user: dict = Depends(get_current_active_user)):
    """
    Sign out the current user.

    Invalidates the current session/token.

    **Requires authentication.**
    """
    try:
        auth_service = AuthService()
        # Extract token from current context (would need to be passed differently in production)
        await auth_service.signout("")

        # Clear cookie on signout
        response = Response(content='{"message": "Signed out successfully"}', media_type="application/json")
        response.delete_cookie("refresh_token")
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Signout failed: {str(e)}",
        )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    refresh_data: RefreshTokenRequest,
    request: Request,
    response: Response,
):
    """
    Refresh access token using refresh token.

    When the access token expires, use this endpoint to get a new one
    without requiring the user to sign in again.

    **No authentication required** (uses refresh token instead).
    """
    try:
        # Check for refresh token in body first, then cookie
        token_to_use = refresh_data.refresh_token
        using_cookie = False

        if not token_to_use or token_to_use == "cookie":
            cookie_token = request.cookies.get("refresh_token")
            if cookie_token:
                token_to_use = cookie_token
                using_cookie = True
            elif not token_to_use:
                 raise AuthenticationError("Refresh token is required")

        auth_service = AuthService()
        result = await auth_service.refresh_token(token_to_use)

        # If we used a cookie or if we want to maintain the session, update the cookie
        # This implements the sliding window (resets 30 days on every refresh)
        if using_cookie and result.get("refresh_token"):
            from app.core.config import settings
            
            response.set_cookie(
                key="refresh_token",
                value=result["refresh_token"],
                httponly=True,
                secure=settings.is_production,  # Only require HTTPS in production
                samesite="lax",
                max_age=30 * 24 * 60 * 60,  # 30 days
            )

        # Get user data for response
        from app.core.supabase_client import get_admin_client, verify_user_token

        auth_user = await verify_user_token(result["access_token"])
        admin_client = get_admin_client()
        user_response = (
            admin_client.table("users")
            .select("*")
            .eq("auth_user_id", auth_user["id"])
            .single()
            .execute()
        )

        return TokenResponse(
            access_token=result["access_token"],
            refresh_token=result["refresh_token"],
            token_type=result["token_type"],
            expires_in=result["expires_in"],
            user=UserResponse(**user_response.data),
        )
    except AuthenticationError as e:
        # If refresh fails and we were using a cookie, clear it
        response.delete_cookie("refresh_token")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Token refresh failed: {str(e)}",
        )


@router.post("/invite-user", status_code=201)
async def invite_user(
    invite_data: UserInvite,
    current_user: dict = Depends(require_org_admin),
):
    """
    Invite a user to join the organization (org-admin only).

    Creates a new user account and sends them a magic link via email.
    The user can click the link to set their password and access the platform.

    **Process:**
    1. Org-admin enters user details
    2. User account is created with status='active'
    3. Magic link is generated and sent to user's email
    4. User clicks link, sets password, and can login

    **Requires org-admin authentication.**
    """
    try:
        auth_service = AuthService()
        result = await auth_service.invite_user(
            email=invite_data.email,
            user_name=invite_data.user_name,
            organization_id=current_user["organization_id"],
            inviter_id=current_user["id"],
            job_title=invite_data.job_title,
            phone_number=invite_data.phone_number,
        )

        return {
            "message": result["message"],
            "user_id": result["user_id"],
            "email": result["email"],
            "magic_link": result.get("magic_link"),
        }
    except ConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=e.message)
    except AuthorizationError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.message)
    except BadRequestError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"User invitation failed: {str(e)}",
        )


@router.post("/approve-org-admin")
async def approve_org_admin(
    approval_data: ApproveOrgAdminRequest,
    current_user: dict = Depends(require_super_admin),
):
    """
    Approve an org-admin registration request (super-admin only).

    Activates a pending org-admin account and configures their organization's
    subscription settings.

    **Process:**
    1. Super-admin reviews pending org-admin registrations
    2. Super-admin approves with subscription settings
    3. User status changes to 'active'
    4. User receives approval notification
    5. User can now sign in and use the platform

    **Requires super-admin authentication.**
    """
    try:
        auth_service = AuthService()

        if approval_data.approved:
            result = await auth_service.approve_org_admin(
                user_id=approval_data.user_id,
                approver_id=current_user["id"],
                subscription_plan=approval_data.subscription_plan or "FREE",
                max_users=approval_data.max_users or 10,
                max_storage_gb=approval_data.max_storage_gb or 1,
            )
        else:
            result = await auth_service.reject_org_admin(
                user_id=approval_data.user_id,
                approver_id=current_user["id"],
            )

        return result
    except AuthorizationError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.message)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except BadRequestError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Approval failed: {str(e)}",
        )


@router.post("/password-reset-request")
async def password_reset_request(reset_data: PasswordReset):
    """
    Request a password reset link.

    Sends a password reset link to the user's email if the account exists.
    For security, always returns success even if email doesn't exist.

    **No authentication required.**
    """
    try:
        auth_service = AuthService()
        result = await auth_service.reset_password_request(reset_data.email)
        return result
    except Exception as e:
        # Always return success for security
        return {"message": "If email exists, password reset link will be sent"}


@router.post("/update-password")
async def update_password(
    password_data: PasswordUpdate,
    current_user: dict = Depends(get_current_active_user),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """
    Update user password.

    Allows authenticated users to change their password.
    Requires current password for verification.

    **Requires authentication.**
    """
    try:
        # First verify current password by attempting signin
        # Only if user is verified (meaning they should have a password)
        # If not verified (e.g. magic link invite), allow setting password without current
        if current_user.get("is_verified", True):
            if not password_data.current_password:
                 raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Current password is required",
                )
            
            auth_service = AuthService()
            await auth_service.signin(
                email=current_user["email"],
                password=password_data.current_password,
            )

        # Update password
        token = credentials.credentials
        auth_service = AuthService()
        result = await auth_service.update_password(token, password_data.new_password)

        return result
    except AuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Password update failed: {str(e)}",
        )


@router.get("/me", response_model=UserWithOrganization)
async def get_current_user_info(current_user: dict = Depends(get_current_active_user)):
    """
    Get current user information.

    Returns the profile data of the currently authenticated user.

    **Requires authentication.**
    """
    user_data = dict(current_user)
    
    # Fetch organization name if user belongs to one
    if user_data.get("organization_id"):
        try:
            from app.core.supabase_client import get_admin_client
            
            admin_client = get_admin_client()
            org_response = (
                admin_client.table("organizations")
                .select("name")
                .eq("id", user_data["organization_id"])
                .single()
                .execute()
            )
            
            if org_response.data:
                user_data["organization_name"] = org_response.data["name"]
        except Exception as e:
            log_warning(f"Failed to fetch organization name: {str(e)}")
            
    return UserWithOrganization(**user_data)


@router.get("/pending-org-admins", response_model=list[UserResponse])
async def get_pending_org_admins(current_user: dict = Depends(require_super_admin)):
    """
    Get list of pending org-admin registrations (super-admin only).

    Returns all users with role='org-admin' and status='pending' for review.

    **Requires super-admin authentication.**
    """
    try:
        from app.core.supabase_client import get_admin_client

        admin_client = get_admin_client()
        response = (
            admin_client.table("users")
            .select("*")
            .eq("role", "org-admin")
            .eq("status", "pending")
            .order("created_at", desc=True)
            .execute()
        )

        return [UserResponse(**user) for user in response.data]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch pending org-admins: {str(e)}",
        )


@router.get("/stats", response_model=dict)
async def get_system_stats(current_user: dict = Depends(require_super_admin)):
    """
    Get system statistics (super-admin only).
    """
    try:
        from app.core.supabase_client import get_admin_client
        admin_client = get_admin_client()
        
        # Get total users count
        response = (
            admin_client.table("users")
            .select("id", count="exact", head=True)
            .neq("role", "super-admin")
            .execute()
        )
        
        return {
            "total_users": response.count or 0
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch stats: {str(e)}",
        )
