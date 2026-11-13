# Landing deployment

The landing site is a separate Bun workspace and Vercel project. Its public
URL remains `https://payky.me/landing`. Shipping it does not change the app's
version, production branch or native release.

## Vercel setup

1. Create two projects from `finitoapp/payky`, both with Root Directory `apps/landing`.
   Enable files outside the Root Directory as build inputs. The committed
   `vercel.json` installs from the root and runs `bun run build:landing`.
2. Configure the projects as follows, independently of the app's `production`
   branch and CalVer release:

   | Project | Production Branch | Stable upstream | App |
   | --- | --- | --- | --- |
   | `payky-landing-edge` | `main` | `payky-landing-edge.vercel.app` | `payky-edge` at `edge.payky.me` |
   | `payky-landing` | `landing-production` | `payky-landing.vercel.app` | `payky` at `payky.me` |

   Create `landing-production` from a verified commit containing `apps/landing`
   before its first deployment. Disable preview deployments on `payky-landing`
   and set its Ignored Build Step to `[ "$VERCEL_GIT_COMMIT_REF" != "landing-production" ]`.
   Keep the upstreams publicly accessible so the app's rewrites can fetch them.
   If Vercel assigns different stable addresses, update `apps/web-app/vercel.json`.
3. Deploy both landing projects first. Verify `/landing`, `/landing/en`,
   `/landing/eet-2-0`, `/landing/jak-to-funguje`, `/landing/privacy`, their language variants,
   and their `/landing/assets/` resources on its stable address.
4. Deploy the web-app proxy configuration to edge, then through the normal
   app release to production. Keep both public domains attached to their app
   projects. Host conditions route `edge.payky.me` and `payky-edge`'s Vercel
   aliases, including previews, to `payky-landing-edge`; other app hosts use
   `payky-landing`. Rewrites preserve `/landing`, including assets, and forward
   `/sitemap.xml` to the corresponding landing project's root sitemap.
5. Later landing changes ship to edge on a push to `main`. Promote a verified
   commit by moving `landing-production` to it; this deploys only the production
   landing. Use the corresponding landing project's rollback to revert it.
   No CalVer bump or app release is needed.

`/api/contact`, `/manifest.webmanifest`, app icons and the service worker
remain in the web-app project. The landing logo and favicon are served by
the landing project itself at `/landing/pwa-icon.svg`, including on its
standalone Vercel domains. Test contact and installation through the
public origin: the standalone landing deployment does not host those root
endpoints. Set `VITE_PAYKY_API_BASE_URL=https://payky.me` on the landing
production project if its standalone previews should send contact requests there;
use `https://edge.payky.me` for `payky-landing-edge`.
By default, the form calls its current origin. No server secrets are needed
in the landing project.

The root robots file remains with web-app. Canonical URLs, hreflang and
sitemap entries keep pointing at `https://payky.me/landing`, never at the
upstream deployment address. The prerender writes `sitemap.xml` for the
brand being built.

The same workspace builds Finito's landing on `finito.fit` when
`PAYKY_LANDING_BRAND=finito` (landing/0013, `docs/finito-deployment.md`).

## Development and verification

- `bun run dev` starts both workspaces. Open the web-app server's URL to
  exercise redirects, installation and contact on one origin.
- `bun run dev:landing` starts just the landing on
  `http://127.0.0.1:5175/landing`.
- `bun run build` builds only core and the payment web app.
- `bun run build:landing` builds only core and the marketing site.
- `bun run preview:landing` serves the prerendered site after its build.
- `bun run check` checks both workspaces and the shared browser package.
- `bun run test:e2e:preview` builds and serves both sites for browser tests.

`PAYKY_LANDING_ORIGIN` changes the local web-app proxy target, defaulting to
`http://127.0.0.1:5175`. The web-app's Vercel rewrites use the stable landing
upstream for the matching app environment. A `payky-edge` preview therefore
shows the landing from `main`, rather than that preview's branch. Local E2E
tests exercise the two workspaces from the same checkout.

Landing primitives in `apps/landing/src/components/ui` are byte-for-byte
copies of installed shadcn components. Update them through the registry
using `apps/landing/components.json`; do not hand-edit them. Business UI,
styles and translations are owned by landing. Both apps use
`@payky/web-shared` subpaths for the browser navigation/storage contract and
shared hooks; do not import runtime code across application workspaces.
