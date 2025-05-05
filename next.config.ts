import type { NextConfig } from 'next';
import { validateEnv } from "./src/lib/validateEnv"; //
validateEnv();

import withPWAInit from 'next-pwa';
const withPWA = withPWAInit({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV !== 'production',
});

const nextConfig: NextConfig = {
  /* config options here */
  // Expose Firebase public config to the client
  env: {
    PUBLIC_FIREBASE_API_KEY: process.env.PUBLIC_FIREBASE_API_KEY,
    PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
    PUBLIC_FIREBASE_PROJECT_ID: process.env.PUBLIC_FIREBASE_PROJECT_ID,
    PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
    PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    PUBLIC_FIREBASE_APP_ID: process.env.PUBLIC_FIREBASE_APP_ID,
  },
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

// Wrap Next.js config with PWA support (enabled only in production to avoid multiple GenerateSW calls)
const isProduction = process.env.NODE_ENV === 'production';
const pwaConfig = {
  dest: 'public',
  register: true,
  skipWaiting: true,
  // Disable PWA in non-production builds to prevent GenerateSW running multiple times in watch mode
  disable: !isProduction,
};
export default (withPWA as any)(nextConfig);