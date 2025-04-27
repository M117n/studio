import type {NextConfig} from 'next';
import withPWA from 'next-pwa';

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  swcMinify: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
export default withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development', // Solo activa PWA en producción
})(nextConfig);
