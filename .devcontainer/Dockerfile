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
