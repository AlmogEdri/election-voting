#!/usr/bin/env bash
# End-to-end HTTP smoke test against a running server.
#   ADMIN_SECRET=... scripts/smoke.sh [base-url]      (default http://127.0.0.1:3000)
# Covers pages, registration, identity, voting rules, stats, admin lock/reopen
# and the registration rate limit. It restores the lock settings and deletes the
# users it created, but run it against a disposable database when you can.
set -euo pipefail

BASE="${1:-${BASE_URL:-http://127.0.0.1:3000}}"
: "${ADMIN_SECRET:?set ADMIN_SECRET to the admin secret of the server}"
RUN="$(date +%s)$RANDOM"
# Per-run client IP (documentation range) so earlier runs do not share a rate-limit bucket.
IP="198.51.$((RANDOM % 250)).$((RANDOM % 250 + 1))"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
PASSED=0

fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "ok   $*"; PASSED=$((PASSED + 1)); }

# req METHOD PATH [BODY] [extra curl args...]  → $STATUS, response in $TMP/body
req() {
  local method="$1" path="$2" body="${3:-}"
  shift $(($# < 3 ? $# : 3))
  local args=(--noproxy '*' -sS -o "$TMP/body" -w '%{http_code}' -X "$method" "$BASE$path"
    -H 'content-type: application/json' -H "x-forwarded-for: $IP" -H "cf-connecting-ip: $IP")
  [[ -n "$body" ]] && args+=(--data-binary "$body")
  STATUS="$(curl "${args[@]}" "$@")"
}
expect() { [[ "$STATUS" == "$1" ]] || fail "$2: expected HTTP $1, got $STATUS: $(head -c 300 "$TMP/body")"; ok "$2 (HTTP $STATUS)"; }
has() { grep -qF -- "$1" "$TMP/body" || fail "$2: response lacks '$1'"; ok "$2"; }
lacks() { ! grep -qF -- "$1" "$TMP/body" || fail "$2: response contains '$1'"; ok "$2"; }
# jget 'expression over d' → evaluates against the last JSON response
jget() {
  node -e 'const d=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const v=new Function("d","return ("+process.argv[2]+")")(d);process.stdout.write(typeof v==="string"?v:JSON.stringify(v))' "$TMP/body" "$1"
}
check() { [[ "$(jget "$1")" == "true" ]] || fail "$2: $(head -c 300 "$TMP/body")"; ok "$2"; }
admin() { req "$1" "/api/admin/$2" "${3:-}" -H "x-admin-secret: $ADMIN_SECRET"; }

echo "smoke: $BASE (run $RUN)"

# --- pages -----------------------------------------------------------------
req GET / ; expect 200 "GET /"
has '<html lang="he" dir="rtl"' "RTL Hebrew markup"
has '<title>מנדטים 2026</title>' "Hebrew title"
has 'name="viewport" content="width=device-width, initial-scale=1"' "viewport meta"
has 'for="name"' "labelled name field"
has 'להצבעה' "submit button"

req GET /vote ; expect 200 "GET /vote"
has 'type="range"' "seat sliders"
has 'data-testid="seat-counter"' "sticky seat counter"
has 'התחל מהסקרים' "start-from-polls button"

req GET /vote/prime-minister ; expect 200 "GET /vote/prime-minister"
has 'בחירות נוספות' "new-elections option"

req GET /admin ; expect 200 "GET /admin"
has 'type="password"' "admin password field"
lacks "$ADMIN_SECRET" "admin page does not expose the secret"

# --- configuration -----------------------------------------------------------
req GET /api/parties ; expect 200 "GET /api/parties"
check 'd.parties.length===14 && d.pmCandidates.length===9' "14 lists and 9 PM choices"
check 'd.pmCandidates.at(-1).id==="new-elections"' "'בחירות נוספות' is last"
SEATS="$(jget 'Object.fromEntries(d.parties.map(p=>[p.id,p.defaultSeats]))')"
FIRST="$(jget 'd.parties[0].id')"
ZERO="$(jget 'd.parties.find(p=>!p.withdrawn&&p.defaultSeats===0).id')"
WITHDRAWN="$(jget '(d.parties.find(p=>p.withdrawn)||{}).id||""')"
MIN="$(jget 'd.minSeats')"
seats_with() { node -e 'const s=JSON.parse(process.argv[1]);for(const kv of process.argv.slice(2)){const[k,v]=kv.split("=");s[k]=Number(v)}process.stdout.write(JSON.stringify(s))' "$SEATS" "$@"; }
FIRST_SEATS="$(node -e 'process.stdout.write(String(JSON.parse(process.argv[1])[process.argv[2]]))' "$SEATS" "$FIRST")"

admin GET settings ; expect 200 "admin settings"
ORIGINAL_LOCK="$(jget 'JSON.stringify({lockMode:d.lockMode,lockAt:d.lockAt})')"
if [[ "$(jget 'd.locked')" == "true" ]]; then
  admin POST settings '{"lockMode":"open"}' ; expect 200 "temporarily open voting for the smoke run"
fi

# --- registration ------------------------------------------------------------
NAME="smoke-$RUN"
req POST /api/register "{\"name\":\"  $NAME \"}" ; expect 201 "register"
TOKEN="$(jget 'd.deviceToken')"
USER_ID="$(jget 'd.userId')"
req POST /api/register "{\"name\":\"SMOKE-$RUN\"}" ; expect 409 "duplicate name (case/spacing)"
has 'השם תפוס' "Hebrew taken-name message"
req POST /api/register '{"name":"x"}' ; expect 400 "too-short name"
req POST /api/register "{\"name\":\"בודק $RUN\"}" ; expect 201 "register a Hebrew name"
TOKEN2="$(jget 'd.deviceToken')"

req GET /api/me ; expect 401 "/api/me without token"
req GET /api/me "" -H 'x-device-token: nope' ; expect 401 "/api/me with unknown token"
req GET /api/me "" -H "x-device-token: $TOKEN" ; expect 200 "/api/me"
check "d.user.name===\"$NAME\" && d.vote===null" "/api/me returns own user without vote"

# --- voting --------------------------------------------------------------------
vote() { req PUT /api/vote "$1" -H "x-device-token: ${2:-$TOKEN}"; }
vote "{\"seats\":$SEATS,\"pmCandidateId\":\"netanyahu\"}" "nope" ; expect 401 "vote with unknown token"
vote "{\"seats\":$(seats_with "$FIRST=$((FIRST_SEATS - 1))"),\"pmCandidateId\":\"netanyahu\"}" ; expect 400 "vote with total 119"
has '119' "wrong-sum message mentions the total"
vote "{\"seats\":$(seats_with "$FIRST=$((FIRST_SEATS + 1))"),\"pmCandidateId\":\"netanyahu\"}" ; expect 400 "vote with total 121"
if [[ "$MIN" -gt 1 ]]; then
  vote "{\"seats\":$(seats_with "$FIRST=$((FIRST_SEATS - 2))" "$ZERO=2"),\"pmCandidateId\":\"netanyahu\"}" ; expect 400 "vote below threshold (2 seats)"
fi
if [[ -n "$WITHDRAWN" ]]; then
  vote "{\"seats\":$(seats_with "$FIRST=$((FIRST_SEATS - 4))" "$WITHDRAWN=4"),\"pmCandidateId\":\"netanyahu\"}" ; expect 400 "vote for a withdrawn list"
fi
vote "{\"seats\":$SEATS,\"pmCandidateId\":\"nobody\"}" ; expect 400 "vote with unknown PM candidate"
vote '{not json' ; expect 400 "malformed JSON"
vote "{\"seats\":$SEATS,\"pmCandidateId\":\"netanyahu\"}" ; expect 200 "valid vote"
check 'd.ok===true' "vote response {ok:true}"
vote "{\"seats\":$(seats_with "$FIRST=$((FIRST_SEATS - 4))" "$ZERO=4"),\"pmCandidateId\":\"new-elections\"}" ; expect 200 "resubmit (edit) vote"
vote "{\"seats\":$SEATS,\"pmCandidateId\":\"bennett\"}" "$TOKEN2" ; expect 200 "second user's vote"
req GET /api/me "" -H "x-device-token: $TOKEN" ; expect 200 "/api/me after voting"
check "d.vote.pmCandidateId===\"new-elections\" && d.vote.seats[\"$ZERO\"]===4" "/api/me returns the edited vote"

# --- stats ---------------------------------------------------------------------
req GET /api/stats ; expect 200 "GET /api/stats"
check "d.participants>=2 && d.names.includes(\"$NAME\") && typeof d.avgSeats[\"$FIRST\"]===\"number\" && \"new-elections\" in d.pmShare" "stats shape and content"
lacks "$TOKEN" "stats do not leak tokens"
lacks '"seats"' "stats do not expose individual ballots"
req GET /results ; expect 200 "GET /results"
has 'ממוצע כולם' "results page average label"
has "$NAME" "results page lists voter names"

# --- admin lock / reopen ---------------------------------------------------------
req POST /api/admin/settings '{"lockMode":"closed"}' ; expect 401 "admin without secret"
req POST /api/admin/settings '{"lockMode":"closed"}' -H 'x-admin-secret: wrong' ; expect 401 "admin with wrong secret"
admin POST settings '{"lockMode":"closed"}' ; expect 200 "admin: lock"
vote "{\"seats\":$SEATS,\"pmCandidateId\":\"netanyahu\"}" ; expect 423 "vote while locked"
req GET /api/parties ; check 'd.locked===true' "/api/parties reports locked"
req GET /api/stats ; check 'd.locked===true' "/api/stats reports locked"
admin POST settings '{"lockMode":"open"}' ; expect 200 "admin: reopen"
vote "{\"seats\":$SEATS,\"pmCandidateId\":\"netanyahu\"}" ; expect 200 "vote after reopening"
admin POST settings '{"lockMode":"scheduled","lockAt":"2000-01-01T00:00:00Z"}' ; expect 200 "admin: schedule a past deadline"
vote "{\"seats\":$SEATS,\"pmCandidateId\":\"netanyahu\"}" ; expect 423 "vote after the scheduled deadline"
admin POST settings "$ORIGINAL_LOCK" ; expect 200 "admin: restore original lock settings"
admin POST settings '{"lockMode":"sometimes"}' ; expect 400 "admin: invalid lock mode"
admin POST configuration '{"parties":[],"pmCandidates":[]}' ; expect 400 "admin: invalid configuration"

# --- cleanup -------------------------------------------------------------------
admin GET settings
for id in $(jget "d.users.filter(u=>u.name.endsWith(\"$RUN\")).map(u=>u.id).join(\" \")"); do
  admin POST delete-user "{\"userId\":\"$id\"}" ; expect 200 "delete smoke user"
done
req GET /api/me "" -H "x-device-token: $TOKEN" ; expect 401 "deleted user's token no longer works"

# --- rate limit (last: it exhausts this run's IP bucket) -------------------------
IP="203.0.$((RANDOM % 250)).$((RANDOM % 250 + 1))"
for i in $(seq 1 10); do
  req POST /api/register '{"name":"x"}'
  [[ "$STATUS" == "400" ]] || fail "rate limit: attempt $i returned $STATUS"
done
ok "10 registration attempts allowed"
req POST /api/register '{"name":"x"}' ; expect 429 "11th registration attempt in a minute"

echo "smoke: all $PASSED checks passed"
