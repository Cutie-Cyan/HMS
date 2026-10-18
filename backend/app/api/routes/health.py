from datetime import UTC, datetime

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check() -> dict[str, str]:
    """Report that the HMS API process is responding."""
    return {
        "status": "ok",
        "service": "hms-api",
        "timestamp": datetime.now(UTC).isoformat(),
    }
