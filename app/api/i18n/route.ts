import { NextRequest, NextResponse } from 'next/server'
import ES from '@/messages/es.json'

export async function GET(req: NextRequest) {
  return NextResponse.json(ES, {
    headers: { 'Cache-Control': 'public, max-age=3600' }
  })
}
