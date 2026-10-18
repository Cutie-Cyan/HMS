from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.health import router as health_router

app = FastAPI(
    title="HMS API",
    description="Python FastAPI backend for the Hospital Management System.",
    version="0.1.0",
)

# Restrict this list to the deployed frontend origins before production deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "apikey"],
)

app.include_router(health_router, prefix="/api")
