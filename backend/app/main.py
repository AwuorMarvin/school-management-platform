"""
School Management Platform - FastAPI Application Entry Point

This is the main application file that initializes FastAPI,
configures middleware, and sets up routes.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError, IntegrityError

from app.core.config import settings
from app.core.database import check_db_connection, close_db

# ============================================================================
# Configure Logging
# ============================================================================
logging.basicConfig(
    level=settings.LOG_LEVEL,
    format=settings.LOG_FORMAT,
)
logger = logging.getLogger(__name__)


# ============================================================================
# Application Lifespan Events
# ============================================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan context manager.
    
    Handles startup and shutdown events.
    """
    # Startup
    logger.info("🚀 Starting School Management Platform API...")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"Debug mode: {settings.DEBUG}")
    
    # Check database connection
    db_connected = await check_db_connection()
    if db_connected:
        logger.info("✅ Database connection successful")
    else:
        logger.error("❌ Database connection failed")
    
    logger.info("✅ Application startup complete")
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down School Management Platform API...")
    await close_db()
    logger.info("✅ Database connections closed")
    logger.info("✅ Application shutdown complete")


# ============================================================================
# FastAPI Application
# ============================================================================
app = FastAPI(
    title=settings.APP_NAME,
    description="""
    **School Management Platform API** - Multi-tenant SaaS for school management.
    
    ## Features
    
    * 🏫 **Multi-tenant** - Isolated data per school
    * 👥 **User Management** - Admins, Teachers, Parents
    * 📚 **Student Management** - Admissions, classes, performance
    * 📊 **Academic Performance** - Grades, comments, reports
    * 📁 **Document Vault** - Secure file storage
    * 💬 **Communication** - Announcements, notice board
    * 💰 **Fee Management** - Payment tracking
    * 🔐 **Email + Password Authentication** - Secure JWT-based auth
    
    ## Authentication
    
    All endpoints (except `/auth/*`) require authentication.
    
    Include JWT token in Authorization header:
    ```
    Authorization: Bearer <your_jwt_token>
    ```
    
    ## Multi-Tenant Isolation
    
    All data is automatically scoped by `school_id` from the authenticated user's token.
    Cross-school data access is prevented at the API level.
    """,
    version=settings.APP_VERSION,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)


# ============================================================================
# CORS Middleware
# ============================================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=settings.CORS_ALLOW_METHODS,
    allow_headers=settings.CORS_ALLOW_HEADERS,
)


# ============================================================================
# Global Exception Handlers
# ============================================================================
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError
) -> JSONResponse:
    """
    Handle Pydantic validation errors.
    
    Returns user-friendly validation error messages.
    """
    errors = {}
    error_messages = []
    
    for error in exc.errors():
        field = ".".join(str(loc) for loc in error["loc"] if loc != "body")
        message = error["msg"]
        
        # Format field name for display (e.g., "father.phone_number" -> "Father Phone Number")
        display_field = field.replace("_", " ").replace(".", " ").title()
        
        errors[field] = [message]
        error_messages.append(f"{display_field}: {message}")
    
    logger.warning(f"Validation error on {request.url.path}: {errors}")
    
    # Create a user-friendly message with all errors
    if len(error_messages) == 1:
        user_message = error_messages[0]
    else:
        user_message = "Please fix the following errors:\n" + "\n".join(f"• {msg}" for msg in error_messages)
    
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "error_code": "VALIDATION_ERROR",
            "message": user_message,
            "recovery": "Fix the validation errors and try again",
            "details": {"fields": errors}
        }
    )


@app.exception_handler(IntegrityError)
async def integrity_error_handler(
    request: Request,
    exc: IntegrityError
) -> JSONResponse:
    """
    Handle database integrity constraint violations.
    
    Provides user-friendly messages for common constraint violations.
    """
    error_str = str(exc.orig) if hasattr(exc, 'orig') else str(exc)
    # Log full error details for debugging
    logger.error(f"Integrity error on {request.url.path}: {error_str}", exc_info=True)
    
    # Check for common constraint violations
    error_lower = error_str.lower()
    
    if "unique constraint" in error_lower or "duplicate key" in error_lower or "already exists" in error_lower:
        # Check for specific constraint names (PostgreSQL includes constraint name in error)
        if "uq_user_school_email" in error_str or ("email" in error_lower and ("unique" in error_lower or "duplicate" in error_lower)):
            return JSONResponse(
                status_code=status.HTTP_409_CONFLICT,
                content={
                    "error_code": "DUPLICATE_EMAIL",
                    "message": "This email address is already registered in your school",
                    "recovery": "Please use a different email address or link the existing parent"
                }
            )
        elif "uq_user_school_phone" in error_str or ("phone" in error_lower and ("unique" in error_lower or "duplicate" in error_lower)):
            return JSONResponse(
                status_code=status.HTTP_409_CONFLICT,
                content={
                    "error_code": "DUPLICATE_PHONE_NUMBER",
                    "message": "This phone number is already registered in your school",
                    "recovery": "Please use a different phone number or link the existing parent"
                }
            )
        elif "id_number" in error_lower:
            message = "This ID number is already registered"
            recovery = "Please verify the ID number"
        else:
            message = "This record already exists"
            recovery = "Please check for duplicate entries"
    elif "foreign key constraint" in error_lower or "foreign key" in error_lower:
        message = "Invalid reference to another record"
        recovery = "Please verify all related records exist and are valid"
    elif "check constraint" in error_lower:
        if "phone" in error_lower and "254" in error_str:
            message = "Phone number must start with +254 (Kenya format)"
            recovery = "Please enter a valid Kenyan phone number starting with +254"
        elif "role" in error_lower:
            message = "Invalid user role"
            recovery = "Please use a valid role"
        elif "status" in error_lower:
            message = "Invalid status value"
            recovery = "Please use a valid status"
        elif "is_annual" in error_lower or "is_one_off" in error_lower or "type_exclusive" in error_lower:
            message = "A line item cannot be both annual and one-off"
            recovery = "Please set either is_annual or is_one_off, but not both"
        elif "amount" in error_lower:
            message = "Line item amount must be greater than or equal to 0"
            recovery = "Please enter a valid amount (>= 0)"
        else:
            # Include the actual constraint error in development
            if settings.is_development:
                message = f"Database constraint violation: {error_str}"
            else:
                message = "Data validation failed"
            recovery = "Please check all fields and try again"
    else:
        # For unknown errors, include details in development
        if settings.is_development:
            message = f"Database integrity error: {error_str}"
        else:
            message = "Data validation failed"
        recovery = "Please check all fields and try again"
    
    # Always include error details in development mode
    response_content = {
        "error_code": "DATA_CONSTRAINT_ERROR",
        "message": message,
        "recovery": recovery
    }
    
    if settings.is_development:
        response_content["details"] = {
            "error": error_str,
            "error_type": type(exc).__name__
        }
    
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content=response_content
    )


@app.exception_handler(SQLAlchemyError)
async def database_exception_handler(
    request: Request,
    exc: SQLAlchemyError
) -> JSONResponse:
    """
    Handle database errors.
    
    Prevents database error details from leaking to clients.
    """
    logger.error(f"Database error on {request.url.path}: {exc}", exc_info=True)
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error_code": "DATABASE_ERROR",
            "message": "A database error occurred",
            "recovery": "Please try again later. Contact support if the problem persists."
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(
    request: Request,
    exc: Exception
) -> JSONResponse:
    """
    Handle unexpected errors.
    
    Catch-all handler for unhandled exceptions.
    """
    logger.error(f"Unexpected error on {request.url.path}: {exc}", exc_info=True)
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error_code": "INTERNAL_ERROR",
            "message": "An unexpected error occurred",
            "recovery": "Please try again later. Contact support if the problem persists."
        }
    )


# ============================================================================
# Root Endpoints
# ============================================================================
@app.get(
    "/",
    tags=["Root"],
    summary="API Root",
    response_description="Welcome message with API information"
)
async def root() -> dict:
    """
    API root endpoint.
    
    Returns basic API information and links to documentation.
    """
    return {
        "message": "Welcome to School Management Platform API",
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "docs": "/api/docs",
        "redoc": "/api/redoc",
        "openapi": "/api/openapi.json",
        "health": "/health"
    }


@app.get(
    "/health",
    tags=["Health"],
    summary="Health Check",
    response_description="API health status"
)
async def health_check() -> dict:
    """
    Health check endpoint.
    
    Used by monitoring tools and load balancers to verify API is running.
    Checks database connectivity.
    
    Returns:
        dict: Health status including database connection state
    """
    db_healthy = await check_db_connection()
    
    health_status = {
        "status": "healthy" if db_healthy else "degraded",
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "database": "connected" if db_healthy else "disconnected"
    }
    
    if not db_healthy:
        logger.warning("Health check failed - database not connected")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content=health_status
        )
    
    return health_status


# ============================================================================
# API Router Mounting Point
# ============================================================================
from app.api.v1.router import api_router
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


# ============================================================================
# Development Tools
# ============================================================================
if settings.is_development:
    @app.get(
        "/debug/settings",
        tags=["Debug"],
        summary="View Settings (Dev Only)",
        include_in_schema=settings.DEBUG
    )
    async def debug_settings() -> dict:
        """
        Debug endpoint to view application settings.
        
        **Only available in development mode.**
        """
        return {
            "environment": settings.ENVIRONMENT,
            "debug": settings.DEBUG,
            "database_url": str(settings.DATABASE_URL).replace(
                str(settings.DATABASE_URL).split("@")[0].split("://")[1],
                "***:***"
            ) if "@" in str(settings.DATABASE_URL) else "***",
            "jwt_algorithm": settings.JWT_ALGORITHM,
            "cors_origins": settings.CORS_ORIGINS,
            "sms_enabled": settings.SMS_ENABLED,
            "email_enabled": settings.EMAIL_ENABLED,
        }


# ============================================================================
# Application Entry Point (for direct run)
# ============================================================================
if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.is_development,
        log_level=settings.LOG_LEVEL.lower()
    )

