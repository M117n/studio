import { validateEnv } from "./src/lib/validateEnv"; //
validateEnv(); 

import type {NextConfig} from 'next';
import withPWA from 'next-pwa';

const nextConfig: import('next').NextConfig = {
    reactStrictMode: true,                                                                                                               
    typescript: {                                                                                                                        
      ignoreBuildErrors: true,                                                                                                           
    },                                                                                                                                   
    eslint: {                                                                                                                            
      ignoreDuringBuilds: true,                                                                                                          
    },                                                                                                                                   
    async headers() {                                                                                                                    
      return [
        {
          source: '/(.*)',
          headers: [
  {
    key: 'Content-Security-Policy',
    value:
      "default-src 'self'; script-src 'self' https://www.gstatic.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self';",
  },
          ],
      },
    ]; 
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