import { defineConfig } from 'vitepress'

// The documentation site, built from the same markdown the repository already has.
//
// Nothing is written twice. These files are read on GitHub as well, so the site is a
// second rendering rather than a second copy -- api.md in particular is generated
// from the shipped types by scripts/api-reference.mjs, and a site that carried its
// own edition of it would be one more thing to drift.
//
// `base` is the repository name because this deploys to a GitHub Pages project site,
// which serves from a subpath. The demo studio is a separate repository with its own
// deployment; this one is the landing page and the documentation.
export default defineConfig({
  title: 'Single Studio',
  description: 'Broadcast graphics for OBS, as React components. No server, no backend, nothing to deploy but static files.',
  base: '/Single-Studio/',
  cleanUrls: true,
  lastUpdated: true,

  // Everything under internal/ is for working on the framework rather than with it:
  // a design plan, release mechanics, and the architecture notes. They stay in the
  // repository and stay off the site, which is the same split docs/internal/ makes.
  srcExclude: ['internal/**', 'api-review.md'],

  head: [['meta', { name: 'theme-color', content: '#0ea5e9' }]],

  themeConfig: {
    nav: [
      { text: 'Getting started', link: '/getting-started' },
      { text: 'Components', link: '/api' },
      { text: 'Your own data', link: '/data' },
      { text: 'Demo', link: 'https://fourcourtjester.github.io/Single-Studio-Demo/#/' },
      {
        text: 'v0.2.0',
        items: [
          { text: 'Changelog', link: 'https://github.com/FourCourtJester/Single-Studio/blob/main/CHANGELOG.md' },
          { text: 'npm', link: 'https://www.npmjs.com/package/@single-studio/core' },
        ],
      },
    ],

    sidebar: [
      {
        text: 'Start',
        items: [
          { text: 'Getting started', link: '/getting-started' },
          { text: 'Working with other people', link: '/collaborating' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'Components', link: '/api' },
          { text: 'Your own data', link: '/data' },
        ],
      },
    ],

    socialLinks: [{ icon: 'github', link: 'https://github.com/FourCourtJester/Single-Studio' }],

    editLink: {
      pattern: 'https://github.com/FourCourtJester/Single-Studio/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    search: { provider: 'local' },

    footer: {
      message: 'MIT licensed',
      copyright: '© Shaun Delaney',
    },
  },
})
