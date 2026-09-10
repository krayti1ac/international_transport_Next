-- Test function creation
CREATE OR REPLACE FUNCTION test_func() 
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER 
AS $$ 
BEGIN 
  RETURN '{"test": true}'::JSONB; 
END; 
$$;
