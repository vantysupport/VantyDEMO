import { NextRequest, NextResponse } from 'next/server'
export async function POST(req: NextRequest) {
  const url = process.env.WSP_SERVICE_URL
  const secret = process.env.WSP_SERVICE_SECRET
  if (!url || !secret) return NextResponse.json({ error: 'Servicio no configurado' }, { status: 503 })
  try {
    const body = await req.json()
    const res = await fetch(`${url}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-service-secret': secret },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    })
    return NextResponse.json(await res.json(), { status: res.ok ? 200 : res.status })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 503 })
  }
}
