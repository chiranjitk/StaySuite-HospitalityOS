import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    // Skip type-checking during build to avoid OOM on servers with limited RAM.
    // The project has 700+ source files; tsc requires >2GB which exceeds typical VPS memory.
    // Run `npx tsc --noEmit` separately in CI/CD if type-checking is needed.
    ignoreBuildErrors: true,
  },
  experimental: {
    // Only bundle the specific sub-paths actually used from each package.
    // This dramatically reduces build-time memory for projects with many files
    // importing from large icon / chart / date utility libraries.
    optimizePackageImports: [
      'lucide-react',
      'date-fns',
      'recharts',
      'sonner',
      '@radix-ui/react-icons',
    ],
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    '*.space.z.ai',
    '10.121.18.160',
  ],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' ws: wss:; frame-ancestors 'self'" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      // Restrict to known image CDN / S3 domains — add your domains here
      { protocol: 'https', hostname: '**.cloudinary.com' },
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      // Allow localhost for development
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
};

export default withNextIntl(nextConfig);
