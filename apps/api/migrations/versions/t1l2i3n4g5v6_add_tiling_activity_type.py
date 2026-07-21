"""Add tiling activity type

Revision ID: t1l2i3n4g5v6
Revises: r5s6t7u8v9w0
Create Date: 2026-07-21 00:00:00.000000

Adds TYPE_TILING to activitytypeenum and SUBTYPE_TILING_VIDEO_PDF to
activitysubtypeenum so a course activity can render a hosted video and a
PDF document side by side (video on the left, PDF on the right) under a
single new TYPE_TILING type.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401
import sqlmodel  # noqa: F401
from alembic_postgresql_enum import TableReference  # type: ignore

# revision identifiers, used by Alembic.
revision: str = 't1l2i3n4g5v6'
down_revision: Union[str, None] = 'r5s6t7u8v9w0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add TYPE_TILING to activitytypeenum
    op.sync_enum_values(
        'public',
        'activitytypeenum',
        ['TYPE_VIDEO', 'TYPE_DOCUMENT', 'TYPE_DYNAMIC', 'TYPE_ASSIGNMENT', 'TYPE_CUSTOM', 'TYPE_SCORM', 'TYPE_TILING'],
        [TableReference(table_schema='public', table_name='activity', column_name='activity_type')],
        enum_values_to_rename=[]
    )

    # Add SUBTYPE_TILING_VIDEO_PDF to activitysubtypeenum
    op.sync_enum_values(
        'public',
        'activitysubtypeenum',
        ['SUBTYPE_DYNAMIC_PAGE', 'SUBTYPE_DYNAMIC_MARKDOWN', 'SUBTYPE_DYNAMIC_EMBED', 'SUBTYPE_DYNAMIC_RESOURCE', 'SUBTYPE_VIDEO_YOUTUBE', 'SUBTYPE_VIDEO_HOSTED', 'SUBTYPE_DOCUMENT_PDF', 'SUBTYPE_DOCUMENT_DOC', 'SUBTYPE_ASSIGNMENT_ANY', 'SUBTYPE_CUSTOM', 'SUBTYPE_SCORM_12', 'SUBTYPE_SCORM_2004', 'SUBTYPE_TILING_VIDEO_PDF'],
        [TableReference(table_schema='public', table_name='activity', column_name='activity_sub_type')],
        enum_values_to_rename=[]
    )


def downgrade() -> None:
    # Revert activitytypeenum
    op.sync_enum_values(
        'public',
        'activitytypeenum',
        ['TYPE_VIDEO', 'TYPE_DOCUMENT', 'TYPE_DYNAMIC', 'TYPE_ASSIGNMENT', 'TYPE_CUSTOM', 'TYPE_SCORM'],
        [TableReference(table_schema='public', table_name='activity', column_name='activity_type')],
        enum_values_to_rename=[]
    )

    # Revert activitysubtypeenum
    op.sync_enum_values(
        'public',
        'activitysubtypeenum',
        ['SUBTYPE_DYNAMIC_PAGE', 'SUBTYPE_DYNAMIC_MARKDOWN', 'SUBTYPE_DYNAMIC_EMBED', 'SUBTYPE_DYNAMIC_RESOURCE', 'SUBTYPE_VIDEO_YOUTUBE', 'SUBTYPE_VIDEO_HOSTED', 'SUBTYPE_DOCUMENT_PDF', 'SUBTYPE_DOCUMENT_DOC', 'SUBTYPE_ASSIGNMENT_ANY', 'SUBTYPE_CUSTOM', 'SUBTYPE_SCORM_12', 'SUBTYPE_SCORM_2004'],
        [TableReference(table_schema='public', table_name='activity', column_name='activity_sub_type')],
        enum_values_to_rename=[]
    )
