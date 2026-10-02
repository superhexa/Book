import os
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://bookfield-app.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@turfbook.com", "password": "Admin@12345"}
OWNER = {"email": "owner@turfbook.com", "password": "Owner@12345"}
PLAYER = {"email": "player@turfbook.com", "password": "Player@12345"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"login failed {creds['email']}: {r.status_code} {r.text}"
    return r.json()


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def api():
    return API


@pytest.fixture(scope="session")
def admin_token():
    return _login(ADMIN)["access_token"]


@pytest.fixture(scope="session")
def owner_token():
    return _login(OWNER)["access_token"]


@pytest.fixture(scope="session")
def player_token():
    return _login(PLAYER)["access_token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return _auth(admin_token)


@pytest.fixture(scope="session")
def owner_headers(owner_token):
    return _auth(owner_token)


@pytest.fixture(scope="session")
def player_headers(player_token):
    return _auth(player_token)


@pytest.fixture
def unique_email():
    return f"TEST_user_{int(time.time()*1000)}@turfbook.local"
