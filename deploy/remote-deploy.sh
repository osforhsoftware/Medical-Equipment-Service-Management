#!/bin/bash
# Deploy MESMS on Ubuntu VPS without touching other sites.
# Uses its own directory, port (4002), nginx site, and MySQL database.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/mems}"
DOMAIN="${DOMAIN:-mems.145-223-23-47.sslip.io}"
API_PORT="${API_PORT:-4002}"
DB_NAME="${DB_NAME:-mesms}"
DB_USER="${DB_USER:-mesms}"
REPO_URL="${REPO_URL:-https://github.com/osforhsoftware/Medical-Equipment-Service-Management.git}"
BRANCH="${BRANCH:-main}"

DB_PASS="${DB_PASS:-$(openssl rand -base64 24 | tr -d '/+=' | head -c 16)Aa1!}"
JWT_SECRET="${JWT_SECRET:-$(openssl rand -base64 64 | tr -dc 'a-zA-Z0-9' | head -c 48)}"

echo "=== MySQL: create isolated database ==="
mysql -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';"
mysql -e "ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';"
mysql -e "GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"

echo "=== App: clone or update ==="
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR"
  git fetch origin
  git checkout "$BRANCH"
  git pull origin "$BRANCH"
else
  rm -rf "$APP_DIR"
  git clone --branch "$BRANCH" --depth 1 "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi
mkdir -p "$APP_DIR/backend/storage/private"

echo "=== Backend .env ==="
cat > "$APP_DIR/backend/.env" <<EOF
DATABASE_URL="mysql://${DB_USER}:${DB_PASS}@localhost:3306/${DB_NAME}"
JWT_SECRET="${JWT_SECRET}"
JWT_EXPIRES_IN="8h"
PORT=${API_PORT}
BACKEND_URL=https://${DOMAIN}
FRONTEND_URL=https://${DOMAIN}
CORS_ORIGIN=https://${DOMAIN}
NODE_ENV=production
PRIVATE_STORAGE_PATH="./storage/private"
MAX_UPLOAD_BYTES=10485760
DEFAULT_TENANT_ID=tenant_medtech_01
EOF

echo "=== Frontend .env.production ==="
cat > "$APP_DIR/frontend/.env.production" <<EOF
VITE_APP_URL=https://${DOMAIN}
VITE_API_URL=
EOF

echo "=== Backend: install, build, migrate, seed ==="
cd "$APP_DIR/backend"
npm ci
npm run build
npx prisma migrate deploy
npm run seed

echo "=== Frontend: install and build ==="
cd "$APP_DIR/frontend"
npm ci
npm run build

echo "=== PM2: mesms-api on port ${API_PORT} ==="
cd "$APP_DIR/backend"
pm2 delete mesms-api 2>/dev/null || true
pm2 start npx --name mesms-api --cwd "$APP_DIR/backend" -- ts-node -r tsconfig-paths/register src/index.ts
pm2 save

echo "=== Nginx: new site only (does not modify other configs) ==="
cp "$APP_DIR/deploy/nginx-mems.conf" /etc/nginx/sites-available/mems
ln -sf /etc/nginx/sites-available/mems /etc/nginx/sites-enabled/mems
nginx -t
systemctl reload nginx

echo "=== SSL (Let's Encrypt) ==="
if certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect 2>/dev/null; then
  echo "HTTPS enabled for ${DOMAIN}"
else
  echo "Certbot skipped or failed — site is on HTTP until DNS/SSL is ready"
fi

echo ""
echo "========== DEPLOYMENT COMPLETE =========="
echo "URL:          https://${DOMAIN}"
echo "API port:     ${API_PORT} (internal only)"
echo "App dir:      ${APP_DIR}"
echo "DB name:      ${DB_NAME}"
echo "DB user:      ${DB_USER}"
echo "DB password:  ${DB_PASS}"
echo "Admin login:  medical_equment / medical@961"
echo "========================================="
