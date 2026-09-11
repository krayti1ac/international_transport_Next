import type { SystemScreenIssue } from '@/types/database';

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'secret',
  'apiKey',
  'api_key',
  'accessToken',
  'access_token',
  'serviceRole',
]);

export function sanitizePayload(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') return payload;
  if (Array.isArray(payload)) return payload.map(sanitizePayload);

  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      clean[key] = '***REDACTED_SENSITIVE_DATA***';
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitizePayload(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

export function generateAiDiagnosticPrompt(issue: Partial<SystemScreenIssue>): string {
  const sanitizedInput = sanitizePayload(issue.input_payload || {});
  const safeDeviceInfo = sanitizePayload(issue.device_info || {});

  return `### 🚨 Trans Bodanon ERP — Data Entry & Screen Issue Report

#### 1. Screen & User Context
- **Screen Name:** ${issue.screen_name || 'N/A'}
- **Route:** \`${issue.screen_route || 'N/A'}\`
- **Component:** \`${issue.component_name || 'N/A'}\`
- **Affected Field:** \`${issue.field_name || 'Form-level / Unspecified'}\`
- **User Role:** \`${issue.user_role || 'N/A'}\` (${issue.user_name || issue.user_email || 'Unknown User'})
- **Company:** ${issue.company_name || 'ID: ' + (issue.company_id ?? 'N/A')}

#### 2. Device & Environment Telemetry
- **Device ID:** \`${issue.device_id || 'N/A'}\`
- **Device License:** \`${issue.license_number || 'N/A'}\`
- **Device Category:** \`${issue.device_type || 'desktop'}\`
- **Environment Details:**
\`\`\`json
${JSON.stringify(safeDeviceInfo, null, 2)}
\`\`\`

#### 3. Error Classification
- **Issue Type:** \`${issue.issue_type || 'validation_error'}\`
- **Severity:** \`${issue.severity || 'medium'}\`
- **Error Message:**
> ${issue.error_message || 'No explicit error message captured.'}

${issue.error_stack ? `#### Error Stack Trace:\n\`\`\`\n${issue.error_stack}\n\`\`\`\n` : ''}

#### 4. Form Input Payload (Sanitized)
\`\`\`json
${JSON.stringify(sanitizedInput, null, 2)}
\`\`\`

#### 5. Validation Rejection Errors
\`\`\`json
${JSON.stringify(issue.validation_errors || {}, null, 2)}
\`\`\`

${issue.user_description ? `#### User Explanation:\n"${issue.user_description}"\n` : ''}

---
### 🎯 AI Tasks Requested:
1. **Root-Cause Diagnosis:** Explain why this data entry/validation failed considering the user role, device form factor, and input format.
2. **Code & Schema Fix:** Provide the exact code or Zod schema adjustment to resolve the conflict or handle this edge case gracefully.
3. **UX & User Guidance:** Formulate a friendly Arabic/French correction message to show the user to prevent repeating this mistake.`;
}
