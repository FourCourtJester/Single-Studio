# Node image. Floating the patch inside the LTS line so rebuilds pick up security
# fixes; the major is pinned because that is what the test suite runs against.
FROM node:22-bookworm

# pnpm is installed directly rather than through corepack.
#
# `corepack enable` alone makes container creation depend on a signed registry
# lookup for "latest stable pnpm", verified against keys baked into whichever
# corepack shipped with the base image. When those keys lag npm's current signing
# keys, the build dies with "Cannot find matching keyid" -- a network- and
# date-dependent failure in the one step that has to be boringly reliable.
#
# Keep this version in step with "packageManager" in the root package.json.
RUN npm install -g pnpm@10.33.0

# Add default packages

RUN npm install -g npm-check-updates

# Chromium for the browser smoke test.
#
# This lives in the image because installing it needs root twice over: Playwright's
# --with-deps runs apt-get for the shared libraries Chromium links against, and the
# default browser cache sits under root's home. The devcontainer runs as `node`, so
# doing it at runtime prompts for a password nobody has.
#
# PLAYWRIGHT_BROWSERS_PATH puts the download somewhere both users can reach, and
# handing the directory to `node` afterwards means a later `pnpm e2e:browser` can
# re-download without root when the Playwright version moves on.
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers
RUN mkdir -p /opt/pw-browsers \
 && npx --yes playwright@1.62.1 install --with-deps chromium \
 && chown -R node:node /opt/pw-browsers
