from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_endpoint_returns_ok() -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["service"] == "hms-api"


def test_staff_invitation_requires_bearer_token() -> None:
    response = client.post(
        "/api/admin/staff/invite",
        json={
            "email": "staff@example.com",
            "displayName": "Example Staff",
            "password": "SafePassword123!",
            "role": "info_officer",
        },
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Sign in as an administrator first."


def test_staff_invitation_rejects_invalid_role_before_auth() -> None:
    response = client.post(
        "/api/admin/staff/invite",
        json={
            "email": "staff@example.com",
            "displayName": "Example Staff",
            "password": "SafePassword123!",
            "role": "superuser",
        },
    )

    assert response.status_code == 422
