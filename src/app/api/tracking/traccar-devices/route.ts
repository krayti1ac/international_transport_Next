import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { configId } = body;

    if (!configId) {
      return NextResponse.json({ error: 'Config ID is required' }, { status: 400 });
    }

    const { data: config, error: configError } = await supabase
      .from('traccar_configs')
      .select('*')
      .eq('id', configId)
      .single();

    if (configError || !config) {
      return NextResponse.json({ error: 'Traccar config not found' }, { status: 404 });
    }

    const baseUrl = config.traccar_server_url.replace(/\/$/, '');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (config.traccar_api_key) {
      headers['Authorization'] = `Bearer ${config.traccar_api_key}`;
    } else if (config.traccar_username && config.traccar_password) {
      const auth = Buffer.from(`${config.traccar_username}:${config.traccar_password}`).toString('base64');
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
    return NextResponse.json({ devices });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
