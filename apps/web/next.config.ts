import path from "node:path";
import type { NextConfig } from "next";

// Depo kökü: ortak paket (`@sezi/shared`) ve gömülü pilot grafiği (`apps/mobile/assets/pilot`) uygulama klasörünün dışında.
const root = path.join(import.meta.dirname, "../..");

const config: NextConfig = {
  output: "standalone",
  transpilePackages: ["@sezi/shared"],
  outputFileTracingRoot: root,
  turbopack: { root },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "jejsvycpzulpleftkssj.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
    // 412 css px × 1.75 dpr ≈ 665 px. 680, varsayılan 640→750 sıçramasını kapatır; avif baytı düşürür.
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 680, 750, 828, 1080, 1200, 1920, 2048, 3840],
    qualities: [50, 75],
  },
};

export default config;
