"""
Transport Route schemas - Request/Response models for transport route endpoints.
"""

from decimal import Decimal
from uuid import UUID
from typing import Optional, List

from pydantic import BaseModel, Field


# ============================================================================
# Transport Route Request Schemas
# ============================================================================

class TransportRouteCreate(BaseModel):
    """Schema for creating a new transport route."""
    
    zone: str = Field(..., min_length=1, max_length=100, description="Zone name (e.g., 'Zone A', 'Westlands')")
    description: Optional[str] = Field(None, description="Description of the route/zone")
    one_way_cost_per_term: Decimal = Field(..., ge=0, description="One-way transport cost per term")
    two_way_cost_per_term: Decimal = Field(..., ge=0, description="Two-way transport cost per term")


class TransportRouteUpdate(BaseModel):
    """Schema for updating a transport route."""
    
    zone: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    one_way_cost_per_term: Optional[Decimal] = Field(None, ge=0)
    two_way_cost_per_term: Optional[Decimal] = Field(None, ge=0)


# ============================================================================
# Transport Route Response Schemas
# ============================================================================

class TransportRouteResponse(BaseModel):
    """Schema for transport route response."""
    
    id: UUID
    school_id: UUID
    zone: str
    description: Optional[str]
    # Legacy single cost (treated as two-way for backward compatibility)
    cost_per_term: Decimal
    one_way_cost_per_term: Decimal
    two_way_cost_per_term: Decimal
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True


class TransportRouteListResponse(BaseModel):
    """Paginated list of transport routes."""
    
    data: List[TransportRouteResponse]
    pagination: dict

