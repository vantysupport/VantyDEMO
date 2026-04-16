import { NextResponse } from 'next/server'
export async function GET() {
  const url = process.env.WSP_SERVICE_URL
  const secret = process.env.WSP_SERVICE_SECRET
  if (!url || !secret) return NextResponse.json({ unconfigured: true })
  try {
    const res = await fetch(`${url}/qr`, {
      headers: { 'x-service-secret': secret },
      signal: AbortSignal.timeout(8000),
    })
    return NextResponse.json(await res.json())
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 503 })
  }
}
