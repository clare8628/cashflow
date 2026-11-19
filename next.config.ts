import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;

// SKIP_CF_DEV=1 builds/previews locally without Cloudflare credentials
// (AI categorisation is then skipped).
if (!process.env.SKIP_CF_DEV) initOpenNextCloudflareForDev();
