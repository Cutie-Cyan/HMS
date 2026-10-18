import logging
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from supabase import Client, create_client

from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/staff", tags=["admin", "staff"])

StaffRole = Literal[
    "admin",
    "info_officer",
    "emergency_nurse",
    "cashier",
    "pharmacy",
    "lab",
    "nurse_station",
]


class InviteStaffRequest(BaseModel):
    email: EmailStr
    displayName: str = Field(min_length=1, max_length=150)
    password: str = Field(min_length=8, max_length=128)
    role: StaffRole
    wardId: UUID | None = None


def _clients() -> tuple[Client, Client]:
    missing = [
        name
        for name, value in (
            ("SUPABASE_URL", settings.supabase_url),
            ("SUPABASE_ANON_KEY", settings.supabase_anon_key),
            ("SUPABASE_SERVICE_ROLE_KEY", settings.supabase_service_role_key),
        )
        if not value.strip()
    ]
    if missing:
        logger.error("Missing backend environment variables: %s", ", ".join(missing))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Missing backend environment variables: {', '.join(missing)}. Check backend/.env and restart FastAPI.",
        )
    return (
        create_client(settings.supabase_url, settings.supabase_anon_key),
        create_client(settings.supabase_url, settings.supabase_service_role_key),
    )


@router.post("/invite", status_code=status.HTTP_201_CREATED)
def invite_staff(
    payload: InviteStaffRequest,
    authorization: str | None = Header(default=None),
) -> dict[str, str]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Sign in as an administrator first.")

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Your session is invalid. Sign in again.")

    caller_client, admin_client = _clients()
    try:
        auth_result = caller_client.auth.get_user(token)
        actor_user = auth_result.user
    except Exception as exc:
        logger.info("Staff invite rejected because the access token was invalid: %s", exc)
        raise HTTPException(status_code=401, detail="Your session is invalid or expired.") from exc

    if actor_user is None:
        raise HTTPException(status_code=401, detail="Your session is invalid or expired.")

    try:
        actor_result = (
            admin_client.table("staff_profiles")
            .select("role,is_active")
            .eq("user_id", str(actor_user.id))
            .maybe_single()
            .execute()
        )
        actor = actor_result.data
    except Exception as exc:
        logger.exception("Failed to verify administrator permissions")
        raise HTTPException(status_code=500, detail="Could not verify administrator access.") from exc

    if not actor or actor.get("role") != "admin" or actor.get("is_active") is not True:
        raise HTTPException(status_code=403, detail="Only an active administrator can add staff.")

    email = str(payload.email).strip().lower()
    display_name = payload.displayName.strip()
    if not display_name:
        raise HTTPException(status_code=422, detail="Enter a staff name.")

    ward_id = str(payload.wardId) if payload.wardId else None
    if payload.role == "nurse_station":
        if not ward_id:
            raise HTTPException(status_code=422, detail="Select a ward for Nurse Station staff.")
        try:
            ward_result = (
                admin_client.table("wards")
                .select("id")
                .eq("id", ward_id)
                .eq("is_active", True)
                .maybe_single()
                .execute()
            )
        except Exception as exc:
            logger.exception("Failed to verify selected ward")
            raise HTTPException(status_code=500, detail="Could not verify the selected ward.") from exc
        if not ward_result.data:
            raise HTTPException(status_code=422, detail="Select an active ward.")

    try:
        existing = (
            admin_client.table("staff_profiles")
            .select("user_id")
            .ilike("email", email)
            .limit(1)
            .execute()
        )
        if existing.data:
            raise HTTPException(status_code=409, detail="A staff profile already uses this email.")
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to check for duplicate staff email")
        raise HTTPException(status_code=500, detail="Could not check the staff email.") from exc

    try:
        created = admin_client.auth.admin.create_user({
            "email": email,
            "password": payload.password,
            "email_confirm": True,
            "user_metadata": {
                "display_name": display_name,
                "hms_role": payload.role,
                "must_change_password": True,
            },
        })
        new_user = created.user
        if new_user is None:
            raise RuntimeError("Supabase did not return the new user.")
    except Exception as exc:
        logger.exception("Failed to create Supabase Auth user")
        raise HTTPException(status_code=400, detail="Could not create the staff login. Check the email and password.") from exc

    try:
        admin_client.table("staff_profiles").insert({
            "user_id": str(new_user.id),
            "email": email,
            "display_name": display_name,
            "role": payload.role,
            "ward_id": ward_id if payload.role == "nurse_station" else None,
            "is_active": True,
        }).execute()
    except Exception as exc:
        logger.exception("Staff profile insert failed; rolling back Auth user")
        try:
            admin_client.auth.admin.delete_user(str(new_user.id))
        except Exception:
            logger.exception("Could not roll back Auth user after profile insert failure")
        raise HTTPException(status_code=500, detail="Could not create the staff profile. Check the database schema before retrying.") from exc

    try:
        admin_client.table("audit_logs").insert({
            "actor_id": str(actor_user.id),
            "action": "staff.created",
            "entity_type": "staff_profile",
            "entity_id": str(new_user.id),
            "details": {
                "email": email,
                "display_name": display_name,
                "role": payload.role,
                "ward_id": ward_id if payload.role == "nurse_station" else None,
            },
        }).execute()
    except Exception:
        # Do not report failure after the account was created: the caller might retry and create confusion.
        logger.exception("Staff was created but audit logging failed for user %s", new_user.id)

    return {
        "userId": str(new_user.id),
        "email": email,
        "displayName": display_name,
        "role": payload.role,
        "message": "Staff account created successfully.",
    }
