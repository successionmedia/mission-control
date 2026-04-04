import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { password } = await req.json()

  if (!process.env.TEAM_PASSWORD || !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Auth not configured' }, { status: 500 })
  }

  if (password !== process.env.TEAM_PASSWORD) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('mc_auth', process.env.AUTH_SECRET, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })
  return res
}
