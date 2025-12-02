# API Design Standards & Guidelines

## Overview
This document defines the standards and conventions for designing RESTful APIs in the FastAPI backend. Following these guidelines ensures consistency, maintainability, and excellent developer experience.

## Table of Contents
1. [API Architecture](#api-architecture)
2. [URL Structure](#url-structure)
3. [HTTP Methods](#http-methods)
4. [Request/Response Formats](#requestresponse-formats)
5. [Error Handling](#error-handling)
6. [Versioning](#versioning)
7. [Authentication](#authentication)
8. [Pagination](#pagination)
9. [Filtering & Sorting](#filtering--sorting)
10. [Rate Limiting](#rate-limiting)
11. [Documentation](#documentation)

---

## API Architecture

### Base URL Structure
```
Production:  https://api.yourdomain.com/v1
Development: http://localhost:8000/api/v1
```

### Router Organization
```
app/routers/
├── __init__.py
├── auth.py              # /api/v1/auth/*
├── users.py             # /api/v1/users/*
├── organizations.py     # /api/v1/organizations/*
├── meetings.py          # /api/v1/meetings/*
├── messages.py          # /api/v1/messages/*
├── storage.py           # /api/v1/storage/*
└── realtime.py          # /api/v1/realtime/*
```

### Main Application Setup
```python
# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, users, organizations, meetings, messages, storage, realtime
from app.config import settings

app = FastAPI(
    title="Vemeego API",
    description="Video Conferencing Platform API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API version prefix
api_v1 = FastAPI(root_path="/api/v1")

# Include routers
api_v1.include_router(auth.router)
api_v1.include_router(users.router)
api_v1.include_router(organizations.router)
api_v1.include_router(meetings.router)
api_v1.include_router(messages.router)
api_v1.include_router(storage.router)
api_v1.include_router(realtime.router)

# Mount versioned API
app.mount("/api/v1", api_v1)
```

---

## URL Structure

### Naming Conventions

#### Use Nouns, Not Verbs
✅ **GOOD:**
```
GET    /api/v1/meetings
POST   /api/v1/meetings
GET    /api/v1/meetings/{id}
PUT    /api/v1/meetings/{id}
DELETE /api/v1/meetings/{id}
```

❌ **BAD:**
```
GET    /api/v1/getMeetings
POST   /api/v1/createMeeting
GET    /api/v1/getMeetingById/{id}
```

#### Use Plural Nouns
✅ **GOOD:**
```
/api/v1/users
/api/v1/meetings
/api/v1/organizations
```

❌ **BAD:**
```
/api/v1/user
/api/v1/meeting
/api/v1/organization
```

#### Use Kebab-case for Multi-word Resources
✅ **GOOD:**
```
/api/v1/meeting-participants
/api/v1/user-settings
/api/v1/file-uploads
```

❌ **BAD:**
```
/api/v1/meetingParticipants
/api/v1/meeting_participants
```

#### Nested Resources
Use nesting to show relationships, but limit depth to 2 levels:

✅ **GOOD:**
```
/api/v1/meetings/{meeting_id}/participants
/api/v1/meetings/{meeting_id}/messages
/api/v1/organizations/{org_id}/users
```

❌ **BAD (too deep):**
```
/api/v1/organizations/{org_id}/meetings/{meeting_id}/participants/{user_id}/settings
```

Instead, use query parameters or direct access:
```
/api/v1/meeting-participants/{id}
/api/v1/participants?meeting_id={meeting_id}&user_id={user_id}
```

---

## HTTP Methods

### Standard CRUD Operations

| Method | Action | URL Pattern | Description |
|--------|--------|-------------|-------------|
| GET | Read | `/resources` | List all resources |
| GET | Read | `/resources/{id}` | Get single resource |
| POST | Create | `/resources` | Create new resource |
| PUT | Update | `/resources/{id}` | Full update (replace) |
| PATCH | Update | `/resources/{id}` | Partial update |
| DELETE | Delete | `/resources/{id}` | Delete resource |

### Method Guidelines

#### GET - Retrieve Resources
```python
@router.get("/meetings")
async def list_meetings(
    limit: int = Query(50, le=100),
    offset: int = Query(0),
    status: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    List meetings with pagination and filtering.
    
    - **limit**: Number of results (max 100)
    - **offset**: Number of results to skip
    - **status**: Filter by status (scheduled, in_progress, ended)
    """
    # Implementation
    pass

@router.get("/meetings/{meeting_id}")
async def get_meeting(
    meeting_id: str,
    current_user: Dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get single meeting by ID."""
    # Implementation
    pass
```

#### POST - Create Resources
```python
from pydantic import BaseModel, Field

class MeetingCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    scheduled_start_time: datetime
    scheduled_end_time: datetime
    max_participants: int = Field(100, gt=0, le=1000)

@router.post("/meetings", status_code=status.HTTP_201_CREATED)
async def create_meeting(
    meeting: MeetingCreate,
    current_user: Dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Create new meeting.
    
    Returns the created meeting with generated ID and meeting code.
    """
    # Implementation
    return {
        "id": "uuid",
        "meeting_code": "abc-def-ghi",
        **meeting.dict()
    }
```

#### PUT - Full Update
```python
class MeetingUpdate(BaseModel):
    title: str
    description: Optional[str]
    scheduled_start_time: datetime
    scheduled_end_time: datetime
    max_participants: int

@router.put("/meetings/{meeting_id}")
async def update_meeting(
    meeting_id: str,
    meeting: MeetingUpdate,
    current_user: Dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Replace meeting (all fields required).
    """
    # Implementation
    pass
```

#### PATCH - Partial Update
```python
class MeetingPatch(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    scheduled_start_time: Optional[datetime] = None
    scheduled_end_time: Optional[datetime] = None
    max_participants: Optional[int] = None

@router.patch("/meetings/{meeting_id}")
async def patch_meeting(
    meeting_id: str,
    meeting: MeetingPatch,
    current_user: Dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Update specific meeting fields (partial update).
    """
    # Only update provided fields
    update_data = meeting.dict(exclude_unset=True)
    # Implementation
    pass
```

#### DELETE - Remove Resources
```python
@router.delete("/meetings/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meeting(
    meeting_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """
    Delete meeting (soft delete - sets deleted_at timestamp).
    """
    # Implementation
    return None  # 204 returns no content
```

### Special Actions (Non-CRUD)

For actions that don't fit CRUD, use POST with descriptive action names:

```python
# Start meeting
POST /api/v1/meetings/{meeting_id}/start

# End meeting
POST /api/v1/meetings/{meeting_id}/end

# Join meeting
POST /api/v1/meetings/{meeting_id}/join

# Leave meeting
POST /api/v1/meetings/{meeting_id}/leave

# Send invitation
POST /api/v1/meetings/{meeting_id}/invite

# Archive meeting
POST /api/v1/meetings/{meeting_id}/archive
```

---

## Request/Response Formats

### Request Format

#### JSON Body (Default)
```python
@router.post("/meetings")
async def create_meeting(meeting: MeetingCreate):
    # Pydantic automatically validates and parses JSON
    pass
```

#### Query Parameters
```python
@router.get("/meetings")
async def list_meetings(
    status: Optional[str] = Query(None),
    from_date: Optional[datetime] = Query(None),
    to_date: Optional[datetime] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    pass
```

#### Path Parameters
```python
@router.get("/meetings/{meeting_id}/participants/{user_id}")
async def get_participant(meeting_id: str, user_id: str):
    pass
```

#### Headers
```python
from fastapi import Header

@router.get("/meetings")
async def list_meetings(
    authorization: str = Header(...),
    x_request_id: Optional[str] = Header(None)
):
    pass
```

#### Form Data
```python
from fastapi import Form

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    description: str = Form(...)
):
    pass
```

### Response Format

#### Standard Success Response
```json
{
  "data": {
    "id": "uuid",
    "title": "Team Standup",
    "status": "scheduled",
    "created_at": "2024-01-15T10:00:00Z"
  }
}
```

#### List Response with Pagination
```json
{
  "data": [
    { "id": "uuid-1", "title": "Meeting 1" },
    { "id": "uuid-2", "title": "Meeting 2" }
  ],
  "pagination": {
    "total": 150,
    "limit": 50,
    "offset": 0,
    "has_more": true
  }
}
```

#### Response with Metadata
```json
{
  "data": { "id": "uuid", "title": "Meeting" },
  "meta": {
    "version": "1.0",
    "timestamp": "2024-01-15T10:00:00Z",
    "request_id": "req-123"
  }
}
```

---

## Error Handling

### Standard Error Format
```json
{
  "error": {
    "code": "MEETING_NOT_FOUND",
    "message": "Meeting with ID 'xyz' not found",
    "details": {
      "meeting_id": "xyz",
      "resource": "meetings"
    },
    "timestamp": "2024-01-15T10:00:00Z",
    "request_id": "req-123"
  }
}
```

### HTTP Status Codes

#### Success Codes
- **200 OK** - Successful GET, PUT, PATCH
- **201 Created** - Successful POST (resource created)
- **204 No Content** - Successful DELETE
- **206 Partial Content** - Successful partial GET (range requests)

#### Client Error Codes
- **400 Bad Request** - Invalid request (validation failed)
- **401 Unauthorized** - Authentication required or failed
- **403 Forbidden** - Authenticated but not authorized
- **404 Not Found** - Resource not found
- **409 Conflict** - Resource conflict (duplicate, etc.)
- **422 Unprocessable Entity** - Validation error (Pydantic)
- **429 Too Many Requests** - Rate limit exceeded

#### Server Error Codes
- **500 Internal Server Error** - Server error
- **503 Service Unavailable** - Service temporarily unavailable

### Error Response Models

```python
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime

class ErrorDetail(BaseModel):
    code: str
    message: str
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime = Field(default_factory=datetime.now)
    request_id: Optional[str] = None

class ErrorResponse(BaseModel):
    error: ErrorDetail

# Custom exceptions
class APIException(HTTPException):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: Optional[Dict] = None
    ):
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details
        super().__init__(status_code=status_code, detail=message)

class MeetingNotFoundError(APIException):
    def __init__(self, meeting_id: str):
        super().__init__(
            status_code=404,
            code="MEETING_NOT_FOUND",
            message=f"Meeting with ID '{meeting_id}' not found",
            details={"meeting_id": meeting_id}
        )

class UnauthorizedAccessError(APIException):
    def __init__(self, resource: str):
        super().__init__(
            status_code=403,
            code="UNAUTHORIZED_ACCESS",
            message=f"You don't have permission to access {resource}",
            details={"resource": resource}
        )
```

### Global Error Handler

```python
from fastapi import Request
from fastapi.responses import JSONResponse

@app.exception_handler(APIException)
async def api_exception_handler(request: Request, exc: APIException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
                "timestamp": datetime.now().isoformat(),
                "request_id": request.state.request_id if hasattr(request.state, 'request_id') else None
            }
        }
    )

@app.exception_handler(ValidationError)
async def validation_exception_handler(request: Request, exc: ValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed",
                "details": exc.errors(),
                "timestamp": datetime.now().isoformat()
            }
        }
    )
```

---

## Versioning

### URL Versioning (Recommended)
```
/api/v1/meetings
/api/v2/meetings
```

### Implementation
```python
# Version 1
v1_app = FastAPI()
v1_app.include_router(meetings_v1.router)

# Version 2
v2_app = FastAPI()
v2_app.include_router(meetings_v2.router)

# Mount versions
app.mount("/api/v1", v1_app)
app.mount("/api/v2", v2_app)
```

### Deprecation Notice
```python
from fastapi import APIRouter
from warnings import warn

router_v1 = APIRouter(deprecated=True)

@router_v1.get("/meetings")
async def list_meetings_v1():
    """
    List meetings (v1).
    
    **DEPRECATED**: This endpoint is deprecated. Use /api/v2/meetings instead.
    Will be removed in version 3.0.
    """
    # Add deprecation header
    headers = {
        "X-API-Deprecation": "This endpoint is deprecated",
        "X-API-Sunset": "2024-12-31",
        "Link": "</api/v2/meetings>; rel=\"successor-version\""
    }
    return Response(content=json.dumps(data), headers=headers)
```

---

## Authentication

### Bearer Token (JWT)
All protected endpoints require authentication:

```python
from fastapi import Depends, Header
from app.core.security import get_current_user

@router.get("/meetings")
async def list_meetings(
    current_user: Dict = Depends(get_current_user)
):
    """List meetings for authenticated user."""
    pass
```

### Request Format
```
GET /api/v1/meetings
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Public Endpoints
```python
@router.get("/health", include_in_schema=True)
async def health_check():
    """Public endpoint - no authentication required."""
    return {"status": "healthy"}
```

---

## Pagination

### Offset-based Pagination (Default)
```python
@router.get("/meetings")
async def list_meetings(
    limit: int = Query(50, ge=1, le=100, description="Number of items to return"),
    offset: int = Query(0, ge=0, description="Number of items to skip")
):
    # Query with limit and offset
    query = supabase.table("meetings").select("*")
    query = query.range(offset, offset + limit - 1)
    response = await query.execute()
    
    return {
        "data": response.data,
        "pagination": {
            "limit": limit,
            "offset": offset,
            "total": response.count,
            "has_more": offset + limit < response.count
        }
    }
```

### Cursor-based Pagination (For Real-time Data)
```python
@router.get("/messages")
async def list_messages(
    meeting_id: str,
    cursor: Optional[str] = None,
    limit: int = Query(50, le=100)
):
    query = supabase.table("messages").select("*").eq("meeting_id", meeting_id)
    
    if cursor:
        # Decode cursor (base64 encoded timestamp or ID)
        cursor_value = decode_cursor(cursor)
        query = query.lt("created_at", cursor_value)
    
    query = query.order("created_at", desc=True).limit(limit)
    response = await query.execute()
    
    next_cursor = None
    if len(response.data) == limit:
        last_item = response.data[-1]
        next_cursor = encode_cursor(last_item["created_at"])
    
    return {
        "data": response.data,
        "pagination": {
            "next_cursor": next_cursor,
            "has_more": next_cursor is not None
        }
    }
```

---

## Filtering & Sorting

### Filtering
```python
@router.get("/meetings")
async def list_meetings(
    status: Optional[str] = Query(None, regex="^(scheduled|in_progress|ended|cancelled)$"),
    host_id: Optional[str] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    search: Optional[str] = None
):
    query = supabase.table("meetings").select("*")
    
    if status:
        query = query.eq("status", status)
    if host_id:
        query = query.eq("host_user_id", host_id)
    if from_date:
        query = query.gte("scheduled_start_time", from_date.isoformat())
    if to_date:
        query = query.lte("scheduled_start_time", to_date.isoformat())
    if search:
        query = query.ilike("title", f"%{search}%")
    
    response = await query.execute()
    return {"data": response.data}
```

### Sorting
```python
@router.get("/meetings")
async def list_meetings(
    sort_by: str = Query("created_at", regex="^(title|created_at|scheduled_start_time)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$")
):
    query = supabase.table("meetings").select("*")
    query = query.order(sort_by, desc=(sort_order == "desc"))
    
    response = await query.execute()
    return {"data": response.data}
```

### Field Selection
```python
@router.get("/meetings")
async def list_meetings(
    fields: Optional[str] = Query(None, description="Comma-separated fields to return")
):
    # Default fields
    select_fields = "*"
    
    if fields:
        # Validate fields against allowed list
        allowed_fields = {"id", "title", "status", "scheduled_start_time"}
        requested_fields = set(fields.split(","))
        
        if requested_fields.issubset(allowed_fields):
            select_fields = ",".join(requested_fields)
    
    query = supabase.table("meetings").select(select_fields)
    response = await query.execute()
    return {"data": response.data}
```

---

## Rate Limiting

### Implementation
```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@router.post("/auth/signin")
@limiter.limit("5/minute")  # 5 requests per minute
async def signin(request: Request, credentials: SignInRequest):
    pass

@router.post("/meetings")
@limiter.limit("10/minute")
async def create_meeting(request: Request, meeting: MeetingCreate):
    pass
```

### Rate Limit Headers
Include rate limit info in response headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1609459200
```

```python
from fastapi import Response

@router.get("/meetings")
async def list_meetings(response: Response):
    # Add rate limit headers
    response.headers["X-RateLimit-Limit"] = "100"
    response.headers["X-RateLimit-Remaining"] = "95"
    response.headers["X-RateLimit-Reset"] = str(int(time.time()) + 3600)
    
    return {"data": meetings}
```

---

## Documentation

### OpenAPI/Swagger
FastAPI automatically generates OpenAPI documentation.

#### Enhance with Descriptions
```python
@router.post(
    "/meetings",
    response_model=MeetingResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new meeting",
    description="Creates a new scheduled meeting with the specified parameters.",
    response_description="The created meeting with generated ID and meeting code",
    tags=["Meetings"]
)
async def create_meeting(
    meeting: MeetingCreate = Body(
        ...,
        example={
            "title": "Team Standup",
            "description": "Daily team sync",
            "scheduled_start_time": "2024-01-15T10:00:00Z",
            "scheduled_end_time": "2024-01-15T10:30:00Z",
            "max_participants": 50
        }
    ),
    current_user: Dict = Depends(get_current_user)
):
    """
    Create a new meeting.
    
    This endpoint creates a scheduled meeting with:
    - Auto-generated meeting code for joining
    - Host set to current user
    - Organization from current user
    
    **Required Permissions:** Authenticated user
    
    **Rate Limit:** 10 requests per minute
    """
    pass
```

#### Response Examples
```python
from fastapi import responses

@router.get(
    "/meetings/{meeting_id}",
    responses={
        200: {
            "description": "Meeting found",
            "content": {
                "application/json": {
                    "example": {
                        "data": {
                            "id": "uuid",
                            "title": "Team Standup",
                            "status": "scheduled",
                            "meeting_code": "abc-def-ghi"
                        }
                    }
                }
            }
        },
        404: {
            "description": "Meeting not found",
            "content": {
                "application/json": {
                    "example": {
                        "error": {
                            "code": "MEETING_NOT_FOUND",
                            "message": "Meeting not found"
                        }
                    }
                }
            }
        }
    }
)
async def get_meeting(meeting_id: str):
    pass
```

### Access Documentation
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
- OpenAPI JSON: `http://localhost:8000/openapi.json`

---

## Best Practices Summary

### ✅ DO:
1. Use meaningful resource names (nouns, plural)
2. Use appropriate HTTP methods for operations
3. Return proper HTTP status codes
4. Implement pagination for list endpoints
5. Use Pydantic models for validation
6. Document all endpoints with descriptions
7. Include examples in API docs
8. Handle errors consistently
9. Rate limit sensitive endpoints
10. Version your API
11. Use snake_case for JSON fields
12. Include timestamps in ISO 8601 format
13. Implement soft deletes (deleted_at)
14. Log all API requests
15. Use dependencies for reusable logic

### ❌ DON'T:
1. Use verbs in endpoint URLs
2. Return 200 for errors
3. Expose internal implementation details
4. Skip input validation
5. Return all records without pagination
6. Use different formats for similar operations
7. Ignore error handling
8. Skip authentication on sensitive endpoints
9. Trust client-provided data
10. Hard-code configuration values
11. Use camelCase for JSON (use snake_case)
12. Return sensitive data (passwords, tokens)
13. Make breaking changes without versioning
14. Skip rate limiting
15. Forget to document endpoints

---

## Complete Example: Meetings Router

```python
from fastapi import APIRouter, Depends, Query, Body, status, HTTPException
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
from app.core.security import get_current_user, require_org_admin
from app.services.meeting_service import MeetingService
from app.models.meeting import MeetingCreate, MeetingUpdate, MeetingResponse

router = APIRouter(prefix="/meetings", tags=["Meetings"])
meeting_service = MeetingService()

@router.get(
    "",
    response_model=Dict[str, Any],
    summary="List meetings",
    description="Get paginated list of meetings with optional filters"
)
async def list_meetings(
    status: Optional[str] = Query(None, regex="^(scheduled|in_progress|ended|cancelled)$"),
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    search: Optional[str] = Query(None, max_length=100),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: Dict = Depends(get_current_user)
):
    """
    List meetings for current user's organization.
    
    Supports filtering by:
    - Status
    - Date range
    - Title search
    
    Returns paginated results.
    """
    meetings = await meeting_service.list_meetings(
        organization_id=current_user["organization_id"],
        status=status,
        from_date=from_date,
        to_date=to_date,
        search=search,
        limit=limit,
        offset=offset
    )
    
    return {
        "data": meetings["items"],
        "pagination": {
            "total": meetings["total"],
            "limit": limit,
            "offset": offset,
            "has_more": offset + limit < meetings["total"]
        }
    }

@router.post(
    "",
    response_model=MeetingResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create meeting"
)
async def create_meeting(
    meeting: MeetingCreate,
    current_user: Dict = Depends(get_current_user)
):
    """Create a new meeting."""
    return await meeting_service.create_meeting(
        meeting_data=meeting,
        host_user_id=current_user["id"],
        organization_id=current_user["organization_id"]
    )

@router.get(
    "/{meeting_id}",
    response_model=MeetingResponse,
    summary="Get meeting"
)
async def get_meeting(
    meeting_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get meeting by ID."""
    return await meeting_service.get_meeting(
        meeting_id=meeting_id,
        user_id=current_user["id"],
        organization_id=current_user["organization_id"]
    )

@router.patch(
    "/{meeting_id}",
    response_model=MeetingResponse,
    summary="Update meeting"
)
async def update_meeting(
    meeting_id: str,
    meeting: MeetingUpdate,
    current_user: Dict = Depends(get_current_user)
):
    """Update meeting (partial update)."""
    return await meeting_service.update_meeting(
        meeting_id=meeting_id,
        meeting_data=meeting,
        user_id=current_user["id"]
    )

@router.delete(
    "/{meeting_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete meeting"
)
async def delete_meeting(
    meeting_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Delete meeting (soft delete)."""
    await meeting_service.delete_meeting(
        meeting_id=meeting_id,
        user_id=current_user["id"]
    )
    return None

@router.post(
    "/{meeting_id}/start",
    summary="Start meeting"
)
async def start_meeting(
    meeting_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Start a scheduled meeting."""
    return await meeting_service.start_meeting(
        meeting_id=meeting_id,
        user_id=current_user["id"]
    )

@router.post(
    "/{meeting_id}/end",
    summary="End meeting"
)
async def end_meeting(
    meeting_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """End an in-progress meeting."""
    return await meeting_service.end_meeting(
        meeting_id=meeting_id,
        user_id=current_user["id"]
    )
```

---

## Summary

This API design guide ensures:
- ✅ Consistent API structure
- ✅ RESTful best practices
- ✅ Proper error handling
- ✅ Comprehensive documentation
- ✅ Security considerations
- ✅ Scalability patterns
- ✅ Developer-friendly design

Follow these standards for all API endpoints to maintain quality and consistency across the application.