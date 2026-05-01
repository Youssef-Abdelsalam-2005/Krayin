# =============================================================================
# Twenty CRM — fork build entrypoint for Railway / generic Docker
# =============================================================================
# Railway (and `docker build .` with no -f flag) picks up this file by default.
# It builds the "twenty" target (server + frontend in one image) from THIS
# repo's source, so deploys ship with our fork's patches and features.
#
# This file mirrors the relevant stages from:
#   packages/twenty-docker/twenty/Dockerfile
# When you sync from upstream and that file changes, refresh this one to keep
# them aligned (or build the upstream Dockerfile directly with --target=twenty).
#
# Manual builds:
#   docker build -t my-twenty .                                  # uses this file
#   docker build --target twenty \
#     -f packages/twenty-docker/twenty/Dockerfile -t my-twenty . # upstream file
# =============================================================================


# -----------------------------------------------------------------------------
# Shared dependency layer
# -----------------------------------------------------------------------------
FROM node:24-alpine AS common-deps

WORKDIR /app

COPY ./package.json ./yarn.lock ./.yarnrc.yml ./tsconfig.base.json ./nx.json /app/
COPY ./.yarn/releases /app/.yarn/releases
COPY ./.yarn/patches /app/.yarn/patches

COPY ./packages/twenty-emails/package.json /app/packages/twenty-emails/
COPY ./packages/twenty-server/package.json /app/packages/twenty-server/
COPY ./packages/twenty-server/patches /app/packages/twenty-server/patches
COPY ./packages/twenty-ui/package.json /app/packages/twenty-ui/
COPY ./packages/twenty-shared/package.json /app/packages/twenty-shared/
COPY ./packages/twenty-front/package.json /app/packages/twenty-front/
COPY ./packages/twenty-front-component-renderer/package.json /app/packages/twenty-front-component-renderer/
COPY ./packages/twenty-sdk/package.json /app/packages/twenty-sdk/
COPY ./packages/twenty-client-sdk/package.json /app/packages/twenty-client-sdk/

RUN yarn && yarn cache clean && npx nx reset


# -----------------------------------------------------------------------------
# Backend build (NestJS server + supporting workspace packages)
# -----------------------------------------------------------------------------
FROM common-deps AS twenty-server-build

COPY ./packages/twenty-emails /app/packages/twenty-emails
COPY ./packages/twenty-shared /app/packages/twenty-shared
COPY ./packages/twenty-ui /app/packages/twenty-ui
COPY ./packages/twenty-sdk /app/packages/twenty-sdk
COPY ./packages/twenty-client-sdk /app/packages/twenty-client-sdk
COPY ./packages/twenty-server /app/packages/twenty-server

RUN npx nx run twenty-server:lingui:extract && \
    npx nx run twenty-server:lingui:compile && \
    npx nx run twenty-emails:lingui:extract && \
    npx nx run twenty-emails:lingui:compile

RUN npx nx run twenty-server:build

# Strip type declarations and compiled tests; keep source maps for Sentry.
RUN find /app/packages/twenty-server/dist -name '*.d.ts' -delete \
 && rm -rf /app/packages/twenty-server/dist/packages/twenty-server/test

RUN yarn workspaces focus --production \
      twenty-emails twenty-shared twenty-sdk twenty-client-sdk twenty-server


# -----------------------------------------------------------------------------
# Frontend build (React/Vite)
# -----------------------------------------------------------------------------
FROM common-deps AS twenty-front-build

COPY ./packages/twenty-front /app/packages/twenty-front
COPY ./packages/twenty-front-component-renderer /app/packages/twenty-front-component-renderer
COPY ./packages/twenty-ui /app/packages/twenty-ui
COPY ./packages/twenty-shared /app/packages/twenty-shared
COPY ./packages/twenty-sdk /app/packages/twenty-sdk
COPY ./packages/twenty-client-sdk /app/packages/twenty-client-sdk

RUN npx nx run twenty-front:lingui:extract && \
    npx nx run twenty-front:lingui:compile

# To skip the memory-intensive frontend build, pre-build on the host:
#   npx nx build twenty-front
# The check below will use packages/twenty-front/build/ if it already exists.
RUN if [ -d /app/packages/twenty-front/build ]; then \
      echo "Using pre-built frontend from host"; \
    else \
      NODE_OPTIONS="--max-old-space-size=8192" npx nx build twenty-front; \
    fi


# -----------------------------------------------------------------------------
# Runtime: server only (intermediate, used by the final twenty stage)
# -----------------------------------------------------------------------------
FROM node:24-alpine AS twenty-server

RUN apk add --no-cache curl jq postgresql-client

COPY ./packages/twenty-docker/twenty/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh
WORKDIR /app/packages/twenty-server

ARG APP_VERSION
ENV APP_VERSION=$APP_VERSION

# Workspace root config
COPY --chown=1000 --from=twenty-server-build /app/package.json /app/yarn.lock /app/.yarnrc.yml /app/
COPY --chown=1000 --from=twenty-server-build /app/tsconfig.base.json /app/nx.json /app/
COPY --chown=1000 --from=twenty-server-build /app/.yarn /app/.yarn
COPY --chown=1000 --from=twenty-server-build /app/node_modules /app/node_modules

# Server package
COPY --chown=1000 --from=twenty-server-build /app/packages/twenty-server/package.json /app/packages/twenty-server/
COPY --chown=1000 --from=twenty-server-build /app/packages/twenty-server/dist /app/packages/twenty-server/dist
COPY --chown=1000 --from=twenty-server-build /app/packages/twenty-server/patches /app/packages/twenty-server/patches

# Workspace packages (dist + package.json; node_modules symlinks resolve to these)
COPY --chown=1000 --from=twenty-server-build /app/packages/twenty-shared/package.json /app/packages/twenty-shared/
COPY --chown=1000 --from=twenty-server-build /app/packages/twenty-shared/dist /app/packages/twenty-shared/dist
COPY --chown=1000 --from=twenty-server-build /app/packages/twenty-emails/package.json /app/packages/twenty-emails/
COPY --chown=1000 --from=twenty-server-build /app/packages/twenty-emails/dist /app/packages/twenty-emails/dist
COPY --chown=1000 --from=twenty-server-build /app/packages/twenty-sdk/package.json /app/packages/twenty-sdk/
COPY --chown=1000 --from=twenty-server-build /app/packages/twenty-client-sdk/package.json /app/packages/twenty-client-sdk/
COPY --chown=1000 --from=twenty-server-build /app/packages/twenty-client-sdk/dist /app/packages/twenty-client-sdk/dist
COPY --chown=1000 --from=twenty-server-build /app/packages/twenty-ui/package.json /app/packages/twenty-ui/
COPY --chown=1000 --from=twenty-server-build /app/packages/twenty-front/package.json /app/packages/twenty-front/

LABEL org.opencontainers.image.source=https://github.com/twentyhq/twenty
LABEL org.opencontainers.image.description="Twenty server image (no frontend) — fork build."

RUN mkdir -p /app/.local-storage /app/packages/twenty-server/.local-storage && \
    chown 1000:1000 /app/.local-storage /app/packages/twenty-server/.local-storage

USER 1000

CMD ["node", "dist/main"]
ENTRYPOINT ["/app/entrypoint.sh"]


# -----------------------------------------------------------------------------
# FINAL stage: server + frontend (this is what Railway will deploy)
# -----------------------------------------------------------------------------
FROM twenty-server AS twenty

COPY --chown=1000 --from=twenty-front-build /app/packages/twenty-front/build /app/packages/twenty-server/dist/front

LABEL org.opencontainers.image.description="Twenty CRM (server + frontend) — fork build."
