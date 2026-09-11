'use client';

import { useCallback, useRef } from 'react';
import { reportDataEntryIssue } from '@/lib/data-issue-tracker';
import type { ScreenIssueSeverity, ScreenIssueType } from '@/types/database';

export interface UseAutoIssueReporterOptions {
  screenName: string;
  screenRoute?: string;
  componentName?: string;
  defaultSeverity?: ScreenIssueSeverity;
}

export interface ReportValidationParams {
  fieldName?: string;
  errorMessage: string;
  rejectedValue?: unknown;
  validationRule?: string;
  formData?: Record<string, unknown>;
  inputPayload?: Record<string, unknown>;
  validationErrors?: Record<string, unknown>;
  userDescription?: string;
  severity?: ScreenIssueSeverity;
  issueType?: ScreenIssueType;
}

export interface ReportSubmissionParams {
  error: unknown;
  operationName?: string;
  formData?: Record<string, unknown>;
  inputPayload?: Record<string, unknown>;
  validationErrors?: Record<string, unknown>;
  userDescription?: string;
  severity?: ScreenIssueSeverity;
}

export interface ReportCalculationParams {
  fieldName?: string;
  errorMessage?: string;
  formula?: string;
  inputs?: Record<string, unknown>;
  calculatedResult?: unknown;
  expectedResult?: unknown;
  formData?: Record<string, unknown>;
  inputPayload?: Record<string, unknown>;
  validationErrors?: Record<string, unknown>;
  severity?: ScreenIssueSeverity;
}

export function useAutoIssueReporter(options: UseAutoIssueReporterOptions) {
  const { screenName, screenRoute, componentName, defaultSeverity = 'medium' } = options;

  // Cache recent error signatures to prevent duplicate spam (15s debounce window)
  const recentErrorsRef = useRef<Map<string, number>>(new Map());

  const shouldThrottle = useCallback((signature: string): boolean => {
    const now = Date.now();
    const lastTime = recentErrorsRef.current.get(signature);
    if (lastTime && now - lastTime < 15000) {
      return true; // Throttle duplicate error within 15s
    }
    recentErrorsRef.current.set(signature, now);

    // Prune old entries
    if (recentErrorsRef.current.size > 50) {
      for (const [key, time] of recentErrorsRef.current.entries()) {
        if (now - time > 30000) {
          recentErrorsRef.current.delete(key);
        }
      }
    }
    return false;
  }, []);

  const reportValidation = useCallback(
    async (params: ReportValidationParams) => {
      const {
        fieldName,
        errorMessage,
        rejectedValue,
        validationRule,
        formData,
        inputPayload = formData,
        validationErrors,
        userDescription,
        severity = defaultSeverity,
        issueType = 'validation_error',
      } = params;

      const mergedErrors: Record<string, unknown> = {
        ...(validationErrors || {}),
        ...(rejectedValue !== undefined ? { rejectedValue } : {}),
        ...(validationRule ? { validationRule } : {}),
      };

      const signature = `${screenName}|${fieldName || ''}|${errorMessage}`;
      if (shouldThrottle(signature)) return;

      // Fire and forget in the background
      setTimeout(async () => {
        try {
          await reportDataEntryIssue({
            screenName,
            screenRoute,
            componentName,
            fieldName,
            errorMessage,
            inputPayload,
            validationErrors: Object.keys(mergedErrors).length > 0 ? mergedErrors : undefined,
            userDescription,
            severity,
            issueType,
          });
        } catch {
          // silent fallback
        }
      }, 0);
    },
    [screenName, screenRoute, componentName, defaultSeverity, shouldThrottle]
  );

  const reportSubmissionError = useCallback(
    async (params: ReportSubmissionParams) => {
      const {
        error,
        operationName,
        formData,
        inputPayload = formData,
        validationErrors,
        userDescription,
        severity = 'high',
      } = params;
      const rawErrorMsg = error instanceof Error ? error.message : String(error || 'Submission failed');
      const errorMsg = operationName ? `[${operationName}] ${rawErrorMsg}` : rawErrorMsg;
      const errorStack = error instanceof Error ? error.stack : undefined;

      const mergedErrors: Record<string, unknown> = {
        ...(validationErrors || {}),
        ...(operationName ? { operationName } : {}),
      };

      const signature = `${screenName}|sub_err|${errorMsg}`;
      if (shouldThrottle(signature)) return;

      setTimeout(async () => {
        try {
          await reportDataEntryIssue({
            screenName,
            screenRoute,
            componentName,
            errorMessage: errorMsg,
            errorStack,
            inputPayload,
            validationErrors: Object.keys(mergedErrors).length > 0 ? mergedErrors : undefined,
            userDescription,
            severity,
            issueType: 'form_submission_failed',
          });
        } catch {
          // silent fallback
        }
      }, 0);
    },
    [screenName, screenRoute, componentName, shouldThrottle]
  );

  const reportCalculationAnomaly = useCallback(
    async (params: ReportCalculationParams) => {
      const {
        fieldName,
        errorMessage,
        formula,
        inputs,
        calculatedResult,
        expectedResult,
        formData,
        inputPayload = inputs || formData,
        validationErrors,
        severity = 'high',
      } = params;

      const finalMsg = errorMessage || (formula ? `خطأ في العملية الحسابية: ${formula}` : 'انحراف أو خطأ في الحسابات');

      const mergedErrors: Record<string, unknown> = {
        ...(validationErrors || {}),
        ...(formula ? { formula } : {}),
        ...(calculatedResult !== undefined ? { calculatedResult } : {}),
        ...(expectedResult !== undefined ? { expectedResult } : {}),
      };

      const signature = `${screenName}|calc|${fieldName || ''}|${finalMsg}`;
      if (shouldThrottle(signature)) return;

      setTimeout(async () => {
        try {
          await reportDataEntryIssue({
            screenName,
            screenRoute,
            componentName,
            fieldName,
            errorMessage: finalMsg,
            inputPayload,
            validationErrors: Object.keys(mergedErrors).length > 0 ? mergedErrors : undefined,
            severity,
            issueType: 'calculation_anomaly',
          });
        } catch {
          // silent fallback
        }
      }, 0);
    },
    [screenName, screenRoute, componentName, shouldThrottle]
  );

  const wrapSubmit = useCallback(
    <T>(
      submitFn: () => Promise<T>,
      getPayload?: () => Record<string, unknown>
    ) => {
      return async (): Promise<T | undefined> => {
        try {
          return await submitFn();
        } catch (err: unknown) {
          const payload = getPayload ? getPayload() : undefined;
          reportSubmissionError({
            error: err,
            inputPayload: payload,
          });
          throw err;
        }
      };
    },
    [reportSubmissionError]
  );

  return {
    reportValidation,
    reportSubmissionError,
    reportCalculationAnomaly,
    wrapSubmit,
  };
}
