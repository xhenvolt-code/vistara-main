# Vistara

Vistara is a Next.js streaming-service foundation using Neon for PostgreSQL,
managed authentication, and object storage, with MarzPay as the planned payment
provider. The current catalogue is a UI preview using sample artwork; it is
not a rights-cleared film catalogue and does not provide playback.

## Local setup

1. Install dependencies with `npm install`.
2. Keep the existing `.env.local` private and fill any missing values using
   `.env.example` as a reference. Never commit `.env.local`.
3. Configure `MARZPAY_CALLBACK_URL` as the public HTTPS URL of
   `/api/payments/marzpay/webhook` before accepting payments.
4. Set `ADMIN_EMAILS` to a comma-separated list of administrator email
   addresses registered with Neon Auth. Set `SUPERADMIN_EMAILS` for
   superadministrators; superadmins also receive administrator access.
5. Start the app with `npm run dev`, then open `http://localhost:3000`.

The local demo movie artwork under `public/fliqs/movies` is excluded from Git
until its redistribution license is verified. Supply appropriately licensed
artwork locally or replace the demo references before using the public
homepage in a fresh clone.

Useful checks:

```powershell
npm test
npm run db:validate
npm run build
```

## Versioning and releases

Vistara follows Semantic Versioning with strict `MAJOR.MINOR.PATCH` versions.
The repository starts at `0.1.0`. While the product is before its first stable
release, `0.x` versions indicate development and do not promise a stable public
API. When Vistara is declared stable, the first stable release should be
`1.0.0`.

- **Major** (`x.0.0`): a substantial incompatible product, API, or data-model
  change; explicitly review migration and deployment impact.
- **Minor** (`x.y.0`): a backward-compatible feature or substantial capability.
- **Patch** (`x.y.z`): a backward-compatible fix, small improvement, or
  documentation-only correction.

Use the matching release command from a clean working tree:

```powershell
npm.cmd run release:patch
npm.cmd run release:minor
npm.cmd run release:major
```

Each command updates `package.json` and `package-lock.json`, creates a
`chore(release): x.y.z` commit, and creates the matching annotated Git tag
`vx.y.z` on that commit. Push release commits and tags together with
`git push origin main --follow-tags`. Do not reuse or move a released version
tag. For ordinary work, use descriptive commit subjects (prefer Conventional
Commits such as `feat:`, `fix:`, and `docs:`); only create a release version
when the corresponding change is ready to identify as a release.

Prisma migrations are applied to the configured Neon database. Review new
migrations before deploying them to any other environment.

## Implemented foundations

- Neon Managed Auth sign-up/sign-in routes and server-side administrator
  allowlisting, email reset, Google OAuth callback, and profile synchronization.
- Admin control room with overview metrics, rights-gated catalogue management,
  access product pricing and availability, read-only payment reconciliation,
  superadmin-only user status controls, storage inventory, audit history, and
  integration readiness.
- Superadmin-managed administrator revenue-share allocations, per-allocation
  reinvestment preferences, and audited payout requests with independent review.
- Prisma models for users, films and rights, products, purchases, payments,
  entitlements, TikTok mappings, settings, and audit records.
- MarzPay Uganda mobile-money collection initiation and webhook reconciliation.
  The webhook verifies provider status server-to-server when a signature is
  unavailable, and successful payment events are handled idempotently.
- Neon Object Storage bucket inventory and an admin-managed application limit.
- A responsive discovery experience backed by published, rights-approved
  catalogue entries and admin-managed access passes.
- Mobile API endpoints for the rights-approved catalogue, currently available
  passes, and the authenticated profile, entitlement, and purchase history.

## Operational limitations

- No live MarzPay collection has been initiated. Confirm merchant terms and
  configure a reachable HTTPS callback URL before enabling checkout.
- The storage dashboard totals S3 objects visible on the configured branch;
  it is not Neon’s project-wide billing meter and does not include other
  branches. The application limit is currently a setting/dashboard control,
  not an enforced upload quota; upload handling is not implemented yet.
- Revenue shares are an internal allocation of verified gross purchase amounts
  before provider fees, refunds, and operating costs. They are not legal equity
  or a provider-reported available balance. Reinvestment records a preference;
  payout requests require review and an external transfer reference. MarzPay
  payout execution and refund/reversal reconciliation are not integrated.
- The revenue-share migration must be reviewed and applied to each intended
  database before using the finance screen. It does not backfill historical
  purchases; allocations begin on future verified payments after deployment.
- Database-backed features require the reviewed Prisma migration to be applied
  to the intended Neon database.
- The supplied Cloudinary configuration is present in the environment, but
  Cloudinary uploads and playback delivery are not implemented or verified.
- The catalogue supports external poster/backdrop URLs and asset references,
  but playback delivery is not implemented. Publish only media with verified
  distribution and streaming rights.

## Environment variables

See `.env.example` for the expected variable names. Important groups:

- `DATABASE_URL`, `DIRECT_URL`: Neon pooled runtime and direct migration URLs.
- `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`: Neon Managed Auth setup.
- `AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
  `AWS_REGION`, `STORAGE_BUCKET`: Neon Object Storage access.
- `STORAGE_HARD_LIMIT_BYTES`: initial application storage-limit setting.
- `CLOUDINARY_URL`: Cloudinary API credentials.
- `MARZPAY_API_KEY`, `MARZPAY_API_SECRET`, `MARZPAY_BASE_URL`,
  `MARZPAY_WEBHOOK_SECRET`, `MARZPAY_CALLBACK_URL`: MarzPay integration.
- `APP_BASE_URL`, `ADMIN_EMAILS`, `SUPERADMIN_EMAILS`: public application URL,
  administrator allowlist, and elevated account-management allowlist.
