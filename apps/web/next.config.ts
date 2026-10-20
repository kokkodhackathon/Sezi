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
  },
};

export default config;
