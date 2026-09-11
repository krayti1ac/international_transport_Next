-- ==============================================================================
-- Migration: 20260923_fix_users_rls_recursion.sql
-- Description: Fix infinite recursion in users RLS policies caused by
--              self-referencing queries and SECURITY DEFINER helper functions
--              that query public.users from within policy expressions.
-- ==============================================================================

BEGIN;

-- 1. Drop ALL existing policies on public.users to eliminate recursion sources
DROP POLICY IF EXISTS "Admins full access on users" ON public.users;
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Super admins full access on users" ON public.users;
DROP POLICY IF EXISTS "Users can view members of their own company" ON public.users;
DROP POLICY IF EXISTS "Users can insert members into their company" ON public.users;
DROP POLICY IF EXISTS "Users can update members of their company" ON public.users;
DROP POLICY IF EXISTS "Users can delete members of their own company" ON public.users;

-- 2. Recreate safe, non-recursive policies using auth.uid() directly
--    These policies avoid any subquery on public.users, eliminating recursion.
--    Drop first to make the migration idempotent.

DROP POLICY IF EXISTS "Users: Allow user to read own profile" ON public.users;
DROP POLICY IF EXISTS "Users: Allow user to update own profile" ON public.users;
DROP POLICY IF EXISTS "Users: Allow insert during signup" ON public.users;

-- Allow any authenticated user to read their own profile
CREATE POLICY "Users: Allow user to read own profile"
  ON public.users FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Allow any authenticated user to update their own profile
CREATE POLICY "Users: Allow user to update own profile"
  ON public.users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Allow insert during signup (id must match the authenticated user's UID)
CREATE POLICY "Users: Allow insert during signup"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- 3. Ensure the super-admin account exists with the correct UUID and role
--    This prevents the dashboard from redirecting to /login when the admin
--    profile is missing from public.users.
INSERT INTO public.users (id, email, role, company_id)
VALUES (
  '2654c12b-47ec-4661-a834-112f24c042bb',
  'admin@transbodanon.com',
  'admin',
  1
)
ON CONFLICT (id) DO UPDATE 
SET role = 'admin',
    email = EXCLUDED.email,
    company_id = COALESCE(public.users.company_id, 1);

-- 4. Refresh PostgREST schema cache so policies take effect immediately
NOTIFY pgrst, 'reload schema';

COMMIT;
