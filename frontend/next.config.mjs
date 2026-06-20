/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },
  distDir: '.next',
  devIndicators: {
    enabled: false,
  },
}

export default nextConfig
