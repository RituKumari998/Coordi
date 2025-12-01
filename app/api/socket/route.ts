import { NextResponse } from 'next/server'

export const GET = async () => {
  return NextResponse.json({ error: 'Socket.IO server is running separately. Connect to ws://localhost:4000.' }, { status: 400 })
} 