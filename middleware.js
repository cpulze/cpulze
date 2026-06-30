const STAGING_HOSTS = [
  'app.stage.cpulze.com',
  'stage.cpulze.com',
  'stage2.cpulze.com',
]

function isStaging(hostname) {
  return STAGING_HOSTS.includes(hostname) || hostname.includes('cpulze-git-staging')
}

// /strategy is locked to the stage2 host alone (plus local dev), regardless of
// which branch the code lives on. Merging stage2 into main will not expose it
// on the production domain — the host check fails there structurally.
function isStrategyHost(hostname) {
  return hostname === 'stage2.cpulze.com'
    || hostname.startsWith('localhost')
    || hostname.includes('cpulze-git-staging')
}

function checkBasicAuth(request, user, pass) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Basic ') || !user || !pass) return false
  const decoded = atob(authHeader.slice(6))
  const colonIndex = decoded.indexOf(':')
  const u = decoded.slice(0, colonIndex)
  const p = decoded.slice(colonIndex + 1)
  return u === user && p === pass
}

function unauthorized(realm, message) {
  return new Response(message, {
    status: 401,
    headers: {
      'WWW-Authenticate': `Basic realm="${realm}", charset="UTF-8"`,
      'Content-Type': 'text/plain',
    },
  })
}

export const config = {
  matcher: '/((?!api/).*)',
}

export default function middleware(request) {
  const hostname = request.headers.get('host') || ''
  const { pathname } = new URL(request.url)

  // /strategy is gated independently of staging, with its own dedicated
  // credentials so it can be shared exclusively (e.g. with a mentor) without
  // handing out the general staging password. It only resolves on stage2 —
  // any other host gets a plain 404, on purpose (see isStrategyHost above).
  if (pathname.startsWith('/strategy')) {
    if (!isStrategyHost(hostname)) {
      return new Response('Not found', { status: 404 })
    }
    if (checkBasicAuth(request, process.env.STRATEGY_USER, process.env.STRATEGY_PASS)) return
    return unauthorized('cpulze strategy', 'Access restricted. Contact the site owner.')
  }

  if (!isStaging(hostname)) return

  if (checkBasicAuth(request, process.env.STAGING_USER, process.env.STAGING_PASS)) return

  return unauthorized('cpulze staging', 'Staging access restricted. Contact the site owner.')
}
