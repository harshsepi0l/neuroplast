# Neuroplast: Grok connections

Status: implemented flow; live registration and inference verification pending  
Updated: October 24, 2026

Neuroplast is a Next.js website with one interface and one learning engine.
Grok is the first subscription integration. The existing Pi agent runtime runs
guided lessons, practice, quizzes, plans, research, artifacts, extraction, and
compaction behind Neuroplast's EasyUI workspace. The application-wide context
map is documented in [architecture.md](architecture.md).

## Connection lifecycle

Connections owns the subscription record, provider adapter, account projection,
available models, selected model, token refresh, revocation, and consent for
background use. Identity provides an opaque browser session; model credentials
remain on the server and are encrypted with AES-256-GCM using that owner ID as
authenticated data.

The server begins an RFC 8628 device authorization flow. The browser shows the
provider's verification URL and user code, then polls on the provider's schedule.
Authorization pending and slow-down responses update the next poll time. On
approval, the server fetches the account and model list and stores encrypted
credentials. Optimistic revisions and leases coordinate concurrent requests.

The xAI discovery document used by the adapter is
[the provider's OpenID configuration](https://auth.x.ai/.well-known/openid-configuration).
It advertises device authorization, authorization-code, token, user-info,
revocation, and JWKS endpoints. The current adapter uses:

| Operation | Endpoint |
| --- | --- |
| Device authorization | `https://auth.x.ai/oauth2/device/code` |
| Token exchange and refresh | `https://auth.x.ai/oauth2/token` |
| Account | `https://auth.x.ai/oauth2/userinfo` |
| Revoke | `https://auth.x.ai/oauth2/revoke` |
| Models | `https://api.x.ai/v1/models` |

Protocol availability alone does not establish that a particular client
registration or account may spend a Grok subscription allowance. The registration,
approved scopes, account entitlement, and inference behavior must be verified
with xAI before describing hosted subscription access as production-ready.

## Configuration

Set `XAI_OAUTH_CLIENT_ID` to a registration authorized for your deployment.
No third-party application's client ID is embedded. Public clients can omit
`XAI_OAUTH_CLIENT_SECRET`; confidential clients can provide it on the server.
The configurable default scopes are `openid profile email offline_access api:access`.
They must match the registration's approved scope set.

Without a client ID, Connections shows an explicit setup notice and disables
the sign-in button. It does not simulate a successful connection. Model access
depends on what xAI returns. An empty or failed discovery remains visible.

Production also needs a stable 32-byte base64 `NEUROPLAST_CREDENTIAL_KEY`,
HTTPS, the canonical `NEUROPLAST_ORIGIN`, persistent storage, and
`NEUROPLAST_WORKSPACE_PASSWORD`. Development generates a local encryption key
under `.neuroplast`; that key and credentials are excluded from source control.

## Integration with Learning

Connection status and model discovery feed the same catalog used by Learning's
model controls. The first connected Grok model can initialize unconfigured
strong, cheap, and vision slots when it is present in the Pi catalog. Existing
model selections remain intact.

All learning API handlers establish the browser's request context. The Pi
provider adapter resolves that owner's access token per dispatch; tokens are
never copied into client state or a process-wide environment variable.
API-key providers can still be configured through Preferences.

Research and knowledge extraction can consume model allowance in the
background. Grok exposes an explicit background-use switch, initially off.
Disconnect removes the local credential before attempting remote revocation.
Failure to confirm provider-side revocation is shown to the user.

## Deployment boundary

The current Learning, Knowledge, Artifacts, and Preferences stores form one
private server workspace. Grok credentials are browser-owned, but learning
records are not tenant-scoped. The production proxy protects the workspace and
checks mutation origins. A public multi-user service requires a Workspace
ownership model and corresponding persistence changes first.

There is no Electron process, desktop download, or shared borrowed CLI login.
Optional Chrome rendering runs on the server for interactive artifacts.

## Verification still required with a real registration

Confirm approval, denial, expiry, refresh, model discovery, and an actual tutoring
turn. Check that subscription-backed inference is authorized for the deployment,
that available model IDs match the runtime catalog, and that background-consent
and disconnect behavior apply to real requests. Local page/API checks and a
successful production build cannot establish these provider entitlements.

Other subscription providers are future integrations. Their adapters can live in
Connections without changing the Learning aggregate or replacing the UI.
