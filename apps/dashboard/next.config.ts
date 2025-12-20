import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@villa-paraiso/shared'],
  output: 'standalone',
};

export default nextConfig;
