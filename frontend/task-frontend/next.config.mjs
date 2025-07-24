/** @type {import('next').NextConfig} */
const nextConfig = {
  // TypeScript configuration
  typescript: {
    // Ignore build errors in production (handle them in CI/CD)
    ignoreBuildErrors: false,
  },

  // ESLint configuration
  eslint: {
    // Don't run ESLint during builds (handle in CI/CD)
    ignoreDuringBuilds: false,
  },

  // Experimental features
  experimental: {
    // Enable app directory
    appDir: true,
    // Server components
    serverComponentsExternalPackages: [],
    // Optimized package imports
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },

  // Image optimization
  images: {
    domains: [
      'localhost',
      'avatars.githubusercontent.com',
      'images.unsplash.com',
      // Add your image domains here
    ],
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 768, 1024, 1280, 1600],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Headers for security and caching
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
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate',
          },
        ],
      },
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },

  // Redirects
  async redirects() {
    return [
      {
        source: '/home',
        destination: '/dashboard',
        permanent: true,
      },
      {
        source: '/tasks/list',
        destination: '/tasks',
        permanent: true,
      },
    ];
  },

  // Rewrites for API proxy (optional, for development)
  async rewrites() {
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/auth/:path*',
          destination: `${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL_DEV}/:path*`,
        },
        {
          source: '/api/tasks/:path*',
          destination: `${process.env.NEXT_PUBLIC_TASK_SERVICE_URL_DEV}/:path*`,
        },
      ];
    }
    return [];
  },

  // Environment variables validation
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },

  // Build optimization
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // Output configuration
  output: 'standalone',

  // Bundle analyzer (uncomment to analyze bundle)
  // bundlePagesRouterDependencies: true,

  // PWA configuration (if using next-pwa)
  // Add PWA config here when implementing

  // Performance optimization
  optimizeFonts: true,
  
  // Webpack configuration
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Custom webpack configurations
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': require('path').resolve(__dirname, 'src'),
    };

    // Bundle analyzer (uncomment to use)
    // if (process.env.ANALYZE === 'true') {
    //   const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
    //   config.plugins.push(
    //     new BundleAnalyzerPlugin({
    //       analyzerMode: 'server',
    //       analyzerPort: isServer ? 8888 : 8889,
    //       openAnalyzer: true,
    //     })
    //   );
    // }

    return config;
  },

  // Development server configuration
  ...(process.env.NODE_ENV === 'development' && {
    // Enable detailed error overlay
    reactStrictMode: true,
    // Fast refresh
    fastRefresh: true,
  }),

  // Production optimizations
  ...(process.env.NODE_ENV === 'production' && {
    // Enable React strict mode
    reactStrictMode: true,
    // Compress responses
    compress: true,
    // Enable SWC minification
    swcMinify: true,
    // Optimize CSS
    optimizeCss: true,
    // Generate service worker
    generateBuildId: async () => {
      // Generate a build ID based on git commit or timestamp
      return `build-${Date.now()}`;
    },
  }),

  // Internationalization (if needed in the future)
  // i18n: {
  //   locales: ['es', 'en'],
  //   defaultLocale: 'es',
  //   localeDetection: false,
  // },

  // Custom server configuration
  serverRuntimeConfig: {
    // Only available on the server side
    mySecret: 'secret',
  },

  publicRuntimeConfig: {
    // Available on both server and client
    staticFolder: '/static',
  },

  // Trailing slash configuration
  trailingSlash: false,

  // Asset prefix for CDN (if using CDN)
  // assetPrefix: process.env.NODE_ENV === 'production' ? 'https://cdn.example.com' : '',

  // Custom page extensions
  pageExtensions: ['tsx', 'ts'],

  // Disable x-powered-by header
  poweredByHeader: false,

  // Enable GZIP compression
  compress: true,

  // HTTP Keep-Alive timeout
  httpAgentOptions: {
    keepAlive: true,
  },
};

export default nextConfig;