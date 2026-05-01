const STAGING_HOSTS = [
  'app.stage.cpulze.com',
  'stage.cpulze.com',
]

function isStaging(hostname) {
  return STAGING_HOSTS.includes(hostname) || hostname.includes('cpulze-git-staging')
}

export const config = {
  matcher: '/((?!api/).*)',
}

export default function middleware(request) {
  const hostname = request.headers.get('host') || ''

  if (!isStaging(hostname)) return

  const stagingUser = process.env.STAGING_USER
  const stagingPass = process.env.STAGING_PASS
  const authHeader = request.headers.get('authorization')

  if (authHeader?.startsWith('Basic ')) {
    const decoded = atob(authHeader.slice(6))
    const colonIndex = decoded.indexOf(':')
    const u = decoded.slice(0, colonIndex)
    const p = decoded.slice(colonIndex + 1)
    if (u === stagingUser && p === stagingPass) return
  }

  return new Response('Staging access restricted. Contact the site owner.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="cpulze staging", charset="UTF-8"',
      'Content-Type': 'text/plain',
    },
  })
}
