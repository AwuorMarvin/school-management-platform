"""
API v1 router - Aggregates all endpoint routers.
"""

from fastapi import APIRouter

from app.api.v1.endpoints import auth, students, parents, campuses, academic_years, terms, classes, subjects, teacher_assignment, teachers, users, performance, club_activities, transport_routes, fee_structure, fee_adjustments, global_discounts, fee_summary

api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(students.router, tags=["Students"])
api_router.include_router(parents.router, tags=["Parents"])
api_router.include_router(campuses.router, tags=["Campuses"])
api_router.include_router(academic_years.router, tags=["Academic Years"])
api_router.include_router(terms.router, tags=["Terms"])
api_router.include_router(classes.router, tags=["Classes"])
api_router.include_router(subjects.router, tags=["Subjects"])
api_router.include_router(teacher_assignment.router, tags=["Teacher Assignment"])
api_router.include_router(teachers.router, tags=["Teachers"])
api_router.include_router(users.router, tags=["Users"])
api_router.include_router(performance.router, tags=["Academic Performance"])
api_router.include_router(club_activities.router, tags=["Clubs & Activities"])
api_router.include_router(transport_routes.router, tags=["Transport Routes"])
api_router.include_router(fee_structure.router, tags=["Fee Structure"])
api_router.include_router(fee_adjustments.router, tags=["Fee Adjustments"])
api_router.include_router(global_discounts.router, tags=["Global Discounts"])
api_router.include_router(fee_summary.router, tags=["Fee Summary"])

