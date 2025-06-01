declare module 'next-pwa' {
    import type { NextConfig } from 'next';
    const withPWA: (c?: NextConfig) => NextConfig;
    export default withPWA;
  }