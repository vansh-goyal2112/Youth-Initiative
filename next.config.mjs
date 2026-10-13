/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  output: process.env.VERCEL ? undefined : "standalone",
};

export default nextConfig;