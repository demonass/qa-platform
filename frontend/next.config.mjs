/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    devtools: false,
  },
  // 跳过Node版本检查
  distDir: '.next',
}

export default nextConfig
