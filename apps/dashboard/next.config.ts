import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@teambrain/shared'],
  output: 'standalone',
};

export default nextConfig;
