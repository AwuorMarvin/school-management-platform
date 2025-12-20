"""
Transport Route endpoints - CRUD operations for transport routes.
"""

from typing import Optional
from uuid import UUID
from datetime import datetime, UTC

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_school_admin
from app.models.transport_route import TransportRoute
from app.models.user import User
from app.schemas.transport_route import (
    TransportRouteCreate,
    TransportRouteUpdate,
    TransportRouteResponse,
    TransportRouteListResponse,
)

router = APIRouter()


# ============================================================================
# List Transport Routes
# ============================================================================

@router.get("/transport-routes", response_model=TransportRouteListResponse)
async def list_transport_routes(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Number of records to return"),
    search: Optional[str] = Query(None, description="Search by zone or description"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> TransportRouteListResponse:
    """
    List transport routes with filtering and pagination.
    
    Permission: All authenticated users
    """
    query = select(TransportRoute).where(TransportRoute.school_id == current_user.school_id)
    
    if search:
        query = query.where(
            or_(
                TransportRoute.zone.ilike(f"%{search}%"),
                TransportRoute.description.ilike(f"%{search}%")
            )
        )
    
    # Get total count
    count_query = select(func.count(TransportRoute.id)).where(TransportRoute.school_id == current_user.school_id)
    if search:
        count_query = count_query.where(
            or_(
                TransportRoute.zone.ilike(f"%{search}%"),
                TransportRoute.description.ilike(f"%{search}%")
            )
        )
    
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Apply pagination
    query = query.offset(skip).limit(limit)
    
    result = await db.execute(query)
    routes = result.scalars().all()
    
    # Format response
    data = [
        {
            "id": route.id,
            "school_id": route.school_id,
            "zone": route.zone,
            "description": route.description,
            # For backward compatibility, expose cost_per_term as the two-way cost
            "cost_per_term": route.two_way_cost_per_term,
            "one_way_cost_per_term": route.one_way_cost_per_term,
            "two_way_cost_per_term": route.two_way_cost_per_term,
            "created_at": route.created_at.isoformat(),
            "updated_at": route.updated_at.isoformat(),
        }
        for route in routes
    ]
    
    return TransportRouteListResponse(
        data=data,
        pagination={
            "page": (skip // limit) + 1,
            "page_size": limit,
            "total": total,
            "total_pages": (total + limit - 1) // limit if total > 0 else 0,
            "has_next": (skip + limit) < total,
            "has_previous": skip > 0,
        }
    )


# ============================================================================
# Get Transport Route
# ============================================================================

@router.get("/transport-routes/{route_id}", response_model=TransportRouteResponse)
async def get_transport_route(
    route_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> TransportRouteResponse:
    """
    Get a single transport route by ID.
    
    Permission: All authenticated users
    """
    result = await db.execute(
        select(TransportRoute).where(
            TransportRoute.id == route_id,
            TransportRoute.school_id == current_user.school_id
        )
    )
    route = result.scalar_one_or_none()
    
    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "TRANSPORT_ROUTE_NOT_FOUND", "message": "Transport route not found"}
        )
    
    return TransportRouteResponse(
        id=route.id,
        school_id=route.school_id,
        zone=route.zone,
        description=route.description,
        cost_per_term=route.two_way_cost_per_term,
        one_way_cost_per_term=route.one_way_cost_per_term,
        two_way_cost_per_term=route.two_way_cost_per_term,
        created_at=route.created_at.isoformat(),
        updated_at=route.updated_at.isoformat(),
    )


# ============================================================================
# Create Transport Route
# ============================================================================

@router.post("/transport-routes", response_model=TransportRouteResponse, status_code=status.HTTP_201_CREATED)
async def create_transport_route(
    route_data: TransportRouteCreate,
    current_user: User = Depends(require_school_admin),
    db: AsyncSession = Depends(get_db)
) -> TransportRouteResponse:
    """
    Create a new transport route.
    
    Permission: SCHOOL_ADMIN, SUPER_ADMIN
    """
    route = TransportRoute(
        school_id=current_user.school_id,
        zone=route_data.zone,
        description=route_data.description,
        cost_per_term=route_data.two_way_cost_per_term,
        one_way_cost_per_term=route_data.one_way_cost_per_term,
        two_way_cost_per_term=route_data.two_way_cost_per_term,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    
    db.add(route)
    await db.commit()
    await db.refresh(route)
    
    return TransportRouteResponse(
        id=route.id,
        school_id=route.school_id,
        zone=route.zone,
        description=route.description,
        cost_per_term=route.cost_per_term,
        created_at=route.created_at.isoformat(),
        updated_at=route.updated_at.isoformat(),
    )


# ============================================================================
# Update Transport Route
# ============================================================================

@router.put("/transport-routes/{route_id}", response_model=TransportRouteResponse)
async def update_transport_route(
    route_id: UUID,
    route_data: TransportRouteUpdate,
    current_user: User = Depends(require_school_admin),
    db: AsyncSession = Depends(get_db)
) -> TransportRouteResponse:
    """
    Update a transport route.
    
    Permission: SCHOOL_ADMIN, SUPER_ADMIN
    """
    result = await db.execute(
        select(TransportRoute).where(
            TransportRoute.id == route_id,
            TransportRoute.school_id == current_user.school_id
        )
    )
    route = result.scalar_one_or_none()
    
    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "TRANSPORT_ROUTE_NOT_FOUND", "message": "Transport route not found"}
        )
    
    # Update fields
    if route_data.zone is not None:
        route.zone = route_data.zone
    if route_data.description is not None:
        route.description = route_data.description
    if route_data.one_way_cost_per_term is not None:
        route.one_way_cost_per_term = route_data.one_way_cost_per_term
    if route_data.two_way_cost_per_term is not None:
        route.two_way_cost_per_term = route_data.two_way_cost_per_term
        # Keep legacy field in sync
        route.cost_per_term = route_data.two_way_cost_per_term
    
    route.updated_at = datetime.now(UTC)
    
    await db.commit()
    await db.refresh(route)
    
    return TransportRouteResponse(
        id=route.id,
        school_id=route.school_id,
        zone=route.zone,
        description=route.description,
        cost_per_term=route.two_way_cost_per_term,
        one_way_cost_per_term=route.one_way_cost_per_term,
        two_way_cost_per_term=route.two_way_cost_per_term,
        created_at=route.created_at.isoformat(),
        updated_at=route.updated_at.isoformat(),
    )


# ============================================================================
# Delete Transport Route
# ============================================================================

@router.delete("/transport-routes/{route_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transport_route(
    route_id: UUID,
    current_user: User = Depends(require_school_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a transport route.
    
    Permission: SCHOOL_ADMIN, SUPER_ADMIN
    """
    result = await db.execute(
        select(TransportRoute).where(
            TransportRoute.id == route_id,
            TransportRoute.school_id == current_user.school_id
        )
    )
    route = result.scalar_one_or_none()
    
    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "TRANSPORT_ROUTE_NOT_FOUND", "message": "Transport route not found"}
        )
    
    db.delete(route)
    await db.commit()

