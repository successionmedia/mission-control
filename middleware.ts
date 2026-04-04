// middleware.ts
import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PREFIXES = ['/share/', '/login', '/api/auth/']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const isPublic = PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  if (isPublic) return NextResponse.next()

  const cookie = req.cookies.get('mc_auth')
  if (cookie?.value === process.env.AUTH_SECRET) return NextResponse.next()

  const loginUrl = req.nextUrl.clone()
  loginUrl.pathname = '/login'
  loginUrl.searchParams.set('from', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
