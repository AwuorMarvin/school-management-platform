"""
Academic Performance schemas - Request/Response models.
"""

from uuid import UUID
from typing import Optional, List

from pydantic import BaseModel, Field, field_validator, model_validator


# ============================================================================
# Legacy Subject-Level Performance Schemas (per student/subject/term)
# ============================================================================

class PerformanceEntry(BaseModel):
    """Schema for entering/updating student performance."""
    
    subject_id: UUID = Field(..., description="Subject ID")
    term_id: UUID = Field(..., description="Term ID")
    grade: Optional[str] = Field(None, max_length=10, description="Grade (e.g., A, A+, B, 85%)")
    subject_comment: Optional[str] = Field(None, max_length=1000, description="Subject-level comment")


class TermCommentEntry(BaseModel):
    """Schema for entering/updating term comment."""
    
    term_id: UUID = Field(..., description="Term ID")
    comment: str = Field(..., min_length=1, max_length=2000, description="Overall term comment")


# ============================================================================
# New Performance Report + Line Item Schemas
# ============================================================================


class PerformanceLineItemBase(BaseModel):
    """Base schema for performance line items."""

    area_label: str = Field(..., min_length=1, max_length=200, description="Performance area (e.g., Algebra)")
    numeric_score: Optional[float] = Field(
        None,
        description="Optional numeric score for this performance area",
    )
    descriptive_score: Optional[str] = Field(
        None,
        min_length=1,
        max_length=50,
        description="Optional descriptive score (e.g., ME for Meeting Expectations)",
    )
    comment: Optional[str] = Field(
        None,
        max_length=2000,
        description="Optional detailed comment for this performance area",
    )
    position: int = Field(1, ge=1, le=5, description="Ordering of line items within the report (1–5)")

    @model_validator(mode="after")
    def validate_scores(self) -> "PerformanceLineItemBase":
        """Ensure at least one type of score is provided (numeric or descriptive)."""
        if self.numeric_score is None and (self.descriptive_score is None or self.descriptive_score.strip() == ""):
            raise ValueError("Each performance line item must have at least a numeric or descriptive score")
        return self


class PerformanceLineItemCreate(PerformanceLineItemBase):
    """Schema for creating a performance line item."""

    pass


class PerformanceLineItemUpdate(BaseModel):
    """Schema for updating a performance line item."""

    area_label: Optional[str] = Field(None, min_length=1, max_length=200)
    numeric_score: Optional[float] = Field(None)
    descriptive_score: Optional[str] = Field(None, min_length=1, max_length=50)
    comment: Optional[str] = Field(None, max_length=2000)
    position: Optional[int] = Field(None, ge=1, le=5)

    @model_validator(mode="after")
    def validate_scores(self) -> "PerformanceLineItemUpdate":
        """
        Ensure that if both scores are explicitly set to None/empty,
        we still enforce at least one type of score at the application level.
        """
        # Validation of "at least one score" will be re-checked on the full report payload.
        return self


class PerformanceReportBase(BaseModel):
    """Base schema for performance report context (student, subject, term, etc.)."""

    student_id: UUID = Field(..., description="Student ID")
    class_id: UUID = Field(..., description="Class ID")
    subject_id: UUID = Field(..., description="Subject ID")
    academic_year_id: UUID = Field(..., description="Academic year ID")
    term_id: UUID = Field(..., description="Term ID")
    teacher_id: Optional[UUID] = Field(
        None,
        description="Teacher responsible for this subject in this class. "
        "Ignored for teachers (derived from current user). Required for admins.",
    )


class PerformanceReportCreate(PerformanceReportBase):
    """Schema for creating a performance report with up to 5 line items."""

    line_items: List[PerformanceLineItemCreate] = Field(
        ...,
        min_length=1,
        max_length=5,
        description="1–5 detailed performance line items",
    )

    @field_validator("line_items")
    @classmethod
    def validate_line_items_count(
        cls, value: List[PerformanceLineItemCreate]
    ) -> List[PerformanceLineItemCreate]:
        """Enforce at least one and at most five line items."""
        if not value:
            raise ValueError("At least one performance line item is required")
        if len(value) > 5:
            raise ValueError("A maximum of 5 performance line items is allowed")
        return value


class PerformanceReportUpdate(BaseModel):
    """Schema for updating an existing performance report (line items replaced as a set)."""

    line_items: List[PerformanceLineItemCreate] = Field(
        ...,
        min_length=1,
        max_length=5,
        description="1–5 detailed performance line items (replaces existing set)",
    )

    @field_validator("line_items")
    @classmethod
    def validate_line_items_count(
        cls, value: List[PerformanceLineItemCreate]
    ) -> List[PerformanceLineItemCreate]:
        """Enforce at least one and at most five line items on update."""
        if not value:
            raise ValueError("At least one performance line item is required")
        if len(value) > 5:
            raise ValueError("A maximum of 5 performance line items is allowed")
        return value


# ============================================================================
# Performance Response Schemas
# ============================================================================

class StudentMinimalResponse(BaseModel):
    """Minimal student information."""
    
    id: UUID
    first_name: str
    last_name: str
    
    class Config:
        from_attributes = True


class SubjectMinimalResponse(BaseModel):
    """Minimal subject information."""
    
    id: UUID
    name: str
    
    class Config:
        from_attributes = True


class ClassMinimalResponse(BaseModel):
    """Minimal class information."""

    id: UUID
    name: str

    class Config:
        from_attributes = True


class AcademicYearMinimalResponse(BaseModel):
    """Minimal academic year information."""

    id: UUID
    name: str

    class Config:
        from_attributes = True


class TermMinimalResponse(BaseModel):
    """Minimal term information."""
    
    id: UUID
    name: str
    
    class Config:
        from_attributes = True


class UserMinimalResponse(BaseModel):
    """Minimal user information."""
    
    id: UUID
    first_name: str
    last_name: str
    
    class Config:
        from_attributes = True


class PerformanceResponse(BaseModel):
    """Schema for performance entry response."""
    
    id: str
    student_id: UUID
    subject_id: UUID
    term_id: UUID
    grade: Optional[str]
    subject_comment: Optional[str]
    entered_by_user_id: UUID
    created_at: str
    updated_at: str
    student: Optional[StudentMinimalResponse] = None
    subject: Optional[SubjectMinimalResponse] = None
    term: Optional[TermMinimalResponse] = None
    entered_by: Optional[UserMinimalResponse] = None
    
    class Config:
        from_attributes = True


class PerformanceListItem(BaseModel):
    """Schema for performance list item."""
    
    subject: SubjectMinimalResponse
    term: TermMinimalResponse
    grade: Optional[str]
    subject_comment: Optional[str]
    entered_by: UserMinimalResponse
    entered_at: str


class PerformanceListResponse(BaseModel):
    """Schema for performance list response."""
    
    student: StudentMinimalResponse
    data: list[PerformanceListItem]


class TermCommentResponse(BaseModel):
    """Schema for term comment response."""
    
    id: str
    student_id: UUID
    term_id: UUID
    comment: str
    entered_by_user_id: UUID
    created_at: str
    updated_at: str
    student: Optional[StudentMinimalResponse] = None
    term: Optional[TermMinimalResponse] = None
    entered_by: Optional[UserMinimalResponse] = None
    
    class Config:
        from_attributes = True


# ============================================================================
# New Performance Report Response Schemas
# ============================================================================


class PerformanceLineItemResponse(BaseModel):
    """Schema for performance line item in responses."""

    id: UUID
    area_label: str
    numeric_score: Optional[float] = None
    descriptive_score: Optional[str] = None
    comment: Optional[str] = None
    position: int

    class Config:
        from_attributes = True


class PerformanceReportResponse(BaseModel):
    """Schema for performance report response with nested line items."""

    id: UUID
    student_id: UUID
    class_id: UUID
    subject_id: UUID
    academic_year_id: UUID
    term_id: UUID
    teacher_id: UUID
    created_by_user_id: UUID
    updated_by_user_id: Optional[UUID] = None
    created_at: str
    updated_at: Optional[str] = None
    is_deleted: bool
    line_items: List[PerformanceLineItemResponse]

    class Config:
        from_attributes = True


class PerformanceReportListItem(BaseModel):
    """Lightweight list item for performance reports table views."""

    id: UUID
    student: StudentMinimalResponse
    cls: ClassMinimalResponse
    subject: SubjectMinimalResponse
    teacher: UserMinimalResponse
    academic_year: AcademicYearMinimalResponse
    term: TermMinimalResponse
    line_items_count: int
    first_numeric_score: Optional[float] = None
    first_descriptive_score: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None


class PerformanceReportListResponse(BaseModel):
    """Paginated list response for performance reports."""

    data: List[PerformanceReportListItem]
    total: int
    page: int
    page_size: int

