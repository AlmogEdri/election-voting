# Deploying מנדטים 2026

Production runs as one Docker Compose service on almog-server. The container listens on
port 3000 and is published on host port **7332**. A Cloudflare Tunnel route sends
`vote.almog.uk` to it. The SQLite database lives in a named Docker volume.

```
browser ──https──> Cloudflare ──tunnel──> cloudflared ──http──> host:7332 ──> container:3000
                                                                          └─ volume: /app/prisma/data/app.db
```

## Environment

| Variable | Required | Value |
|---|---|---|
| `ADMIN_SECRET` | yes | Password for `/admin` (sent as the `x-admin-secret` header). At least 12 characters; the container refuses to start without it. Generate one with `openssl rand -base64 24`. |
| `TRUST_PROXY_HEADER` | no | Header that holds the real client IP for the registration rate limit (10 per minute per IP). Compose defaults to `cf-connecting-ip`, which Cloudflare overwrites on every request. |
| `DATABASE_URL` | fixed | `file:./data/app.db`, set in the image and in compose. Prisma resolves relative SQLite paths from `prisma/schema.prisma`, so the file is `/app/prisma/data/app.db`. The volume is mounted there. |

Compose reads `ADMIN_SECRET` from the shell environment or from a `.env` file next to
`docker-compose.yml`:

```bash
cp .env.example .env
# edit .env: set ADMIN_SECRET to a long random value
```

## First deployment

```bash
git clone https://github.com/AlmogEdri/election-voting.git
cd election-voting
cp .env.example .env && $EDITOR .env      # set ADMIN_SECRET
docker compose up -d --build
docker compose logs -f app                # "applying migrations" → "seeding defaults" → "Ready"
curl -s http://127.0.0.1:7332/api/parties | head -c 200
docker compose exec app id                # uid=1000(node): the app does not run as root
```

On every start the container:

1. checks `ADMIN_SECRET`, `DATABASE_URL` and that the data directory is writable,
2. runs `prisma migrate deploy` (it stops here and does not start the server if a migration fails),
3. runs the seed. The seed only inserts missing rows, so lists, candidates and settings edited in `/admin` are kept,
4. starts `next start` on port 3000.

## Cloudflare Tunnel (owner)

Add a public hostname to the existing tunnel:

- **Hostname:** `vote.almog.uk`
- **Service:** `http://localhost:7332` if cloudflared runs on the host. If cloudflared runs in
  Docker, use whatever address it uses to reach the host, for example
  `http://host.docker.internal:7332` or the host's LAN IP.

Port 7332 is published on all interfaces. Anyone who can reach the host directly (for example
on the LAN) can bypass Cloudflare and send their own `cf-connecting-ip`, which defeats the
registration rate limit. If cloudflared runs on the host, publish only on loopback by changing
the port mapping to `"127.0.0.1:7332:3000"`.

## Volume and permissions

- The named volume is `election-voting_election-data`. The compose project name is pinned to
  `election-voting`, so manual and CI deployments use the same volume.
- The image creates `/app/prisma/data` owned by `node` (uid 1000). A new named volume
  inherits that ownership.
- If you switch to a bind mount (`./data:/app/prisma/data`), run `sudo chown -R 1000:1000 ./data`
  first. Otherwise the container stops with "is not writable by uid 1000".

## Backup and restore

Online backup. It is consistent while the app is running because it uses SQLite `VACUUM INTO`:

```bash
docker compose exec app node scripts/backup-db.mjs
# -> /app/prisma/data/backups/app-<timestamp>.db (inside the volume)
docker compose cp app:/app/prisma/data/backups/. ./backups/
```

Restore:

```bash
docker compose stop app
docker run --rm -v election-voting_election-data:/data -v "$PWD/backups":/backup busybox \
  sh -c 'cp /backup/app-<timestamp>.db /data/app.db && chown 1000:1000 /data/app.db'
docker compose start app
```

## Upgrades and rollback

```bash
docker compose exec app node scripts/backup-db.mjs   # always back up first
git pull
docker compose up -d --build                         # migrations run on start
```

To roll back, check out the previous commit and run `docker compose up -d --build`.
Migrations only move forward. If the upgrade added a migration, also restore the backup you
took before upgrading, because the older code may not match the newer schema.

## Lock time and time zones

- The default lock is `2026-10-27T20:00:00Z`, which is **22:00 Israel time** on 27.10.2026,
  when the polls close. Israel is on IST (UTC+2) by then, because DST ends on 25.10.2026.
- Lock modes, set in `/admin`:
  - `scheduled`: voting locks automatically at the lock time.
  - `closed`: voting is locked now.
  - `open`: voting stays open even after the lock time (reopen).
- The admin date-time field uses the time zone of the admin's browser. The server stores UTC.

## CI/CD

`.github/workflows/ci.yml` runs on every push and pull request:

- **check** (GitHub-hosted runner): runs these one after another: lint and typecheck, Vitest,
  `next build`, then `scripts/smoke.sh` against `next start` on a disposable SQLite file.
- **deploy** (self-hosted runner on almog-server): runs only on pushes to `main`, and only when
  the repository variable `DEPLOY_ENABLED` is `true`. It runs `docker compose up -d --build`
  in the runner checkout and waits for `/api/parties` on port 7332.

To enable deploys:

1. Register a self-hosted runner on almog-server whose user can run `docker`.
2. Repository → Settings → Secrets and variables → Actions:
   - secret `ADMIN_SECRET`
   - variable `DEPLOY_ENABLED` = `true`

## Verification after a deployment

```bash
# Full HTTP smoke test. It creates and then deletes its own test users. It also locks voting
# for a few seconds and then restores the previous lock settings, so avoid running it during
# the live vote. Prefer a disposable database.
ADMIN_SECRET=... scripts/smoke.sh http://127.0.0.1:7332

# Persistence across container re-creation
B=http://127.0.0.1:7332
TOKEN=$(curl -s -X POST $B/api/register -H 'content-type: application/json' \
  -d '{"name":"בדיקת התמדה"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).deviceToken')
SEATS=$(curl -s $B/api/parties | node -pe \
  'JSON.stringify(Object.fromEntries(JSON.parse(require("fs").readFileSync(0)).parties.map(p=>[p.id,p.defaultSeats])))')
curl -s -X PUT $B/api/vote -H 'content-type: application/json' -H "x-device-token: $TOKEN" \
  -d "{\"seats\":$SEATS,\"pmCandidateId\":\"new-elections\"}"
docker compose up -d --force-recreate
sleep 10
curl -s $B/api/me -H "x-device-token: $TOKEN"   # the user and the vote are still there
curl -s $B/api/stats                            # "בדיקת התמדה" is listed in names
# Remove the test user afterwards in /admin → משתמשים.
```
