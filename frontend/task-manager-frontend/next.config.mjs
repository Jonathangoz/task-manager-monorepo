/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  experimental: {
    appDir: true,
  },
  images: {
    domains: [
      'localhost',
      'task-manager-auth-service.onrender.com',
      'task-manager-task-service.onrender.com',
    ],
    formats: ['image/webp', 'image/avif'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
        ],
      },
    ];
  },
  // En next.config.mjs - para desarrollo/producción
  async rewrites() {
    const isDev = process.env.NODE_ENV === 'development';
    const authServiceUrl = isDev
      ? process.env.NEXT_PUBLIC_AUTH_SERVICE_URL_DEV
      : process.env.NEXT_PUBLIC_AUTH_SERVICE_URL;
    const taskServiceUrl = isDev
      ? process.env.NEXT_PUBLIC_TASK_SERVICE_URL_DEV
      : process.env.NEXT_PUBLIC_TASK_SERVICE_URL;

    return [
      {
        source: '/api/auth/:path*',
        destination: `${authServiceUrl}/:path*`,
      },
      {
        source: '/api/tasks/:path*',
        destination: `${taskServiceUrl}/:path*`,
      },
    ];
  },
  output: 'standalone',
  poweredByHeader: false,
  compress: true,
  pageExtensions: ['tsx', 'ts'],
  env: {
    CUSTOM_KEY: 'task-manager-frontend',
  },
  trailingSlash: false,
  reactStrictMode: true,
  swcMinify: true,
};

export default nextConfig;
