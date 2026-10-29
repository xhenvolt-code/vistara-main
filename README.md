# Vistara

Vistara is a Uganda-focused streaming-service application built for production
operations: a public discovery experience, customer accounts, an operator
control room, payment and entitlement workflows, and a governed catalogue.
It is designed around Next.js, Neon PostgreSQL and Managed Auth, Neon Object
Storage, Cloudinary, and MarzPay.

This repository contains the application and its production-oriented
foundations. **A production architecture is not the same as a certified live
service:** checkout, media ingestion, protected playback, provider payouts,
and deployment operations still require the release gates below. Do not
advertise a capability as live until its end-to-end checks have passed in the
intended environment.

## Product and system capabilities

| Area | Implemented in this repository | Operational status |
| --- | --- | --- |
| Customer application | Responsive homepage, discovery, movie detail, passes, sign-in/sign-up and reset screens | Catalogue uses sample artwork; only publish content with documented rights |
| Authentication | Neon email auth, Google OAuth callback, profile synchronization, admin allowlists | Verify OAuth, cookies, reset, and account lifecycle on the deployed domain |
| Administration | Overview, catalogue/rights, products, purchase records, users, storage, audit, settings, and revenue-share screens | Server-side authorization is present; review production permissions and migration readiness |
| Payments | MarzPay Uganda collection API helper, callback verification, idempotent reconciliation, and entitlement creation | No live collection or settlement has been certified; the passes page currently says checkout is not enabled |
| Revenue governance | Admin allocations from future verified gross collections, reinvestment preferences, audited payout requests, independent superadmin review | Internal accounting only; no legal equity, provider balance, or automated MarzPay payout |
| Object storage | S3-compatible Neon Object Storage bucket inventory | Upload pipeline and enforced quota are not implemented; dashboard usage is not Neon billing |
| Video | Catalogue asset references and readiness fields | Ingestion, processing, protected playback delivery, and playback entitlement enforcement are not implemented |
| Mobile API | Catalogue, available products, and authenticated profile/entitlement/purchase endpoints | Integrate and validate against the intended client before release |

## Technology

- Next.js 16 App Router, React 19, and Tailwind CSS 4.
- Neon PostgreSQL through Prisma 7 and the Neon serverless adapter.
- Neon Managed Auth for user sessions and social sign-in.
- Neon Object Storage through its S3-compatible endpoint.
- MarzPay collection/reconciliation integration; Cloudinary is a planned media
  provider and is not currently an implemented upload or playback service.
- Node.js and npm. The lockfile is `package-lock.json`.

The interface uses a light palette by default and switches to its dark palette
when the operating system requests dark mode (`prefers-color-scheme`). Vistara
does not change the device's system theme.

## Local development

### Prerequisites

- A supported Node.js version for the locked Next.js dependencies.
- npm.
- A development Neon database and Neon Auth project for database-backed and
  account flows. Never point a local development process at production unless
  a specifically approved operation requires it.
- Optional provider credentials for exercising integrations. Use sandbox or
  test credentials where the provider offers them.

### Setup

1. Install the locked dependencies:

   ```powershell
   npm.cmd ci
   ```

2. Copy `.env.example` to `.env.local` and fill it with **development-only**
   values. `.env.local` is ignored by Git. Never paste secrets into source
   files, issue reports, or agent prompts.
3. Configure `APP_BASE_URL` to the local application URL. Configure the Neon
   Auth base URL, cookie secret, and database connection strings for the
   development project.
4. Add signed-in administrator addresses to `ADMIN_EMAILS`; add elevated
   addresses to `SUPERADMIN_EMAILS`. Superadmins also receive administrator
   access. Authorization checks are server-side.
5. Start the development server:

   ```powershell
   npm.cmd run dev
   ```

6. Open `http://localhost:3000`.

The public homepage currently references local Fliqs template artwork under
`public/fliqs/movies`. Those images are excluded from Git until their
redistribution rights are verified. A fresh clone therefore needs replacement
artwork or removal/replacement of the demo references before that homepage is
visually complete.

## Environment configuration

Use `.env.example` as the variable-name reference. Do not commit `.env.local`.

| Variables | Purpose |
| --- | --- |
| `DATABASE_URL`, `DIRECT_URL` | Neon pooled runtime and direct database connections |
| `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` | Neon Managed Auth endpoint and signed session-cookie secret |
| `APP_BASE_URL` | Canonical application origin used to construct auth callback links |
| `ADMIN_EMAILS`, `SUPERADMIN_EMAILS` | Server-side administrator and superadministrator allowlists |
| `AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `STORAGE_BUCKET` | S3-compatible Neon Object Storage access |
| `STORAGE_HARD_LIMIT_BYTES` | Advisory application storage limit; not an enforced Neon quota |
| `CLOUDINARY_URL` | Cloudinary credential format reserved for media integration |
| `MARZPAY_API_KEY`, `MARZPAY_API_SECRET`, `MARZPAY_BASE_URL` | MarzPay API configuration |
| `MARZPAY_WEBHOOK_SECRET`, `MARZPAY_CALLBACK_URL` | Callback verification/configuration and public webhook URL |

Keep production secrets in the hosting provider's secret manager. Rotate any
credentials that have been shared outside that trusted store. Do not print
secret values while diagnosing provider configuration.

## Database lifecycle and deployment

Prisma models and ordered SQL migrations live in `prisma/`. The Prisma
configuration reads `DIRECT_URL` for migration operations.

Before any deployment:

1. Confirm the target project, branch, and database independently.
2. Review the schema and every unapplied migration; classify data loss,
   backfill, and lock/runtime impact.
3. Take or verify a recoverable backup and rehearse the migration against a
   non-production database.
4. Generate the Prisma client and validate the schema.
5. Apply migrations through the approved deployment workflow, then verify the
   resulting schema and migration history.
6. Deploy the application and run smoke tests against that same environment.

Useful local checks:

```powershell
npm.cmd test
npm.cmd run db:validate
npm.cmd run build
```

`npm.cmd run db:migrate:dev` is for development migrations. `npm.cmd run
db:migrate:deploy` applies pending migrations to the configured direct database
and must not be run casually against production. A passing build or schema
validation alone does not establish that the database, provider credentials,
auth callbacks, or live payment flow work.

For production, configure the deployment origin, HTTPS, database and auth
secrets, administrator allowlists, provider callbacks, and monitoring in the
hosting platform. Confirm the Neon Auth trusted domains and Google OAuth
redirect/callback configuration include the exact deployed origin. Perform an
account sign-in/reset test and payment-provider sandbox/reconciliation test
before enabling public traffic. No specific hosting platform is assumed by
this repository.

## Security and operational boundaries

- Admin and superadmin decisions are checked on the server; a hidden UI link is
  not an authorization boundary.
- Payment state is intended to change only from server-verified provider
  transactions. The admin payment screen is read-only and does not provide a
  manual “mark paid” action.
- Never treat a browser redirect or client-provided payment status as proof of
  settlement.
- Revenue allocations use the percentage assigned when a future payment is
  verified and are calculated from gross UGX purchase amount, before provider
  fees, refunds, and operating costs. This is an internal allocation policy,
  not legal ownership or a provider-confirmed balance.
- Reinvestment marks an internal preference; it does not initiate investment.
  Payout requests need independent superadmin review and an externally
  completed transfer reference. The application does not send payouts through
  MarzPay.
- The storage screen reports objects visible to the configured S3-compatible
  bucket/branch. It is not a project-wide Neon billing meter, and the configured
  cap is advisory until uploads enforce it.
- Catalogue rights metadata is an administrative record, not legal clearance.
  Obtain and retain the actual distribution licence before publishing media.
- Audit entries improve traceability but are not an immutable ledger or a
  substitute for provider statements, accounting controls, or backups.

## Release versioning

Vistara uses strict Semantic Versioning (`MAJOR.MINOR.PATCH`) and matching
annotated Git tags (`vX.Y.Z`). The current repository baseline is `0.1.0`;
`0.x` denotes development, not a guarantee of stable public APIs. Reserve
`1.0.0` for an explicitly approved stable release.

- **Major:** incompatible product/API/data changes; review migration and
  deployment impact.
- **Minor:** backward-compatible features.
- **Patch:** backward-compatible fixes and small corrections.

From a clean working tree, create the next release with one of:

```powershell
npm.cmd run release:patch
npm.cmd run release:minor
npm.cmd run release:major
```

The command updates `package.json` and `package-lock.json`, commits the release
version, and tags that commit. Do not move or reuse released tags. Use
descriptive Conventional Commit subjects for ordinary work. Push the release
commit and tag with `git push origin main --follow-tags` after confirming the
remote and write access.

See [CHANGELOG.md](./CHANGELOG.md) for the recorded baseline.
