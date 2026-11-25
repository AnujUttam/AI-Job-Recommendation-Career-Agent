from fastapi.testclient import TestClient

from app.config import settings
from app.main import app

client = TestClient(app)


def test_health_endpoint_returns_ok(monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", "")
    monkeypatch.setattr(settings, "internal_api_key", "test-secret")

    response = client.get("/health")
    assert response.status_code == 200

    data = response.json()
    assert data["success"] is True
    assert data["service"] == "careerai-ai-service"
    assert data["status"] == "ok"
    assert data["dependencies"]["gemini_configured"] is False
    assert data["dependencies"]["gemini_model"] == settings.gemini_model
    assert data["dependencies"]["internal_auth_configured"] is True
