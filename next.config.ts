import type { NextConfig } from 'next';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jgehdsmrmcpnvcnfrjai.supabase.co';
const SUPABASE_HOSTNAME = (() => {
  try {
    return new URL(SUPABASE_URL).hostname;
  } catch {
    return 'jgehdsmrmcpnvcnfrjai.supabase.co';
  }
})();
const supabaseCacheRegex = new RegExp(`^https://${SUPABASE_HOSTNAME.replace(/\./g, '\\.')}/.*`, 'i');

const nextPwa = require('next-pwa');
const withPWAInit = typeof nextPwa === 'function' ? nextPwa : (nextPwa?.default || nextPwa);
const withPWA = withPWAInit({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: supabaseCacheRegex,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'supabase-cache',
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 60 * 60 * 24 * 365,
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'supabase-storage',
        expiration: {
          maxEntries: 300,
          maxAgeSeconds: 60 * 60 * 24 * 30,
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    {
      urlPattern: /\/api\/.*$/i,
      handler: 'NetworkFirst',
      method: 'GET',
      options: {
        cacheName: 'api-cache',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60,
      },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-images',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60 * 24 * 30,
        },
      },
    },
  ],
});
import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs/config';

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  compress: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: SUPABASE_HOSTNAME,
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'storage.supabase.co',
      },
    ],
  },
  turbopack: {},
};

const withNextIntl = createNextIntlPlugin();

export default withSentryConfig(
  withNextIntl(
    withPWA(nextConfig)
  ),
  {
    silent: true,
    org: 'trans-bodanon',
    project: 'international-transport-next',
  }
);
