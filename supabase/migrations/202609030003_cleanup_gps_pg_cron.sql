-- ==============================================================================
-- Trans Bodanon: Supabase pg_cron Automated Cleanup
-- Deletes GPS tracking records older than 6 months every Sunday at 03:00 AM UTC.
-- ==============================================================================

-- 1. تفعيل إضافة pg_cron إذا لم تكن مفعلة
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. جدولة مهمة تنظيف إحداثيات GPS القديمة أسبوعياً
SELECT cron.schedule(
  'cleanup-old-gps-data',
  '0 3 * * 0', 
  $$
    DELETE FROM truck_location_history 
    WHERE timestamp < NOW() - INTERVAL '6 months';
  $$
);

