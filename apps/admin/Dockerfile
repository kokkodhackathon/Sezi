# Yönetim paneli: statik derleme + nginx. Derleme bağlamı depo köküdür (ortak paket ve gömülü pilot grafiği gerekir):
#   docker build -f apps/admin/Dockerfile --build-arg VITE_SUPABASE_URL=… --build-arg VITE_SUPABASE_ANON_KEY=… --build-arg VITE_MAPBOX_TOKEN=… .
# VITE_* değerleri derlemede pakete gömülür; değişince yeniden derlenir. Hepsi istemciye açık değerlerdir (gizli anahtar konmaz).

FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo

# Önce yalnız manifestler: bağımlılık katmanı kod değişince yeniden kurulmaz.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY apps/admin/package.json apps/admin/
COPY apps/mobile/package.json apps/mobile/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter "@sezi/admin..."

COPY packages/shared packages/shared
COPY apps/admin apps/admin
# Rota testi mobil uygulamayla aynı gömülü grafiği kullanır.
COPY apps/mobile/assets/pilot apps/mobile/assets/pilot

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_MAPBOX_TOKEN
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_MAPBOX_TOKEN=$VITE_MAPBOX_TOKEN
RUN pnpm --filter @sezi/admin build

FROM nginx:1.27-alpine
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/admin/dist /usr/share/nginx/html
EXPOSE 80
