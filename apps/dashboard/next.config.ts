import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@cluebase/shared'],
  output: 'standalone',
};

export default nextConfig;
