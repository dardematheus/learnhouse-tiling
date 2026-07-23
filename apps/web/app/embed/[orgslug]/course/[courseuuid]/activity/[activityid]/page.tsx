import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth/server'
import EmbedActivityClient from './EmbedActivityClient'

type PageProps = {
  params: Promise<{ orgslug: string; courseuuid: string; activityid: string }>
  searchParams: Promise<{ bgcolor?: string }>
}

const HEX_COLOR_RE = /^[0-9a-fA-F]{3,8}$/

function sanitizeBgColor(raw: string | undefined): string | null {
  if (!raw) return null
  return HEX_COLOR_RE.test(raw) ? `#${raw}` : null
}

export default async function EmbedActivityPage({ params, searchParams }: PageProps) {
  const { orgslug, courseuuid, activityid } = await params

  // /embed/* is excluded from the proxy login-gate matcher, so enforce the
  // session here: an anonymous visitor must not read private course content
  // via the embed route. Mirrors the gate every other page relies on.
  const session = await getServerSession()
  if (!session) {
    const embedPath = `/embed/${orgslug}/course/${courseuuid}/activity/${activityid}`
    redirect(`/login?redirect=${encodeURIComponent(embedPath)}`)
  }

  const sp = await searchParams
  const bgcolor = sanitizeBgColor(sp.bgcolor)

  return (
    <>
      {bgcolor && <style>{`html,body{background-color:${bgcolor}!important}`}</style>}
      <EmbedActivityClient
        activityId={activityid}
        courseuuid={courseuuid}
        orgslug={orgslug}
        bgcolor={bgcolor}
      />
    </>
  )
}
