# External Accounts

You do not need any new accounts for the current local mock-data phase.

## Needed Next

### Neon

Purpose: Postgres database for metadata such as pieces, lessons, practice tasks,
practice sessions, tags, and timestamps.

Official setup docs: https://neon.com/docs/get-started/signing-up

We will create:

- one Neon account
- one project/database
- one `DATABASE_URL` secret in `.env.local`

## Needed Later

### Cloudflare R2

Purpose: object storage for files such as lesson recordings, practice
recordings, lead sheet PDFs/images, and annotated versions.

Official R2 docs:

- Get started: https://developers.cloudflare.com/r2/get-started/
- Create buckets: https://developers.cloudflare.com/r2/buckets/create-buckets/

We will create:

- one Cloudflare account
- one private R2 bucket
- S3-compatible access credentials
- server-side signed upload/download handling

### OpenAI API

Purpose: server-side transcription and later extraction. This remains behind the
Practice Loop transcription password in v1.

Official docs:

- API quickstart: https://platform.openai.com/docs/quickstart
- API key help: https://help.openai.com/en/articles/4936850-where-do-i-find-my-openai-api-key

We will create or confirm:

- one OpenAI API project/key
- `OPENAI_API_KEY` in `.env.local`
- a server-side transcription route that never exposes the key to the browser

## Deployment Later

### Vercel or Netlify

Purpose: host the private Next.js app.

Official docs:

- Vercel import project: https://vercel.com/docs/getting-started-with-vercel/import
- Netlify Next.js overview: https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/

We only need this after the app is worth using beyond local development.

## Not Needed For V1

- Stripe
- paid plans
- public user accounts
- transcription credit ledgers
- admin/billing dashboards
