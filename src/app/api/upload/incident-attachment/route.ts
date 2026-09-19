import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';


export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const formData = await request.formData();

    const file = formData.get('file') as File | null;
    const incidentId = formData.get('incident_id') as string;
    const attachmentType = formData.get('attachment_type') as string;

    if (!file || !incidentId) {
      return NextResponse.json({ success: false, error: 'Missing file or incident_id' }, { status: 400 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('users').select('company_id').eq('id', user?.id).maybeSingle();
    const companyId = profile?.company_id || 1;

    const fileExt = file.name.split('.').pop();
    const fileName = `incident_${incidentId}_${Date.now()}.${fileExt}`;
    const filePath = `incidents/${companyId}/${fileName}`;

    const { error: uploadError } = await supabase.storage.from('incident-attachments').upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage.from('incident-attachments').getPublicUrl(filePath);

    const { data: attachment, error: insertError } = await supabase
      .from('incident_attachments')
      .insert({
        incident_id: parseInt(incidentId, 10),
        company_id: companyId,
        file_url: publicUrl,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        attachment_type: attachmentType || 'photo',
        uploaded_by: user?.email || 'system',
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({ success: true, data: attachment });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
