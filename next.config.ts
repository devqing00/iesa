import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment
  output: 'standalone',
  
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
  },
  devIndicators: false,
  
  // Proxy API requests to backend
  // Development: localhost:8000
  // Production: Set NEXT_PUBLIC_API_URL in Vercel environment variables
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

    console.log('🔧 Rewrites config loaded! API URL:', apiUrl);

    return {
      // Routes evaluated BEFORE Next.js pages. If matched, they never reach
      // the page router — so we MUST NOT intercept Next.js internal routes.
      beforeFiles: [],

      // After page-router lookup (so /api/auth/* is handled by Next.js first):
      afterFiles: [
        {
          // Proxy everything under /api/v1/* to FastAPI.
          // /api/auth/* is intentionally NOT included — those stay in Next.js
          // for NextAuth (Google OAuth, session management).
          source: '/api/v1/:path*',
          destination: `${apiUrl}/api/v1/:path*`,
        },
      ],

      fallback: [],
    };
  },
};

export default nextConfig;
