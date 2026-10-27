#!/bin/bash
# Wipe MEMS business data only. Keeps all staff + admin logins.
# Safe isolation: /var/www/mems, DB name mesms, site mems.145-223-23-47.sslip.io
# Does NOT touch other nginx sites, PM2 apps, or other MySQL databases.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/mems}"
EXPECTED_DB="${EXPECTED_DB:-mesms}"
ENV_FILE="$APP_DIR/backend/.env"

if [ ! -d "$APP_DIR/backend" ]; then
  echo "ERROR: MEMS app not found at $APP_DIR — aborting (other sites untouched)."
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: Missing $ENV_FILE — aborting."
  exit 1
fi

DATABASE_URL_LINE="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | tail -n1 || true)"
DB_FROM_URL="$(printf '%s' "$DATABASE_URL_LINE" | sed -E 's/^DATABASE_URL=//; s/^"//; s/"$//; s|.*/([^/?]+)(\?.*)?$|\1|')"
if [ "$DB_FROM_URL" != "$EXPECTED_DB" ]; then
  echo "ERROR: DATABASE_URL points to '$DB_FROM_URL', expected '$EXPECTED_DB'."
  echo "Refusing to clean — other databases are not modified."
  exit 1
fi

TENANT_LINE="$(grep -E '^DEFAULT_TENANT_ID=' "$ENV_FILE" | tail -n1 || true)"
TENANT_ID="$(printf '%s' "$TENANT_LINE" | sed -E 's/^DEFAULT_TENANT_ID=//; s/^"//; s/"$//')"
TENANT_ID="${TENANT_ID:-tenant_medtech_01}"

echo "=== MEMS DB clean (staff/admin kept) ==="
echo "App:      $APP_DIR"
echo "Database: $EXPECTED_DB"
echo "Tenant:   $TENANT_ID"
echo "Removes:  tickets, jobs, customers, equipment, inventory, invoices, docs, portal customers"
echo "Keeps:    all staff + admin users/credentials"
echo ""

cd "$APP_DIR/backend"
ALLOW_PRODUCTION_CLEAN=1 npm run db:clean -- --confirm --keep-staff --allow-production

echo ""
echo "Done. Other VPS sites were not modified."
echo "Site: https://mems.145-223-23-47.sslip.io"
