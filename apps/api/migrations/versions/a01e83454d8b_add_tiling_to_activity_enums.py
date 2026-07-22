"""add tiling to activity enums

Revision ID: a01e83454d8b
Revises: t1l2i3n4g5v6
Create Date: 2026-07-21 14:30:54.702190

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa # noqa: F401
import sqlmodel # noqa: F401


# revision identifiers, used by Alembic.
revision: str = 'a01e83454d8b'
down_revision: Union[str, None] = 't1l2i3n4g5v6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE activitytypeenum ADD VALUE IF NOT EXISTS 'TYPE_TILING'")
    op.execute("ALTER TYPE activitysubtypeenum ADD VALUE IF NOT EXISTS 'SUBTYPE_TILING_VIDEO_PDF'")


def downgrade() -> None:
    pass
