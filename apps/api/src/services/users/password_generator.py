"""
Random password generator for admin-created accounts.

Produces a strong password that satisfies ``validate_password_complexity``
(minimum 8 characters; at least one uppercase letter, lowercase letter, digit
and special character). Used when an administrator creates a user so a one-time
credential can be emailed and shown once in the dashboard.

Mirrors the ``secrets``-based approach of
``src.services.users.password_reset.generate_secure_reset_code``.
"""
import secrets
import string

from src.services.security.password_validation import validate_password_complexity

_UPPER = string.ascii_uppercase
_LOWER = string.ascii_lowercase
_DIGITS = string.digits
# Keep special chars inside the set accepted by validate_password_complexity.
_SPECIAL = "!@#$%^&*"
_ALPHABET = _UPPER + _LOWER + _DIGITS + _SPECIAL


def generate_random_password(length: int = 16) -> str:
    """Generate a random password guaranteed to pass ``validate_password_complexity``.

    Seeds one character of each required class, fills the remainder from the full
    alphabet, then shuffles (Fisher–Yates with ``secrets``). A final validation
    guards against any future rule drift — if it ever fails, regenerate.
    """
    if length < 8:
        length = 8

    required = [
        secrets.choice(_UPPER),
        secrets.choice(_LOWER),
        secrets.choice(_DIGITS),
        secrets.choice(_SPECIAL),
    ]
    rest = [secrets.choice(_ALPHABET) for _ in range(length - len(required))]
    pool = required + rest

    for i in range(len(pool) - 1, 0, -1):
        j = secrets.randbelow(i + 1)
        pool[i], pool[j] = pool[j], pool[i]

    password = "".join(pool)

    if not validate_password_complexity(password).is_valid:
        return generate_random_password(length)

    return password
