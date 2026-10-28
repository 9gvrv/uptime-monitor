from datetime import UTC, datetime

from fastapi.testclient import TestClient

from app.db.session import get_db
from app.main import create_app
from app.modules.auth import services

SIGNUP_PAYLOAD = {
    "email": "new@example.com",
    "password": "correct-horse",
    "password_repeat": "correct-horse",
}


class FakeUser:
    id = 7
    email = "new@example.com"
    created_at = datetime(2026, 1, 1, tzinfo=UTC)


def make_client(monkeypatch, create_user) -> TestClient:
    monkeypatch.setattr(services, "create_user", create_user)
    app = create_app()
    app.dependency_overrides[get_db] = lambda: None
    return TestClient(app)


def test_signup_returns_created_user_without_credentials(monkeypatch) -> None:
    async def create_user(*args, **kwargs):
        return FakeUser()

    client = make_client(monkeypatch, create_user)
    response = client.post("/api/v1/auth/signup", json=SIGNUP_PAYLOAD)

    assert response.status_code == 201
    body = response.json()
    assert body["id"] == 7
    assert body["email"] == "new@example.com"
    assert "created_at" in body
    assert "password" not in body
    assert "password_hash" not in body


def test_signup_duplicate_email_returns_409(monkeypatch) -> None:
    async def create_user(*args, **kwargs):
        raise services.EmailAlreadyExistsError

    client = make_client(monkeypatch, create_user)
    response = client.post("/api/v1/auth/signup", json=SIGNUP_PAYLOAD)

    assert response.status_code == 409


def test_signup_mismatched_passwords_returns_422(monkeypatch) -> None:
    async def create_user(*args, **kwargs):
        raise AssertionError("service must not be called for invalid input")

    client = make_client(monkeypatch, create_user)
    response = client.post(
        "/api/v1/auth/signup",
        json={**SIGNUP_PAYLOAD, "password_repeat": "different-password"},
    )

    assert response.status_code == 422
