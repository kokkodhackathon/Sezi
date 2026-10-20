# Sezi web (sezi.info): Next.js standalone sunucusu. Derleme bağlamı depo köküdür (ortak paket ve gömülü pilot grafiği gerekir):
#   docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_SUPABASE_URL=… --build-arg NEXT_PUBLIC_SUPABASE_KEY=… \
#     --build-arg NEXT_PUBLIC_MAPBOX_TOKEN=… --build-arg NEXT_PUBLIC_SITE_URL=https://sezi.info .
# NEXT_PUBLIC_* değerleri derlemede pakete gömülür; değişince yeniden derlenir. Hepsi istemciye açık değerlerdir (gizli anahtar konmaz).

FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo

# Önce yalnız manifestler: bağımlılık katmanı kod değişince yeniden kurulmaz.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY apps/admin/package.json apps/admin/
COPY apps/mobile/package.json apps/mobile/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter "@sezi/web..."

COPY packages/shared packages/shared
COPY apps/web apps/web
# Rota, tur ve bildirim sayfaları mobil uygulamayla aynı gömülü grafiği kullanır.
COPY apps/mobile/assets/pilot apps/mobile/assets/pilot

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_KEY
ARG NEXT_PUBLIC_MAPBOX_TOKEN
ARG NEXT_PUBLIC_SITE_URL=https://sezi.info
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_KEY=$NEXT_PUBLIC_SUPABASE_KEY \
    NEXT_PUBLIC_MAPBOX_TOKEN=$NEXT_PUBLIC_MAPBOX_TOKEN \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @sezi/web build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
# Standalone çıktısı depo yapısını korur: sunucu apps/web/server.js.
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
