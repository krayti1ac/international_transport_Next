import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { serverUrl, apiKey, username, password } = body;

    if (!serverUrl) {
      return NextResponse.json({ error: 'Server URL is required' }, { status: 400 });
    }

    const baseUrl = serverUrl.replace(/\/$/, '');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    } else if (username && password) {
      const auth = Buffer.from(`${username}:${password}`).toString('base64');
      headers['Authorization'] = `Basic ${auth}`;
    }

    const response = await fetch(`${baseUrl}/api/devices`, { headers, next: { revalidate: 0 } });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Traccar API error: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    const devices = await response.json();
    return NextResponse.json({ success: true, deviceCount: devices.length, devices });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
