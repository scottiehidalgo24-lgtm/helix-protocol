import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@helix/shared'],
  env: {
    NEXT_PUBLIC_BRIDGE_URL: process.env.NEXT_PUBLIC_BRIDGE_URL || 'https://api.helixprotocol.dev',
  },
};

export default nextConfig;
