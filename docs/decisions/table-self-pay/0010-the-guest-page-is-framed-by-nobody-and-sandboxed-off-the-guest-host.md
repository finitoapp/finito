# 0010 The guest page is framed by nobody and sandboxed off the guest host

Status: accepted
Date: 2026-10-14

## Context

The guest page `/t` is what strangers open from a sticker
(`table-self-pay/0020`). It is a separate entry with no Evolu, no account
state and no Sentry. The merchant app on the same deployment holds the
account and its keys in its origin. The page's own content security policy
is a `<meta>` tag (`vite.config.ts`), where browsers ignore
`frame-ancestors`.

## Decision

Vercel serves `/t` only on a host whose name starts with `t.`, which must
be the host of `VITE_PAYKY_SELF_PAY_ORIGIN`, and every other page on that
host is sandboxed, so the guest page never shares an origin with the
merchant app. On any other host, `/t` is sandboxed with `default-src
'none'`. Every `/t` response carries `frame-ancestors 'none'` as a header,
so no site may frame the guest page on any host (`vercel.json`).

## Alternatives considered

None recorded.

## Consequences

A deployment that offers self-pay needs the guest host. `/t` opened on the
app's own host renders nothing usable, and neither does the merchant app
opened on the guest host. The header in `vercel.json` is
the only thing that keeps other sites from framing the guest page, so
moving off Vercel has to carry it over.

## Enforced by

- `apps/web-app/src/guest-origin.test.ts > the guest page's origin > is the only host a rewrite serves the guest page on`
- `apps/web-app/src/guest-origin.test.ts > the guest page's origin > sandboxes the guest page on any other host`
- `apps/web-app/src/guest-origin.test.ts > the guest page's origin > sandboxes every other page on the guest host`
- `apps/web-app/src/guest-origin.test.ts > the guest page's origin > lets no site frame the guest page on any host`
