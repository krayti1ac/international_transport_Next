'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { saveDriverSchema, type SaveDriverInput } from '../schemas/driver.schema';
import { generateLicenseNumber } from '@/lib/license';
import type { Driver, User } from '@/types/database';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseJsClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function isMissingColumnError(error: any, columnName: string): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  const col = columnName.toLowerCase();
  return (
    msg.includes(col) ||
    msg.includes('schema cache') ||
    error.code === '42703' ||
    error.code === 'PGRST204'
  );
}

/**
 * Generate a clean latin username from Arabic or English name
 */
function sanitizeUsernameCandidate(name: string, fallbackPhone: string): string {
  const arabicToLatin: Record<string, string> = {
    'ا': 'a', 'أ': 'a', 'إ': 'i', 'آ': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th',
    'ج': 'j', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z',
    'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a',
    'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
    'ه': 'h', 'و': 'w', 'ي': 'y', 'ى': 'a', 'ة': 'a', 'ء': '', 'ئ': 'y', 'ؤ': 'o'
  };

  const trimmed = name.trim().toLowerCase();
  let converted = '';
  for (const char of trimmed) {
    if (arabicToLatin[char] !== undefined) {
      converted += arabicToLatin[char];
    } else if (/[a-z0-9]/.test(char)) {
      converted += char;
    } else if (char === ' ' || char === '-' || char === '_') {
      converted += '.';
    }
  }

  converted = converted.replace(/\.+/g, '.').replace(/^\.+|\.+$/g, '');

  if (converted.length >= 3) {
    return converted;
  }

  // If too short or couldn't transliterate, fallback to driver_phone or clean phone
  const cleanPhone = fallbackPhone.replace(/\D/g, '').slice(-6);
  if (cleanPhone) {
    return `driver.${cleanPhone}`;
  }

  return `driver.${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Helper to get current context (company_id, role)
 */
async function getCurrentUserContext(supabase: any, adminClient: any) {
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  let currentCompanyId: number | null = null;
  let currentUserRole: string | null = null;

  if (currentUser) {
    const { data: userProfile } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('id', currentUser.id)
      .maybeSingle();

    if (userProfile) {
      currentCompanyId = userProfile.company_id;
      currentUserRole = userProfile.role;
    } else if (adminClient) {
      const { data: adminProfile } = await adminClient
        .from('users')
        .select('company_id, role')
        .eq('id', currentUser.id)
        .maybeSingle();
      if (adminProfile) {
        currentCompanyId = adminProfile.company_id;
        currentUserRole = adminProfile.role;
      }
    }
  }

  return {
    currentUser,
    currentCompanyId: currentCompanyId || 1,
    currentUserRole,
    isSuperAdmin: currentUserRole === 'super_admin',
  };
}

export interface SaveDriverResult {
  success: boolean;
  driver?: Driver;
  userAccount?: {
    email: string;
    username: string;
    role: string;
    created: boolean;
    authUserId?: string;
  };
  error?: string;
}

/**
 * Server action to save a driver (insert or update)
 * Automatically creates and links a user account (role: driver) for the driver if requested
 */
export async function saveDriverWithUserAction(rawInput: SaveDriverInput): Promise<SaveDriverResult> {
  try {
    const input = saveDriverSchema.parse(rawInput);
    const supabase = await createClient();
    const adminClient = getAdminClient();
    const { currentCompanyId } = await getCurrentUserContext(supabase, adminClient);

    // 1. Fetch company info and email domain
    let companyEmailDomain = 'transbodanon.com';
    let companyMaxDevices = 5;
    try {
      const { data: company } = await supabase
        .from('companies')
        .select('id, name, email_domain, max_devices')
        .eq('id', currentCompanyId)
        .maybeSingle();

      if (company?.email_domain) {
        companyEmailDomain = company.email_domain.replace(/^@+/, '').trim().toLowerCase();
      }
      if (company?.max_devices) {
        companyMaxDevices = company.max_devices;
      }
    } catch {
      // ignore
    }

    let authUserId: string | null = null;
    let finalUserEmail: string | null = null;
    let finalUsername: string | null = null;
    let userCreated = false;

    // 2. Handle User Account Creation if requested (default: true for new drivers)
    if (input.create_user_account) {
      // Determine username and email
      let rawUsername = (input.username || '').trim().toLowerCase();
      if (!rawUsername) {
        rawUsername = sanitizeUsernameCandidate(input.name, input.phone);
      }

      if (rawUsername.includes('@')) {
        finalUserEmail = rawUsername;
        finalUsername = rawUsername.split('@')[0];
      } else {
        finalUsername = rawUsername;
        finalUserEmail = `${rawUsername}@${companyEmailDomain}`;
      }

      const passwordToUse = input.password && input.password.trim().length >= 6 ? input.password.trim() : '123456';

      // Check if user already exists with this email or username prefix
      let existingUser: any = null;
      try {
        const { data: u } = await supabase
          .from('users')
          .select('id, email, name, role')
          .eq('email', finalUserEmail)
          .maybeSingle();
        existingUser = u;
      } catch {
        // ignore
      }

      if (!existingUser && adminClient) {
        try {
          const { data: uAdmin } = await adminClient
            .from('users')
            .select('id, email, name, role')
            .eq('email', finalUserEmail)
            .maybeSingle();
          existingUser = uAdmin;
        } catch {
          // ignore
        }
      }

      if (existingUser) {
        // If user already exists and we are editing the same driver, link to this user
        if (input.id) {
          authUserId = existingUser.id;
        } else {
          return {
            success: false,
            error: `اسم المستخدم أو البريد الإلكتروني (${finalUserEmail}) مستخدم بالفعل للحساب "${existingUser.name}". يرجى اختيار اسم مستخدم آخر.`,
          };
        }
      } else {
        // Create new user in Auth
        if (adminClient) {
          try {
            const { data: authRes, error: authErr } = await adminClient.auth.admin.createUser({
              email: finalUserEmail,
              password: passwordToUse,
              email_confirm: true,
              user_metadata: {
                name: input.name.trim(),
                role: 'driver',
                company_id: currentCompanyId,
              },
            });

            if (authRes?.user) {
              authUserId = authRes.user.id;
            } else if (authErr && authErr.message?.includes('already registered')) {
              return {
                success: false,
                error: `البريد الإلكتروني (${finalUserEmail}) مسجل مسبقاً في المنظومة.`,
              };
            }
          } catch (err: any) {
            console.warn('Admin createUser exception:', err);
          }
        }

        if (!authUserId) {
          authUserId = crypto.randomUUID();
        }

        // Insert into public.users
        const userPayload: Partial<User> = {
          id: authUserId,
          name: input.name.trim(),
          email: finalUserEmail,
          role: 'driver',
          company_id: currentCompanyId,
          avatar_url: input.photo_url || null,
          is_active: true,
          preferred_language: 'ar',
          created_at: new Date().toISOString(),
        };

        let { error: insertUserErr } = await supabase.from('users').insert(userPayload);
        if (
          insertUserErr &&
          (isMissingColumnError(insertUserErr, 'avatar_url') ||
            isMissingColumnError(insertUserErr, 'is_active') ||
            isMissingColumnError(insertUserErr, 'preferred_language'))
        ) {
          if (isMissingColumnError(insertUserErr, 'avatar_url')) delete userPayload.avatar_url;
          if (isMissingColumnError(insertUserErr, 'is_active')) delete userPayload.is_active;
          if (isMissingColumnError(insertUserErr, 'preferred_language')) delete userPayload.preferred_language;
          const retry = await supabase.from('users').insert(userPayload);
          insertUserErr = retry.error;
        }

        if (insertUserErr && adminClient) {
          const adminInsert = await adminClient.from('users').insert(userPayload);
          if (!adminInsert.error) {
            insertUserErr = null;
          }
        }

        if (insertUserErr) {
          console.error('Failed to insert user profile:', insertUserErr);
        } else {
          userCreated = true;
        }

        // Register default mobile device in company_devices
        try {
          const deviceId = 'dev_mob_' + Math.random().toString(36).substring(2, 9);
          const licenseNum = generateLicenseNumber(currentCompanyId, deviceId);
          const devicePayload = {
            company_id: currentCompanyId,
            device_id: deviceId,
            device_name: `هاتف السائق (${input.name.trim()})`,
            device_type: 'mobile',
            os: 'Android / iOS (Mobile)',
            browser: 'تطبيق PWA السائقين',
            is_active: true,
            license_number: licenseNum,
            user_id: authUserId,
            last_active_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          };

          const devRes = await supabase.from('company_devices').insert(devicePayload);
          if (devRes.error && adminClient) {
            await adminClient.from('company_devices').insert(devicePayload);
          }
        } catch {
          // ignore device registration errors
        }
      }
    }

    // 3. Handle default_truck_id assignment release from other drivers
    if (input.default_truck_id) {
      try {
        let query = supabase
          .from('drivers')
          .update({ default_truck_id: null })
          .eq('default_truck_id', input.default_truck_id);

        if (input.id) {
          query = query.neq('id', input.id);
        }
        await query;
      } catch (e) {
        console.warn('Releasing previous truck assignment:', e);
      }
    }

    // 4. Save driver in public.drivers
    const driverPayload: Record<string, any> = {
      name: input.name.trim(),
      phone: input.phone.trim(),
      license: input.license.trim(),
      base_salary: input.base_salary,
      bonus_percentage: input.bonus_percentage ?? 0,
      status: input.status || 'active',
      default_truck_id: input.default_truck_id ?? null,
      visa_number: input.visa_number?.trim() || null,
      visa_expiry_date: input.visa_expiry_date || null,
      has_valid_visa: Boolean(input.visa_expiry_date),
      photo_url: input.photo_url?.trim() || null,
      company_id: currentCompanyId,
    };

    if (authUserId) {
      driverPayload.user_id = authUserId;
    }

    let savedDriver: any = null;

    if (input.id) {
      // Update existing driver
      const executeUpdate = async (payload: any) => {
        return await supabase.from('drivers').update(payload).eq('id', input.id).select().maybeSingle();
      };

      let currentData = { ...driverPayload };
      let { data, error } = await executeUpdate(currentData);

      while (error && error.message && error.message.includes('in the schema cache')) {
        const match = error.message.match(/Could not find the '([^']+)' column/);
        if (match && match[1] && match[1] in currentData) {
          delete currentData[match[1]];
          const retryRes = await executeUpdate(currentData);
          data = retryRes.data;
          error = retryRes.error;
        } else {
          break;
        }
      }

      if (error && adminClient) {
        const adminRes = await adminClient.from('drivers').update(currentData).eq('id', input.id).select().maybeSingle();
        if (!adminRes.error) {
          data = adminRes.data;
          error = null;
        }
      }

      if (error) throw error;
      savedDriver = data;
    } else {
      // Insert new driver
      const executeInsert = async (payload: any) => {
        return await supabase.from('drivers').insert(payload).select().maybeSingle();
      };

      let currentData = { ...driverPayload };
      let { data, error } = await executeInsert(currentData);

      while (error && error.message && error.message.includes('in the schema cache')) {
        const match = error.message.match(/Could not find the '([^']+)' column/);
        if (match && match[1] && match[1] in currentData) {
          delete currentData[match[1]];
          const retryRes = await executeInsert(currentData);
          data = retryRes.data;
          error = retryRes.error;
        } else {
          break;
        }
      }

      if (error && adminClient) {
        const adminRes = await adminClient.from('drivers').insert(currentData).select().maybeSingle();
        if (!adminRes.error) {
          data = adminRes.data;
          error = null;
        }
      }

      if (error) throw error;
      savedDriver = data;
    }

    // Revalidate affected paths
    revalidatePath('/drivers');
    revalidatePath('/fleet');
    revalidatePath('/users');

    return {
      success: true,
      driver: savedDriver as Driver,
      userAccount: finalUserEmail
        ? {
            email: finalUserEmail,
            username: finalUsername || finalUserEmail.split('@')[0],
            role: 'driver',
            created: userCreated,
            authUserId: authUserId || undefined,
          }
        : undefined,
    };
  } catch (err: any) {
    console.error('saveDriverWithUserAction error:', err);
    return {
      success: false,
      error: err?.message || 'حدث خطأ أثناء حفظ بيانات السائق وحسابه',
    };
  }
}

