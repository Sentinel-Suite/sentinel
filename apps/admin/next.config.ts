import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@sentinel/ui", "@sentinel/api-client"],
};

export default nextConfig;
