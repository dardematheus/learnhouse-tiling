import { getAPIUrl } from '@services/config/config'
import {
  RequestBodyWithAuthHeader,
  getResponseMetadata,
} from '@services/utils/ts/requests'

/**
 * Admin-only user creation. Mirrors the service shape used by the rest of the
 * org dashboard (see services/organizations/invites.ts): POST with an auth
 * header, then unwrap via getResponseMetadata so callers get { success, data,
 * status, HTTPmessage }.
 *
 * On success `data` contains the created user plus the one-time generated
 * username/password and an `email_sent` flag (the credentials email degrades
 * gracefully — the user is still created if the mailer fails).
 */
export async function createOrgUser(
  org_id: any,
  name: string,
  username: string,
  email: string,
  access_token: any
) {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/users`,
    RequestBodyWithAuthHeader(
      'POST',
      { name, username, email },
      null,
      access_token
    )
  )
  const res = await getResponseMetadata(result)
  return res
}
