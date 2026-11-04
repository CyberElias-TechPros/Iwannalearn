import { getCurrentUser, userForSessionToken } from "./auth";

/** Native endpoints use explicit bearer credentials, never ambient cookies.
 * The existing multipart endpoint accepts both clients without weakening web CSRF posture. */
export async function requestUser(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization !== null) return authorization.startsWith("Bearer ") ? userForSessionToken(authorization.slice(7)) : null;
  return getCurrentUser();
}
