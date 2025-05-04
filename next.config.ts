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
export default withPWA(pwaConfig)(nextConfig);