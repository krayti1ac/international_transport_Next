'use client';

/**
 * Trans Bodanon TMS — useTelematicsStream Custom Hook
 * Server-Sent Events (SSE) Client Hook with Exponential Backoff & State Lifecycle
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  TelematicsStreamPacket,
  StreamConnectedEvent,
  StreamConnectionStatus,
  UseTelematicsStreamOptions,
  UseTelematicsStreamResult,
} from '../types/telematics-stream.types';
import type { ReeferExcursionIncident } from '../types/reefer-compliance.types';

export function useTelematicsStream({
  tripId,
  truckId,
  enabled = true,
  mode = 'live',
  onTelemetry,
  onIncident,
  onError,
}: UseTelematicsStreamOptions = {}): UseTelematicsStreamResult {
  const [status, setStatus] = useState<StreamConnectionStatus>('disconnected');
  const [latestPacket, setLatestPacket] = useState<TelematicsStreamPacket | null>(null);
  const [history, setHistory] = useState<TelematicsStreamPacket[]>([]);
  const [incidents, setIncidents] = useState<ReeferExcursionIncident[]>([]);
  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryAttemptsRef = useRef<number>(0);
  const isManuallyClosedRef = useRef<boolean>(false);

  // References to preserve latest callbacks without forcing reconnects
  const onTelemetryRef = useRef(onTelemetry);
  const onIncidentRef = useRef(onIncident);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onTelemetryRef.current = onTelemetry;
    onIncidentRef.current = onIncident;
    onErrorRef.current = onError;
  }, [onTelemetry, onIncident, onError]);

  const disconnect = useCallback(() => {
    isManuallyClosedRef.current = true;
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setStatus('disconnected');
  }, []);

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!enabled) {
      disconnect();
      return;
    }

    // Clean up existing instance if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    isManuallyClosedRef.current = false;
    setStatus('connecting');
    setError(null);

    // Build URL query parameters
    const params = new URLSearchParams();
    if (tripId) params.set('tripId', String(tripId));
    if (truckId) params.set('truckId', String(truckId));
    if (mode) params.set('mode', mode);

    const streamUrl = `/api/telematics/stream?${params.toString()}`;

    try {
      const es = new EventSource(streamUrl);
      eventSourceRef.current = es;

      // 1. Initial Handshake / Connected Event
      es.addEventListener('connected', (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data) as StreamConnectedEvent;
          setStatus('connected');
          retryAttemptsRef.current = 0;
          setError(null);
        } catch (parseErr) {
          console.warn('[SSE Parse Error]:', parseErr);
        }
      });

      // 2. Real-Time Telematics Stream Packet
      es.addEventListener('telemetry', (event: MessageEvent) => {
        try {
          const packet = JSON.parse(event.data) as TelematicsStreamPacket;
          setLatestPacket(packet);
          setHistory((prev) => {
            const next = [...prev, packet];
            return next.length > 25 ? next.slice(-25) : next;
          });
          onTelemetryRef.current?.(packet);
        } catch (parseErr) {
          console.warn('[SSE Telemetry Parse Error]:', parseErr);
        }
      });

      // 3. Excursion Incident Alert Event
      es.addEventListener('incident', (event: MessageEvent) => {
        try {
          const inc = JSON.parse(event.data) as ReeferExcursionIncident;
          setIncidents((prev) => [inc, ...prev]);
          onIncidentRef.current?.(inc);
        } catch (parseErr) {
          console.warn('[SSE Incident Parse Error]:', parseErr);
        }
      });

      // 4. Keep-Alive Ping
      es.addEventListener('ping', () => {
        // Heartbeat received, confirms connection is live
        if (status !== 'connected') {
          setStatus('connected');
        }
      });

      // 5. Error & Disconnect Handling with Exponential Backoff
      es.onerror = (err) => {
        if (isManuallyClosedRef.current) return;

        es.close();
        eventSourceRef.current = null;
        setStatus('error');
        setError('Connection interrupted. Reconnecting...');
        onErrorRef.current?.(err);

        // Exponential backoff: 2s, 3s, 4.5s, 6.75s, ... max 30s
        const backoffMs = Math.min(2000 * Math.pow(1.5, retryAttemptsRef.current), 30000);
        retryAttemptsRef.current += 1;

        retryTimeoutRef.current = setTimeout(() => {
          connect();
        }, backoffMs);
      };
    } catch (createErr) {
      setStatus('error');
      setError(createErr instanceof Error ? createErr.message : 'Failed to initialize EventSource');
      onErrorRef.current?.(createErr instanceof Error ? createErr : new Error('EventSource failed'));
    }
  }, [enabled, tripId, truckId, mode, disconnect]);

  const reconnect = useCallback(() => {
    retryAttemptsRef.current = 0;
    connect();
  }, [connect]);

  useEffect(() => {
    connect();

    return () => {
      isManuallyClosedRef.current = true;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [connect]);

  return {
    status,
    latestPacket,
    history,
    incidents,
    error,
    reconnect,
    disconnect,
  };
}

