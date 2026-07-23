'use client'
import React from 'react'
import { useOrg } from '@components/Contexts/OrgContext'
import { getActivityMediaDirectory, getActivityVideoStreamUrl } from '@services/media/media'
import LearnHousePlayer from '@components/Objects/Activities/Video/LearnHousePlayer'
import ViewOnlyPdf from '@components/Objects/Activities/DocumentPdf/ViewOnlyPdf'

interface TilingActivityProps {
  activity: any
  course: any
  orgUuid?: string
  className?: string
}

/**
 * Tiling activity viewer: a hosted video on the left and a PDF document on the
 * right, each in its own independently-scrolling pane. The PDF is rendered with
 * the shared view-only renderer (pdf.js → <canvas>) and the video is an isolated
 * player, so scrolling/interacting with the PDF never pauses the video, and
 * vice-versa.
 *
 * The video reuses the existing LearnHousePlayer with a progressive MP4 stream
 * (the player's native fallback path). The PDF uses ViewOnlyPdf (same component
 * as the standalone PDF activity) pointing at the conventional documentpdf/
 * storage folder — view-only, no download button / native toolbar / print.
 */
function TilingActivity({ activity, course, orgUuid, className }: TilingActivityProps) {
  const org = useOrg() as any
  const resolvedOrgUuid = orgUuid || org?.org_uuid
  const courseUuid = course?.course_uuid
  const activityUuid = activity?.activity_uuid

  const videoFilename = activity?.content?.video_filename
  const pdfFilename = activity?.content?.pdf_filename

  const videoSrc =
    videoFilename && resolvedOrgUuid && courseUuid && activityUuid
      ? getActivityVideoStreamUrl(resolvedOrgUuid, courseUuid, activityUuid, videoFilename)
      : ''

  const pdfSrc =
    pdfFilename && resolvedOrgUuid && courseUuid && activityUuid
      ? getActivityMediaDirectory(resolvedOrgUuid, courseUuid, activityUuid, pdfFilename, 'documentpdf')
      : ''

  return (
    <div className={className ?? 'w-full'}>
      <div className="flex flex-col lg:flex-row gap-4 h-[78vh] sm:h-[800px]">
        {/* Left pane: video */}
        <div className="flex-1 min-w-0 flex items-center justify-center min-h-[280px]">
          <div className="relative h-full aspect-video max-w-full sm:rounded-lg overflow-hidden ring-0 sm:ring-1 sm:ring-gray-200/10 sm:dark:ring-gray-700/20 bg-black">
            {videoSrc ? (
              <LearnHousePlayer
                key={videoSrc}
                src={videoSrc}
                isHls={false}
                details={activity.details}
              />
            ) : null}
          </div>
        </div>

        {/* Right pane: PDF (iframe scrolls independently of the video) */}
        <div className="flex-1 min-w-0 min-h-[280px]">
          <div className="w-full h-full bg-white sm:rounded-lg overflow-hidden nice-shadow">
            {pdfSrc ? (
              <ViewOnlyPdf key={pdfSrc} url={pdfSrc} className="w-full h-full" />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TilingActivity
