#!/bin/bash
# Login and push the fresh access token into the Postman cloud collection,
# so every request authenticates. Usage:
#   ./get-token.sh james@circle.com 12345678   # password login
#   ./get-token.sh ada@circle.com              # dev login (local API only)
set -euo pipefail

API="${API_URL:-http://localhost:3000}"
COLLECTION_UID="${COLLECTION_UID:-24563448-fd2a4ba5-71f1-4921-b5b0-a0592e441e68}"
EMAIL="${1:?usage: get-token.sh <email> [password] [name]}"
PASSWORD="${2:-}"
NAME="${3:-Demo}"

if [ -z "${POSTMAN_API_KEY:-}" ]; then
  echo "Set POSTMAN_API_KEY first (same key as the MCP server)." >&2
  exit 1
fi

if [ -n "$PASSWORD" ]; then
  BODY=$(python3 -c "import json; print(json.dumps({'email':'$EMAIL','password':'$PASSWORD'}))")
  PATH_="login"
else
  BODY=$(python3 -c "import json; print(json.dumps({'email':'$EMAIL','name':'$NAME'}))")
  PATH_="dev-login"
fi

TOKEN=$(curl -s --max-time 10 -X POST "$API/auth/$PATH_" \
  -H 'Content-Type: application/json' -d "$BODY" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

python3 - "$TOKEN" <<'EOF'
import json, sys, urllib.request
token = sys.argv[1]
key = __import__('os').environ['POSTMAN_API_KEY']
uid = __import__('os').environ.get('COLLECTION_UID', '24563448-fd2a4ba5-71f1-4921-b5b0-a0592e441e68')
base = 'https://api.getpostman.com'

def call(url, data=None, method='GET'):
    r = urllib.request.Request(url,
        data=json.dumps(data).encode() if data is not None else None,
        headers={'Content-Type': 'application/json', 'X-API-Key': key}, method=method)
    with urllib.request.urlopen(r, timeout=30) as resp:
        return json.load(resp)

col = call(f'{base}/collections/{uid}')['collection']
info = {k: col[k] for k in ('info', 'item', 'variable', 'auth', 'event') if k in col}
found = False
for v in info.get('variable', []):
    if v.get('key') == 'tokenA':
        v['value'] = token
        found = True
if not found:
    info.setdefault('variable', []).append({'key': 'tokenA', 'value': token})
call(f'{base}/collections/{uid}', {'collection': info}, 'PUT')
print('tokenA updated in Postman collection.')
EOF

echo "Logged in as $EMAIL (2h token). Postman requests using {{tokenA}} will authenticate."
