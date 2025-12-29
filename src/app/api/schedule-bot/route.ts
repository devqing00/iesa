import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const backend = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
    const url = `${backend.replace(/\/+$/,'')}/schedule-bot/chat`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let data: any = text;
    try {
      data = JSON.parse(text);
    } catch (e) {
      // response was not JSON
    }

    if (!response.ok) {
      console.error('Backend error', response.status, data);
      return NextResponse.json({ error: 'Backend error', details: data }, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error proxying to backend:', error);
    return NextResponse.json({ reply: 'Error communicating with backend.' }, { status: 500 });
  }
}