-- Storage bucket for incident attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'incident-attachments',
  'incident-attachments',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/jpg', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "incident_attachments_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'incident-attachments'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "incident_attachments_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'incident-attachments'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "incident_attachments_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'incident-attachments'
    AND auth.role() = 'authenticated'
  );
