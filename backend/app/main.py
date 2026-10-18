from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.admin_staff import router as admin_staff_router
from app.api.routes.health import router as health_router
from app.core.config import settings

app = FastAPI(
    title="HMS API",
    description="Python FastAPI backend for the Hospital Management System.",
    version="0.2.1",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in settings.cors_origins.split(",")
        if origin.strip()
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "apikey"],
)

app.include_router(health_router, prefix="/api")
app.include_router(admin_staff_router, prefix="/api")
