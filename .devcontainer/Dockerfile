# Node image
FROM node:22.11.0

# pnpm ships with Node via corepack; enabling it here means the container has the
# right version before postCreateCommand runs.
RUN corepack enable

# Add default packages

RUN npm install -g npm-check-updates
