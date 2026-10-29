/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  devIndicators: false,
  output: process.env.VERCEL ? undefined : "standalone",
};

export default nextConfig;