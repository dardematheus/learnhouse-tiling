import { useOrg } from '@components/Contexts/OrgContext'
import { getActivityMediaDirectory } from '@services/media/media'
import ViewOnlyPdf from './ViewOnlyPdf'

function DocumentPdfActivity({
  activity,
  course,
  orgUuid,
  className,
}: {
  activity: any
  course: any
  orgUuid?: string
  className?: string
}) {
  const org = useOrg() as any
  const resolvedOrgUuid = orgUuid || org?.org_uuid

  // Rendered through ViewOnlyPdf (pdf.js → <canvas>): view-only, no Download
  // button / native toolbar / print, so the document can be read but not saved
  // from the reader. See ViewOnlyPdf for the details/limitations.
  const url = getActivityMediaDirectory(
    resolvedOrgUuid,
    course?.course_uuid,
    activity.activity_uuid,
    activity.content.filename,
    'documentpdf'
  )

  return (
    <div className={className ?? "m-0 sm:m-8 bg-zinc-900 sm:rounded-md mt-0 sm:mt-14"}>
      <ViewOnlyPdf
        url={url}
        className={className ? "w-full h-full" : "sm:rounded-lg w-full h-[85vh] sm:h-[900px]"}
      />
    </div>
  )
}

export default DocumentPdfActivity
