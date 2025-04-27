import type {NextConfig} from 'next';
import withPWA from 'next-pwa';

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

// Wrap Next.js config with PWA support (always enabled)
const pwaConfig = {
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: false, // enable PWA in all environments
};
export default withPWA(pwaConfig)(nextConfig);
