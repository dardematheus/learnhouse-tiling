from typing import Optional

from fastapi import HTTPException, Request, UploadFile, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from uuid import uuid4
from datetime import datetime

from src.db.courses.activities import (
    Activity,
    ActivityRead,
    ActivitySubTypeEnum,
    ActivityTypeEnum,
)
from src.db.courses.chapter_activities import ChapterActivity
from src.db.courses.chapters import Chapter
from src.db.courses.course_chapters import CourseChapter
from src.db.courses.courses import Course
from src.db.organizations import Organization
from src.db.users import AnonymousUser, PublicUser
from src.security.rbac import AccessAction, check_resource_access
from src.services.courses.activities.uploads.pdfs import upload_pdf
from src.services.courses.activities.uploads.videos import upload_video


async def create_tiling_activity(
    request: Request,
    name: str,
    chapter_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
    video_file: UploadFile | None = None,
    pdf_file: UploadFile | None = None,
    extra_metadata: Optional[dict] = None,
):
    """Create a Tiling activity: one activity that stores a hosted video and a
    PDF document, displayed side by side. Mirrors create_video_activity and
    create_documentpdf_activity, uploading each file through its existing
    helper (so they land in the conventional video/ and documentpdf/ folders)
    and recording both filenames in the activity's JSON ``content`` column."""

    # get chapter_id
    statement = select(Chapter).where(Chapter.id == chapter_id)
    chapter = (await db_session.execute(statement)).scalars().first()

    if not chapter:
        raise HTTPException(
            status_code=404,
            detail="Chapter not found",
        )

    statement = select(CourseChapter).where(CourseChapter.chapter_id == chapter_id)
    coursechapter = (await db_session.execute(statement)).scalars().first()

    if not coursechapter:
        raise HTTPException(
            status_code=404,
            detail="CourseChapter not found",
        )

    # Get course_uuid for RBAC check
    statement = select(Course).where(Course.id == coursechapter.course_id)
    course = (await db_session.execute(statement)).scalars().first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found",
        )

    # RBAC check
    await check_resource_access(
        request, db_session, current_user, course.course_uuid, AccessAction.CREATE
    )

    # Get org_uuid
    statement = select(Organization).where(Organization.id == coursechapter.org_id)
    organization = (await db_session.execute(statement)).scalars().first()

    # generate activity_uuid
    activity_uuid = str(f"activity_{uuid4()}")

    # Validate + upload the video leg
    if not video_file or not video_file.filename:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tiling : No video file provided",
        )
    if video_file.content_type not in ["video/mp4", "video/webm"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tiling : Wrong video format",
        )

    # Validate + upload the PDF leg
    if not pdf_file or not pdf_file.filename:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tiling : No pdf file provided",
        )
    if pdf_file.content_type not in ["application/pdf"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tiling : Wrong pdf format",
        )

    saved_video_filename = None
    saved_pdf_filename = None
    if organization and course:
        saved_video_filename = await upload_video(
            video_file,
            activity_uuid,
            organization.org_uuid,
            course.course_uuid,
        )
        saved_pdf_filename = await upload_pdf(
            pdf_file,
            activity_uuid,
            organization.org_uuid,
            course.course_uuid,
        )

    activity = Activity(
        name=name,
        activity_type=ActivityTypeEnum.TYPE_TILING,
        activity_sub_type=ActivitySubTypeEnum.SUBTYPE_TILING_VIDEO_PDF,
        activity_uuid=activity_uuid,
        org_id=coursechapter.org_id,
        course_id=coursechapter.course_id,
        content={
            "video_filename": saved_video_filename or "video",
            "pdf_filename": saved_pdf_filename or "documentpdf",
            "activity_uuid": activity_uuid,
        },
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
        extra_metadata=extra_metadata,
    )

    # create activity
    db_session.add(activity)
    await db_session.commit()
    await db_session.refresh(activity)

    # Find the last activity order in the chapter
    statement = (
        select(ChapterActivity)
        .where(ChapterActivity.chapter_id == chapter.id)
        .order_by(ChapterActivity.order)  # type: ignore
    )
    chapter_activities = (await db_session.execute(statement)).scalars().all()
    last_order = chapter_activities[-1].order if chapter_activities else 0
    to_be_used_order = last_order + 1

    # update chapter
    chapter_activity_object = ChapterActivity(
        chapter_id=chapter.id,  # type: ignore
        activity_id=activity.id,  # type: ignore
        course_id=coursechapter.course_id,
        org_id=coursechapter.org_id,
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
        order=to_be_used_order,
    )

    # Insert ChapterActivity link in DB
    db_session.add(chapter_activity_object)
    await db_session.commit()

    # NOTE: HLS transcoding is intentionally NOT enqueued here. The tiling
    # video leg is served as a progressive MP4 stream (the player's native
    # fallback). The HLS reconciler only processes SUBTYPE_VIDEO_HOSTED
    # activities, so this activity is left untouched. Wiring HLS for tiling
    # later would mean extending hls_jobs._resolve_source / _pending_targets
    # to also accept SUBTYPE_TILING_VIDEO_PDF.

    return ActivityRead.model_validate(activity)


async def update_tiling_activity(
    request: Request,
    activity_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
    name: Optional[str] = None,
    video_file: UploadFile | None = None,
    pdf_file: UploadFile | None = None,
) -> ActivityRead:
    statement = select(Activity).where(Activity.activity_uuid == activity_uuid)
    activity = (await db_session.execute(statement)).scalars().first()

    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    statement = select(Course).where(Course.id == activity.course_id)
    course = (await db_session.execute(statement)).scalars().first()

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    await check_resource_access(
        request, db_session, current_user, course.course_uuid, AccessAction.UPDATE
    )

    if name:
        activity.name = name

    content = dict(activity.content) if activity.content else {}

    statement = select(Organization).where(Organization.id == activity.org_id)
    organization = (await db_session.execute(statement)).scalars().first()

    if organization and course:
        if video_file and video_file.filename:
            if video_file.content_type not in ["video/mp4", "video/webm"]:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Tiling : Wrong video format",
                )
            content["video_filename"] = await upload_video(
                video_file,
                activity_uuid,
                organization.org_uuid,
                course.course_uuid,
            )

        if pdf_file and pdf_file.filename:
            if pdf_file.content_type not in ["application/pdf"]:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Tiling : Wrong pdf format",
                )
            content["pdf_filename"] = await upload_pdf(
                pdf_file,
                activity_uuid,
                organization.org_uuid,
                course.course_uuid,
            )

    activity.content = content
    from sqlalchemy.orm.attributes import flag_modified

    flag_modified(activity, "content")

    activity.update_date = str(datetime.now())
    db_session.add(activity)
    await db_session.commit()
    await db_session.refresh(activity)

    return ActivityRead.model_validate(activity)
