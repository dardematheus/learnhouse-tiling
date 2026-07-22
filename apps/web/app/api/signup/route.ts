import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Signup gateway — DISABLED on this deployment.
//
// Self sign-up is turned off: only organization administrators may create
// accounts, from the "Create user" tab in the org dashboard (which posts
// directly to the backend at /api/v1/orgs/{org_id}/users). Any signup attempt
// is rejected here at the edge, so the public account-creation endpoints
// (/api/v1/users, /api/v1/users/{org_id}, .../invite/{code}) cannot be reached
// even by a direct API call.
//
// To re-enable public self-registration, restore the previous gateway logic
// from version control (the original ran Turnstile + disposable-email anti-
// abuse checks in SaaS mode and proxied to the /users create endpoints):
//   git checkout HEAD -- app/api/signup/route.ts   # before this change

export async function POST(_request: NextRequest) {
  return NextResponse.json(
    { detail: 'Sign-up is disabled. An administrator must create your account.' },
    { status: 403 },
  )
}
