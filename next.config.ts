import { validateEnv } from "./src/lib/validateEnv"; //
validateEnv();

import withPWAInit from 'next-pwa';
const withPWA = withPWAInit({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV !== 'production',
});

const nextConfig: import('next').NextConfig = {
  /* config options here */
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default (withPWA as any)(nextConfig);