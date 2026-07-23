"""Tests for the third_party_login OAuth handler in src/routers/auth.py.

On this fork third-party (Google) sign-in is disabled: ``third_party_login``
hard-rejects with 403 before doing any OAuth / invite work, so no account can be
auto-provisioned via OAuth. (The login-wordpress SSO is unaffected — it injects
session cookies directly and never calls this handler.)
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException, Response, status

from src.db.users import AnonymousUser
from src.routers.auth import third_party_login


@pytest.mark.asyncio
async def test_third_party_login_is_disabled_for_google():
    body = SimpleNamespace(
        email="user@example.com",
        provider="google",
        access_token="tok",
    )

    with patch("src.routers.auth.signWithGoogle", new_callable=AsyncMock) as google_mock:
        with pytest.raises(HTTPException) as exc_info:
            await third_party_login(
                request=SimpleNamespace(),
                response=Response(),
                body=body,
                org_id=None,
                current_user=AnonymousUser(),
                db_session=AsyncMock(),
            )

    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
    assert "disabled" in exc_info.value.detail.lower()
    google_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_third_party_login_disabled_before_provider_check():
    # A non-google provider used to reach the "Unsupported provider" branch
    # (400); the disable guard now fires first, so it is a 403 and no provider
    # logic runs.
    body = SimpleNamespace(
        email="user@example.com",
        provider="facebook",
        access_token="tok",
    )

    with pytest.raises(HTTPException) as exc_info:
        await third_party_login(
            request=SimpleNamespace(),
            response=Response(),
            body=body,
            org_id=None,
            current_user=AnonymousUser(),
            db_session=AsyncMock(),
        )

    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
    assert "disabled" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_third_party_login_disabled_before_org_invite_validation(db, org):
    # Even with a valid org_id the handler rejects before touching Redis/invites.
    body = SimpleNamespace(
        email="invitee@example.com",
        provider="facebook",
        access_token="tok",
    )

    with patch("redis.Redis.from_url") as redis_mock:
        with pytest.raises(HTTPException) as exc_info:
            await third_party_login(
                request=SimpleNamespace(),
                response=Response(),
                body=body,
                org_id=org.id,
                current_user=AnonymousUser(),
                db_session=db,
            )

    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
    assert "disabled" in exc_info.value.detail.lower()
    # The Redis invite lookup must never happen.
    redis_mock.assert_not_called()
