"""
Authentication Service
Handles all authentication-related business logic including:
- User signup (org-admin)
- User signin
- User invitation (by org-admin)
- Token management
- Password management
"""

from datetime import datetime, timedelta
from typing import Any, Dict, Optional
from uuid import UUID

from gotrue.errors import AuthApiError
from pydantic import ValidationError

from app.core.config import settings
from app.core.logger import log_warning
from app.core.exceptions import (
    AuthenticationError,
    AuthorizationError,
    BadRequestError,
    ConflictError,
    NotFoundError,
)
from app.core.supabase_client import get_admin_client, get_client
from app.models.user import UserRole, UserStatus


class AuthService:
    """Service class for authentication operations."""

    def __init__(self):
        self.client = get_client()
        self.admin_client = get_admin_client()

    async def signup_org_admin(
        self,
        email: str,
        password: str,
        user_name: str,
        organization_name: str,
        phone_number: Optional[str] = None,
        job_title: Optional[str] = None,
        organization_description: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Sign up a new org-admin user with organization.
        User will be in 'pending' status until approved by super-admin.

        Args:
            email: User email
            password: User password
            user_name: User's full name
            organization_name: Organization name
            phone_number: Optional phone number
            job_title: Optional job title
            organization_description: Optional organization description

        Returns:
            Dict with user_id, organization_id, and status

        Raises:
            ConflictError: If email already exists
            BadRequestError: If signup fails
        """
        try:
            # Check if user already exists in auth.users
            try:
                admin_response = self.admin_client.auth.admin.list_users()
                existing_users = [u for u in admin_response if u.email == email]
                if existing_users:
                    raise ConflictError(f"User with email {email} already exists")
            except Exception:
                pass  # Continue if list fails

            # Create user in Supabase Auth with metadata
            auth_response = self.admin_client.auth.admin.create_user(
                {
                    "email": email,
                    "password": password,
                    "email_confirm": False,  # Require email confirmation
                    "user_metadata": {
                        "user_name": user_name,
                        "role": UserRole.ORG_ADMIN,
                        "status": UserStatus.PENDING,
                        "phone_number": phone_number,
                        "job_title": job_title,
                    },
                }
            )

            if not auth_response or not auth_response.user:
                raise BadRequestError("Failed to create user in authentication system")

            auth_user_id = auth_response.user.id

            # Create organization first
            org_data = {
                "name": organization_name,
                "description": organization_description,
                "subscription_plan": "FREE",
                "subscription_status": "ACTIVE",
                "max_users": 10,
                "max_storage_gb": 1,
            }

            org_response = self.admin_client.table("organizations").insert(org_data).execute()

            if not org_response.data:
                # Rollback: delete auth user
                self.admin_client.auth.admin.delete_user(auth_user_id)
                raise BadRequestError("Failed to create organization")

            organization_id = org_response.data[0]["id"]

            # Update user with organization_id and ensure correct status
            user_update = (
                self.admin_client.table("users")
                .update(
                    {
                        "organization_id": organization_id,
                        "status": UserStatus.PENDING,
                        "role": UserRole.ORG_ADMIN,
                    }
                )
                .eq("auth_user_id", auth_user_id)
                .execute()
            )

            if not user_update.data:
                # Rollback: delete org and auth user
                self.admin_client.table("organizations").delete().eq(
                    "id", organization_id
                ).execute()
                self.admin_client.auth.admin.delete_user(auth_user_id)
                raise BadRequestError("Failed to create user profile")

            # Send verification email
            try:
                self.admin_client.auth.admin.generate_link(
                    {
                        "type": "signup",
                        "email": email,
                    }
                )
            except Exception as e:
                log_warning(f"Failed to send verification email: {e}")

            return {
                "user_id": user_update.data[0]["id"],
                "auth_user_id": auth_user_id,
                "organization_id": organization_id,
                "status": UserStatus.PENDING,
                "message": "Signup successful. Please wait for admin approval.",
            }

        except ConflictError:
            raise
        except BadRequestError:
            raise
        except Exception as e:
            raise BadRequestError(f"Signup failed: {str(e)}")

    async def signin(self, email: str, password: str) -> Dict[str, Any]:
        """
        Sign in a user with email and password.

        Args:
            email: User email
            password: User password

        Returns:
            Dict with access_token, refresh_token, user data

        Raises:
            AuthenticationError: If credentials are invalid or user not active
        """
        try:
            # Authenticate with Supabase
            response = self.client.auth.sign_in_with_password(
                {"email": email, "password": password}
            )

            if not response or not response.session or not response.user:
                raise AuthenticationError("Invalid email or password")

            auth_user_id = response.user.id

            # Get user profile from public.users
            user_response = (
                self.admin_client.table("users")
                .select("*")
                .eq("auth_user_id", auth_user_id)
                .single()
                .execute()
            )

            if not user_response.data:
                raise AuthenticationError("User profile not found")

            user_data = user_response.data

            # Check user status
            if user_data["status"] == UserStatus.PENDING:
                # Allow pending org-admin users to login
                # They will be redirected to the pending approval page on frontend
                pass
            elif user_data["status"] == UserStatus.SUSPENDED:
                raise AuthenticationError(
                    "Your account has been suspended. Please contact support."
                )
            elif user_data["status"] == UserStatus.DELETED:
                raise AuthenticationError("Your account has been deleted.")

            # Update last login
            self.admin_client.table("users").update(
                {"last_login": datetime.utcnow().isoformat()}
            ).eq("id", user_data["id"]).execute()

            return {
                "access_token": response.session.access_token,
                "refresh_token": response.session.refresh_token,
                "token_type": "bearer",
                "expires_in": response.session.expires_in or 3600,
                "user": user_data,
            }

        except AuthenticationError:
            raise
        except AuthApiError as e:
            raise AuthenticationError(f"Authentication failed: {e.message}")
        except Exception as e:
            raise AuthenticationError(f"Signin failed: {str(e)}")

    async def signout(self, access_token: str) -> bool:
        """
        Sign out a user by invalidating their session.

        Args:
            access_token: User's access token

        Returns:
            bool: True if successful

        Raises:
            AuthenticationError: If signout fails
        """
        try:
            # Set the access token
            self.client.auth.set_session(access_token, "")
            # Sign out
            self.client.auth.sign_out()
            return True
        except Exception as e:
            raise AuthenticationError(f"Signout failed: {str(e)}")

    async def refresh_token(self, refresh_token: str) -> Dict[str, Any]:
        """
        Refresh access token using refresh token.

        Args:
            refresh_token: Refresh token

        Returns:
            Dict with new access_token and refresh_token

        Raises:
            AuthenticationError: If token refresh fails
        """
        try:
            response = self.client.auth.refresh_session(refresh_token)

            if not response or not response.session:
                raise AuthenticationError("Failed to refresh token")

            return {
                "access_token": response.session.access_token,
                "refresh_token": response.session.refresh_token,
                "token_type": "bearer",
                "expires_in": response.session.expires_in or 3600,
            }

        except AuthApiError as e:
            raise AuthenticationError(f"Token refresh failed: {e.message}")
        except Exception as e:
            raise AuthenticationError(f"Token refresh failed: {str(e)}")

    async def invite_user(
        self,
        email: str,
        user_name: str,
        organization_id: UUID,
        inviter_id: UUID,
        job_title: Optional[str] = None,
        phone_number: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Invite a user to join an organization (org-admin action).
        User receives a magic link to set password and login.

        Args:
            email: User email
            user_name: User's full name
            organization_id: Organization ID
            inviter_id: ID of the user sending invitation (org-admin)
            job_title: Optional job title
            phone_number: Optional phone number

        Returns:
            Dict with user_id and invitation status

        Raises:
            ConflictError: If user already exists
            AuthorizationError: If inviter is not org-admin of the organization
            BadRequestError: If invitation fails
        """
        try:
            # Verify inviter is org-admin of the organization
            inviter_response = (
                self.admin_client.table("users")
                .select("*")
                .eq("id", str(inviter_id))
                .single()
                .execute()
            )

            if not inviter_response.data:
                raise AuthorizationError("Inviter not found")

            inviter = inviter_response.data
            if inviter["role"] != UserRole.ORG_ADMIN:
                raise AuthorizationError("Only org-admins can invite users")

            if str(inviter["organization_id"]) != str(organization_id):
                raise AuthorizationError("You can only invite users to your own organization")

            # Check organization user limit
            # Get organization details
            org_response = (
                self.admin_client.table("organizations")
                .select("max_users")
                .eq("id", str(organization_id))
                .single()
                .execute()
            )
            
            if not org_response.data:
                raise NotFoundError("Organization not found")
                
            max_users = org_response.data["max_users"]
            
            # Count current users in organization
            users_count_response = (
                self.admin_client.table("users")
                .select("id", count="exact", head=True)
                .eq("organization_id", str(organization_id))
                .execute()
            )
            
            current_users_count = users_count_response.count or 0
            
            if current_users_count >= max_users:
                raise BadRequestError(
                    f"Organization has reached its user limit of {max_users}. "
                    f"Current users: {current_users_count}. "
                    "Please upgrade your plan to invite more users."
                )

            # Check if user already exists
            try:
                admin_response = self.admin_client.auth.admin.list_users()
                existing_users = [u for u in admin_response if u.email == email]
                if existing_users:
                    raise ConflictError(f"User with email {email} already exists")
            except ConflictError:
                raise
            except Exception:
                pass

            # Generate magic link using admin API
            link_response = self.admin_client.auth.admin.generate_link(
                {
                    "type": "magiclink",
                    "email": email,
                    "options": {
                        "data": {
                            "user_name": user_name,
                            "role": UserRole.USER,
                            "status": UserStatus.ACTIVE,
                            "organization_id": str(organization_id),
                            "job_title": job_title,
                            "phone_number": phone_number,
                        }
                    },
                }
            )

            if not link_response or not link_response.user:
                raise BadRequestError("Failed to generate invitation link")

            auth_user_id = link_response.user.id

            # Ensure user record exists with correct data
            # Check if user already exists in public.users
            existing_user = (
                self.admin_client.table("users")
                .select("*")
                .eq("auth_user_id", auth_user_id)
                .execute()
            )

            if existing_user.data:
                # Update existing user
                user_update = (
                    self.admin_client.table("users")
                    .update(
                        {
                            "organization_id": str(organization_id),
                            "status": UserStatus.ACTIVE,
                            "role": UserRole.USER,
                            "user_name": user_name,
                            "job_title": job_title,
                            "phone_number": phone_number,
                        }
                    )
                    .eq("auth_user_id", auth_user_id)
                    .execute()
                )
                user_id = existing_user.data[0]["id"]
            else:
                # Create new user record
                user_data = {
                    "auth_user_id": auth_user_id,
                    "email": email,
                    "user_name": user_name,
                    "role": UserRole.USER,
                    "status": UserStatus.ACTIVE,
                    "organization_id": str(organization_id),
                    "job_title": job_title,
                    "phone_number": phone_number,
                    "is_verified": False,
                }

                user_response = self.admin_client.table("users").insert(user_data).execute()

                if not user_response.data:
                    raise BadRequestError("Failed to create user profile")

                user_id = user_response.data[0]["id"]

            return {
                "user_id": user_id,
                "auth_user_id": auth_user_id,
                "email": email,
                "magic_link": link_response.properties.action_link,
                "message": "User invited successfully. Magic link sent to email.",
            }

        except (ConflictError, AuthorizationError, BadRequestError):
            raise
        except Exception as e:
            raise BadRequestError(f"User invitation failed: {str(e)}")

    async def approve_org_admin(
        self,
        user_id: UUID,
        approver_id: UUID,
        subscription_plan: str = "FREE",
        max_users: int = 10,
        max_storage_gb: int = 1,
    ) -> Dict[str, Any]:
        """
        Approve an org-admin registration (super-admin action).

        Args:
            user_id: ID of user to approve
            approver_id: ID of super-admin approving
            subscription_plan: Subscription plan to assign
            max_users: Maximum users allowed
            max_storage_gb: Maximum storage in GB

        Returns:
            Dict with approval status

        Raises:
            AuthorizationError: If approver is not super-admin
            NotFoundError: If user not found
            BadRequestError: If approval fails
        """
        try:
            # Verify approver is super-admin
            approver_response = (
                self.admin_client.table("users")
                .select("*")
                .eq("id", str(approver_id))
                .single()
                .execute()
            )

            if not approver_response.data:
                raise AuthorizationError("Approver not found")

            if approver_response.data["role"] != UserRole.SUPER_ADMIN:
                raise AuthorizationError("Only super-admins can approve org-admins")

            # Get user to approve
            user_response = (
                self.admin_client.table("users")
                .select("*")
                .eq("id", str(user_id))
                .single()
                .execute()
            )

            if not user_response.data:
                raise NotFoundError("User not found")

            user = user_response.data

            if user["role"] != UserRole.ORG_ADMIN:
                raise BadRequestError("User is not an org-admin")

            if user["status"] != UserStatus.PENDING:
                raise BadRequestError("User is not in pending status")

            # Update user status to active
            self.admin_client.table("users").update({"status": UserStatus.ACTIVE}).eq(
                "id", str(user_id)
            ).execute()

            # Update organization subscription
            if user["organization_id"]:
                self.admin_client.table("organizations").update(
                    {
                        "subscription_plan": subscription_plan,
                        "subscription_status": "ACTIVE",
                        "max_users": max_users,
                        "max_storage_gb": max_storage_gb,
                    }
                ).eq("id", user["organization_id"]).execute()

            # Send approval email (via Supabase email templates)
            try:
                self.admin_client.auth.admin.generate_link(
                    {
                        "type": "magiclink",
                        "email": user["email"],
                    }
                )
            except Exception as e:
                log_warning(f"Failed to send approval email: {e}")

            return {
                "user_id": str(user_id),
                "status": UserStatus.ACTIVE,
                "message": "Org-admin approved successfully",
            }

        except (AuthorizationError, NotFoundError, BadRequestError):
            raise
        except Exception as e:
            raise BadRequestError(f"Approval failed: {str(e)}")

    async def reject_org_admin(self, user_id: UUID, approver_id: UUID) -> Dict[str, Any]:
        """
        Reject an org-admin registration (super-admin action).

        Args:
            user_id: ID of user to reject
            approver_id: ID of super-admin rejecting

        Returns:
            Dict with rejection status

        Raises:
            AuthorizationError: If approver is not super-admin
            NotFoundError: If user not found
            BadRequestError: If rejection fails
        """
        try:
            # Verify approver is super-admin
            approver_response = (
                self.admin_client.table("users")
                .select("*")
                .eq("id", str(approver_id))
                .single()
                .execute()
            )

            if not approver_response.data:
                raise AuthorizationError("Approver not found")

            if approver_response.data["role"] != UserRole.SUPER_ADMIN:
                raise AuthorizationError("Only super-admins can reject org-admins")

            # Get user to reject
            user_response = (
                self.admin_client.table("users")
                .select("*")
                .eq("id", str(user_id))
                .single()
                .execute()
            )

            if not user_response.data:
                raise NotFoundError("User not found")

            user = user_response.data

            # Delete organization if exists
            if user["organization_id"]:
                self.admin_client.table("organizations").delete().eq(
                    "id", user["organization_id"]
                ).execute()

            # Delete user from public.users
            self.admin_client.table("users").delete().eq("id", str(user_id)).execute()

            # Delete from auth.users
            if user["auth_user_id"]:
                self.admin_client.auth.admin.delete_user(user["auth_user_id"])

            return {
                "user_id": str(user_id),
                "message": "Org-admin registration rejected and deleted",
            }

        except (AuthorizationError, NotFoundError, BadRequestError):
            raise
        except Exception as e:
            raise BadRequestError(f"Rejection failed: {str(e)}")

    async def reset_password_request(self, email: str) -> Dict[str, Any]:
        """
        Request password reset link.

        Args:
            email: User email

        Returns:
            Dict with success message

        Raises:
            BadRequestError: If request fails
        """
        try:
            self.client.auth.reset_password_email(email)
            return {"message": "Password reset link sent to email"}
        except Exception as e:
            # Don't reveal if email exists
            return {"message": "If email exists, password reset link will be sent"}

    async def update_password(self, access_token: str, new_password: str) -> Dict[str, Any]:
        """
        Update user password.

        Args:
            access_token: User's access token
            new_password: New password

        Returns:
            Dict with success message

        Raises:
            AuthenticationError: If update fails
        """
        try:
            # Set session
            self.client.auth.set_session(access_token, "")

            # Update password
            response = self.client.auth.update_user({"password": new_password})

            if not response or not response.user:
                raise AuthenticationError("Failed to update password")

            # Update is_verified status in public.users
            self.admin_client.table("users").update(
                {"is_verified": True}
            ).eq("auth_user_id", response.user.id).execute()

            return {"message": "Password updated successfully"}

        except AuthApiError as e:
            raise AuthenticationError(f"Password update failed: {e.message}")
        except Exception as e:
            raise AuthenticationError(f"Password update failed: {str(e)}")
