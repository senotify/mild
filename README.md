# Mild

A Medium-style publishing platform at **https://mild.senotify.com**. Open signups,
claps, responses, follows, a library, full-text search, and SEO (SSR, sitemap,
RSS, JSON-LD).

- Next.js 16 (App Router, standalone) + SQLite (better-sqlite3, FTS5), one container
- Data: the `mild-data` docker volume (`/data/mild.db`, `/data/uploads/`)
- Deploy: push to `master` → GHCR → VPS (see `.github/workflows/deploy.yml`)
- Edge: Caddy block `mild.senotify.com { reverse_proxy mild:3000 }` in `senotify-deploy`

## Daily posts

`content/posts/YYYY-MM-DD-slug.md` files are synced into the DB as published posts
by **@senotify**, at boot and every minute (keyed on filename, so re-runs never
duplicate). A scheduled Claude routine writes one a day following
[`content/WRITING.md`](content/WRITING.md). If the routine opens a PR instead of
pushing, `automerge-posts.yml` merges it when it touches only `content/posts/*.md`.

Frontmatter:

```yaml
---
title: "..."
subtitle: "..."
tags: [backend, ai]   # up to 5
# date: 2026-11-24    # optional, defaults to the filename date
# draft: true         # skip syncing
---
```

## Owner account

Created once, never through public signup (the `senotify` handle is reserved):

```sh
docker exec -it -e OWNER_EMAIL=you@example.com -e OWNER_PASSWORD='...' mild node scripts/seed-owner.mjs
```

Re-running it resets the password.

## Backups and restore

`backup.yml` runs nightly (02:30 WIB), takes an online `sqlite3 .backup` plus
uploads, and stores it as an Actions artifact for 90 days.

Restore:

```sh
gh run download <run-id> -R senotify/mild      # gets mild-backup.tgz
scp mild-backup.tgz ubuntu@43.134.26.159:/tmp/
ssh ubuntu@43.134.26.159
docker stop mild
docker run --rm -v mild-data:/data -v /tmp:/in alpine sh -c \
  'cd /data && tar xzf /in/mild-backup.tgz && mv backup.db mild.db && rm -f mild.db-wal mild.db-shm && chown -R 1000:1000 /data'
docker start mild
```

## Local dev

```sh
npm install
npm run dev            # data goes to ./data
```
