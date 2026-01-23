import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This disables all dev indicators (including the floating Next.js logo)
  devIndicators: false,
  
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "tayevkfixaxvfcvndetv.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
    formats: ["image/avif", "image/webp"],
    qualities: [60, 75, 80, 85, 90, 95, 100],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  },
  
  // Improve compatibility with React 19 and Next.js 15
  reactStrictMode: true,
  
  // Suppress hydration warnings for known safe cases
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  
  // Experimental features for better stability and performance
  experimental: {
    // Optimize package imports to reduce bundle size
    optimizePackageImports: [
      "lucide-react", 
      "@radix-ui/react-select", 
      "@radix-ui/react-dialog",
      "react-icons",
      "framer-motion"
    ],
  },
  
  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? {
      exclude: ["error", "warn"],
    } : false,
  },
  
  // Compression
  compress: true,
  
  // Ensure proper handling of client components
  transpilePackages: [],
};

export default nextConfig;
