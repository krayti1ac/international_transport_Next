#!/usr/bin/env node

/**
 * Trans Bodanon — Pre-Flight Check Utility
 *
 * Executes automatically before `next build` (see package.json "build" script).
 *
 * It performs two gate-keeping checks:
 *   1. Verifies that every critical environment variable is set and non-empty.
 *   2. Opens a connection to the Supabase production database and runs a
 *      lightweight health query to confirm credentials are valid and the
 *      database is reachable.
 *
 * If any check fails the script exits with code 1, which aborts the build
 * and prevents silent production failures.
 *
 * Usage:   node scripts/pre-flight-check.js
 *          (called automatically by `npm run build`)
 */

// Load .env, .env.local, and .env.production for local development.
// In CI / Vercel the variables are injected by the platform and take
// precedence (existing env vars are never overwritten).
// We mirror Next.js env-loading rules: .env and .env.local are always
// loaded; .env.{NODE_ENV} and .env.{NODE_ENV}.local are loaded only
// when NODE_ENV matches.
const fs = require('fs');
const path = require('path');

function loadEnvFile(file) {
  const filePath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    // Remove inline comments (only for unquoted values)
    if (!line.includes('"') && !line.includes("'")) {
      const commentIdx = val.indexOf(' #');
      if (commentIdx !== -1) val = val.slice(0, commentIdx).trim();
    }
    // Never overwrite an already-set environment variable
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

const env = process.env.NODE_ENV || 'development';
loadEnvFile('.env');
loadEnvFile('.env.local');
if (env === 'production') {
  loadEnvFile('.env.production');
  loadEnvFile('.env.production.local');
} else {
  loadEnvFile(`.env.${env}`);
  loadEnvFile(`.env.${env}.local`);
}

// Auto-derive NEXT_PUBLIC_APP_URL on Vercel or CI platforms
if (!process.env.NEXT_PUBLIC_APP_URL) {
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    process.env.NEXT_PUBLIC_APP_URL = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  } else if (process.env.VERCEL_URL) {
    process.env.NEXT_PUBLIC_APP_URL = `https://${process.env.VERCEL_URL}`;
  } else if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    process.env.NEXT_PUBLIC_APP_URL = `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }
}

// Supabase JS requires WebSocket. Provide fallback for Node < 22 where native WebSocket is missing.
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = class WebSocketPolyfill {};
}

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function ok(msg) {
  process.stdout.write(`${GREEN}✓ ${msg}${RESET}\n`);
}

function warn(msg) {
  process.stdout.write(`${YELLOW}⚠ ${msg}${RESET}\n`);
}

function fail(msg) {
  process.stderr.write(`${RED}✗ ${msg}${RESET}\n`);
}

/**
 * Variables that MUST be present for the application to build and run.
 * Missing any of these will exit with code 1.
 */
const REQUIRED_VARS = [
  {
    key: 'NEXT_PUBLIC_SUPABASE_URL',
    label: 'Supabase Project URL',
    example: 'https://<project-ref>.supabase.co',
  },
  {
    key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    label: 'Supabase Anonymous Key',
    example: 'eyJhb... (JWT)',
  },
  {
    key: 'SUPABASE_SERVICE_ROLE_KEY',
    label: 'Supabase Service Role Key (server-only)',
    example: 'eyJhb... (service role JWT)',
  },
];

/**
 * Variables that are optional but recommended.
 * Missing these produces a warning but does NOT block the build.
 */
const OPTIONAL_VARS = [
  {
    key: 'NEXT_PUBLIC_APP_URL',
    label: 'Application Public URL',
    example: 'https://app.transbodanon.ma',
  },
  {
    key: 'NEXT_PUBLIC_SENTRY_DSN',
    label: 'Sentry Client DSN (error reporting)',
    example: 'https://<key>@o0.ingest.sentry.io/<project-id>',
  },
  {
    key: 'SENTRY_DSN',
    label: 'Sentry Server DSN (error reporting)',
    example: 'https://<key>@o0.ingest.sentry.io/<project-id>',
  },
  {
    key: 'WHATSAPP_API_TOKEN',
    label: 'Meta WhatsApp Cloud API Token',
    example: 'EAAB...long-lived-access-token...',
  },
  {
    key: 'WHATSAPP_PHONE_NUMBER_ID',
    label: 'WhatsApp Phone Number ID',
    example: '100xxxxxxxxxxxx',
  },
  {
    key: 'WHATSAPP_VERIFY_TOKEN',
    label: 'WhatsApp Webhook Verify Token',
    example: 'your-webhook-verify-token',
  },
  {
    key: 'GPS_WEBHOOK_SECRET',
    label: 'GPS Tracking Webhook Secret',
    example: 'your-gps-webhook-secret',
  },
  {
    key: 'OCR_API_KEY',
    label: 'OCR API Key (fuel receipt processing)',
    example: 'your-ocr-api-key',
  },
  {
    key: 'PDF_SIGNING_KEY',
    label: 'PDF Signing Key',
    example: 'your-pdf-signing-key',
  },
];

let errors = 0;
let warnings = 0;

/**
 * Step 1 — Validate required environment variables.
 */
function checkRequiredVars() {
  process.stdout.write('\n');
  process.stdout.write('=== Step 1: Environment Variable Check ===\n');
  process.stdout.write('\n');

  for (const { key, label, example } of REQUIRED_VARS) {
    const value = process.env[key];
    if (!value || value.trim().length === 0) {
      fail(`MISSING  ${label} (${key})`);
      process.stdout.write(`         Expected example: ${example}\n`);
      errors++;
    } else {
      ok(`${label} (${key}) is set`);
    }
  }

  process.stdout.write('\n');
  for (const { key, label, example } of OPTIONAL_VARS) {
    const value = process.env[key];
    if (!value || value.trim().length === 0) {
      warn(`OPTIONAL  ${label} (${key}) is not set`);
      process.stdout.write(`         You may set: ${example}\n`);
      warnings++;
    } else {
      ok(`${label} (${key}) is set`);
    }
  }
}

/**
 * Step 2 — Test Supabase database connectivity.
 */
async function checkSupabaseConnection() {
  process.stdout.write('\n');
  process.stdout.write('=== Step 2: Supabase Database Connectivity ===\n');
  process.stdout.write('\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    fail('Cannot test Supabase connection — required env vars are missing.');
    errors++;
    return;
  }

  try {
    new URL(supabaseUrl);
  } catch {
    fail(`NEXT_PUBLIC_SUPABASE_URL is not a valid URL: ${supabaseUrl}`);
    errors++;
    return;
  }

  if (
    supabaseUrl.includes('xxxx.supabase.co') ||
    supabaseUrl.includes('placeholder') ||
    supabaseKey.includes('...') ||
    supabaseKey.includes('placeholder')
  ) {
    warn(`Placeholder credentials detected (${supabaseUrl}). Skipping live database test.`);
    warn(`To verify live connectivity, replace placeholder secrets with your real Supabase project credentials.`);
    warnings++;
    return;
  }

  let supabase;
  try {
    const { createClient } = require('@supabase/supabase-js');
    supabase = createClient(supabaseUrl, supabaseKey, {
      db: { schema: 'public' },
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { 'X-Client-Info': 'trans-bodanon-preflight' } },
    });
  } catch (err) {
    fail(`Failed to initialise Supabase client: ${err.message || err}`);
    errors++;
    return;
  }

  // Attempt a lightweight query on the seed "users" table.
  // Using count head:true avoids fetching actual rows.
  try {
    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

     if (error) {
      if (error.code === 'PGRST301' || error.message?.includes('table') || error.message?.includes('relation')) {
        warn(`Supabase connected, but the 'users' table does not exist yet.`);
        warn('This is expected if the database has not been migrated/seeded.');
        warnings++;
      } else if (error.code === 'PGRST302' || error.code === '401' || error.message?.includes('invalid') || error.message?.includes('JWT')) {
        fail(`Supabase authentication failed — verify NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are correct.`);
        fail(`  Error code: ${error.code || 'N/A'} | Message: ${error.message || '(empty)'}`);
        errors++;
      } else {
        const errMsg = error.message || JSON.stringify(error) || '(no error detail)';
        fail(`Supabase query error: ${errMsg}`);
        if (error.code) fail(`  Error code: ${error.code}`);
        errors++;
      }
    } else {
      ok(`Supabase connection successful — 'users' table reachable (count: ${count ?? 'n/a'})`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('fetch') || message.includes('network') || message.includes('timeout')) {
      fail(`Supabase network error — could not reach the database: ${message}`);
    } else {
      fail(`Unexpected error testing Supabase connection: ${message}`);
    }
    errors++;
  }
}

/**
 * Summary & exit code.
 */
function printSummary() {
  process.stdout.write('\n');
  process.stdout.write('=== Summary ===\n');
  process.stdout.write(`  Errors:   ${errors}\n`);
  process.stdout.write(`  Warnings: ${warnings}\n`);
  process.stdout.write('\n');

  if (errors > 0) {
    process.stderr.write(`${RED}Pre-flight check FAILED — build aborted.${RESET}\n`);
    process.stderr.write(`${YELLOW}Fix the errors above and re-run 'npm run build'.${RESET}\n`);
    process.exitCode = 1;
  } else if (warnings > 0) {
    process.stdout.write(`${YELLOW}Pre-flight check passed with warnings — build will proceed.${RESET}\n`);
  } else {
    process.stdout.write(`${GREEN}Pre-flight check PASSED — ready to build.${RESET}\n`);
  }
}

async function main() {
  if (process.env.SKIP_ENV_VALIDATION === 'true') {
    process.stdout.write('\n⚡ Skipping pre-flight checks (SKIP_ENV_VALIDATION is set to true).\n\n');
    return;
  }

  process.stdout.write('\n');
  process.stdout.write('┌────────────────────────────────────────────┐\n');
  process.stdout.write('│  Trans Bodanon — Pre-Flight Check          │\n');
  process.stdout.write('│  Step 15: Go-Live Validation              │\n');
  process.stdout.write('└────────────────────────────────────────────┘\n');

  checkRequiredVars();
  await checkSupabaseConnection();
  printSummary();
}

main();
