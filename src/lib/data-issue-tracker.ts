'use client';

import { getOrCreateDeviceId } from '@/lib/license';
import {
  recordScreenIssueAction,
  type RecordScreenIssueInput,
} from '@/features/super-admin/services/screen-issues.actions';
import type { ScreenIssueType, ScreenIssueSeverity } from '@/types/database';

export interface ReportDataIssueOptions {
  screenRoute?: string;
  screenName: string;
  componentName?: string;
  errorMessage: string;
  errorStack?: string;
  fieldName?: string;
  validationErrors?: Record<string, unknown>;
  inputPayload?: Record<string, unknown>;
  userDescription?: string;
  issueType?: ScreenIssueType;
  severity?: ScreenIssueSeverity;
}

/**
 * Reports a data entry or screen issue from any device connected to the system.
 * Automatically enriches the issue with device details (OS, browser, resolution, license/device_id).
 */
export async function reportDataEntryIssue(options: ReportDataIssueOptions): Promise<{
  success: boolean;
  issueId?: string;
  aiPrompt?: string;
  error?: string;
}> {
  try {
    const isBrowser = typeof window !== 'undefined';
    const deviceId = getOrCreateDeviceId();
    const route = options.screenRoute || (isBrowser ? window.location.pathname : '/');

    let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';
    let userAgent = '';
    let screenResolution = 'unknown';
    let language = 'ar';
    let os = 'Unknown OS';
    let browser = 'Unknown Browser';

    if (isBrowser) {
      userAgent = navigator.userAgent;
      const ua = userAgent.toLowerCase();
      if (/tablet|ipad|playbook|silk/i.test(ua)) {
        deviceType = 'tablet';
      } else if (/mobile|iphone|android|blackberry|iemobile|kindle/i.test(ua)) {
        deviceType = 'mobile';
      }

      screenResolution = `${window.innerWidth}x${window.innerHeight}`;
      language = navigator.language || 'ar';

      if (ua.includes('win')) os = 'Windows';
      else if (ua.includes('mac')) os = 'macOS';
      else if (ua.includes('android')) os = 'Android';
      else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';
      else if (ua.includes('linux')) os = 'Linux';

      if (ua.includes('edg')) browser = 'Microsoft Edge';
      else if (ua.includes('chrome')) browser = 'Google Chrome';
      else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Apple Safari';
      else if (ua.includes('firefox')) browser = 'Mozilla Firefox';
    }

    const payload: RecordScreenIssueInput = {
      device_id: deviceId,
      device_type: deviceType,
      screen_route: route,
      screen_name: options.screenName,
      component_name: options.componentName,
      error_message: options.errorMessage,
      error_stack: options.errorStack,
      field_name: options.fieldName,
      validation_errors: options.validationErrors,
      input_payload: options.inputPayload,
      user_description: options.userDescription,
      issue_type: options.issueType || 'validation_error',
      severity: options.severity || 'medium',
      device_info: {
        userAgent,
        os,
        browser,
        screenResolution,
        language,
        direction: isBrowser && document.dir ? document.dir : 'rtl',
      },
    };

    return await recordScreenIssueAction(payload);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown telemetry reporting error';
    console.warn('[data-issue-tracker] Failed to report issue:', message);
    return { success: false, error: message };
  }
}

