#!/bin/bash
# Deploy MESMS on an Ubuntu VPS without touching other sites.
# Isolated: /var/www/mems, PM2 name mesms-api, port 4002, DB mesms,
# nginx site "mems" with server_name mems.145-223-23-47.sslip.io only.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/mems}"
DOMAIN="${DOMAIN:-mems.145-223-23-47.sslip.io}"
API_PORT="${API_PORT:-4002}"
DB_NAME="${DB_NAME:-mesms}"
DB_USER="${DB_USER:-mesms}"
REPO_URL="${REPO_URL:-https://github.com/osforhsoftware/Medical-Equipment-Service-Management.git}"
BRANCH="${BRANCH:-main}"
NGINX_SITE="/etc/nginx/sites-available/mems"
CERT_PATH="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
ENV_FILE="$APP_DIR/backend/.env"
FIRST_INSTALL=0

write_nginx() {
  local ssl_block=""
  local listen_lines="    listen 80;
    listen [::]:80;"

  if [ -f "$CERT_PATH" ]; then
    listen_lines="    listen 80;
    listen [::]:80;
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;"
    ssl_block="
    if (\$scheme = http) {
        return 301 https://\$host\$request_uri;
    }"
  fi

  cat > "$NGINX_SITE" <<NGINX
# MESMS only — other nginx sites are not modified.
server {
${listen_lines}
    server_name ${DOMAIN};
${ssl_block}

    root ${APP_DIR}/frontend/dist;
    index index.html;

    access_log /var/log/nginx/mems_access.log;
    error_log /var/log/nginx/mems_error.log;

    client_max_body_size 15M;
    gzip on;
    gzip_types text/plain text/css text/javascript application/json application/javascript;

    location /api/ {
        proxy_pass http://127.0.0.1:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /assets/ {
        expires 30d;
        add_header Cache-Control "public";
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
NGINX

  ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/mems
}

echo "=== MySQL: create isolated database ${DB_NAME} ==="
mysql -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

echo "=== App: clone or update ${APP_DIR} ==="
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR"
  git fetch origin
  git checkout "$BRANCH"
  git pull origin "$BRANCH"
else
  FIRST_INSTALL=1
  mkdir -p "$(dirname "$APP_DIR")"
  if [ -d "$APP_DIR" ] && [ ! -d "$APP_DIR/.git" ]; then
    rm -rf "$APP_DIR"
  fi
  git clone --branch "$BRANCH" --depth 1 "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi
mkdir -p "$APP_DIR/backend/storage/private"

if [ -f "$ENV_FILE" ]; then
  echo "=== Backend .env already exists — keeping secrets ==="
  sed -i "s|^PORT=.*|PORT=${API_PORT}|" "$ENV_FILE"
  grep -q '^HOST=' "$ENV_FILE" && sed -i 's|^HOST=.*|HOST=127.0.0.1|' "$ENV_FILE" || echo 'HOST=127.0.0.1' >> "$ENV_FILE"
  sed -i "s|^BACKEND_URL=.*|BACKEND_URL=https://${DOMAIN}|" "$ENV_FILE"
  sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=https://${DOMAIN}|" "$ENV_FILE"
  sed -i "s|^CORS_ORIGIN=.*|CORS_ORIGIN=https://${DOMAIN}|" "$ENV_FILE"
  sed -i "s|^NODE_ENV=.*|NODE_ENV=production|" "$ENV_FILE"
else
  FIRST_INSTALL=1
  DB_PASS="${DB_PASS:-$(openssl rand -base64 24 | tr -d '/+=' | head -c 16)Aa1!}"
  JWT_SECRET="${JWT_SECRET:-$(openssl rand -base64 64 | tr -dc 'a-zA-Z0-9' | head -c 48)}"
  mysql -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';"
  mysql -e "ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';"
  mysql -e "GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';"
  mysql -e "FLUSH PRIVILEGES;"

  echo "=== Backend .env (first install) ==="
  cat > "$ENV_FILE" <<EOF
DATABASE_URL="mysql://${DB_USER}:${DB_PASS}@localhost:3306/${DB_NAME}"
JWT_SECRET="${JWT_SECRET}"
JWT_EXPIRES_IN="8h"
PORT=${API_PORT}
HOST=127.0.0.1
BACKEND_URL=https://${DOMAIN}
FRONTEND_URL=https://${DOMAIN}
CORS_ORIGIN=https://${DOMAIN}
NODE_ENV=production
PRIVATE_STORAGE_PATH="./storage/private"
MAX_UPLOAD_BYTES=10485760
DEFAULT_TENANT_ID=tenant_medtech_01
EOF
  echo "DB password for ${DB_USER}: ${DB_PASS}"
fi

echo "=== Frontend .env.production (same-origin /api) ==="
cat > "$APP_DIR/frontend/.env.production" <<EOF
VITE_APP_URL=https://${DOMAIN}
VITE_API_URL=
EOF

echo "=== Backend: install, build, migrate ==="
cd "$APP_DIR/backend"
npm ci
npm run build
npx prisma generate
npx prisma migrate deploy
if [ "$FIRST_INSTALL" -eq 1 ]; then
  echo "=== Seed demo data (first install only) ==="
  npm run seed
fi

echo "=== Frontend: install and build ==="
cd "$APP_DIR/frontend"
npm ci
npm run build

echo "=== PM2: mesms-api on 127.0.0.1:${API_PORT} (does not change other processes) ==="
cd "$APP_DIR/backend"
pm2 delete mesms-api 2>/dev/null || true
pm2 start dist/src/index.js \
  --name mesms-api \
  --cwd "$APP_DIR/backend" \
  --node-args="-r dotenv/config -r tsconfig-paths/register"
pm2 save

echo "=== Nginx: write/reload site 'mems' only ==="
write_nginx
nginx -t
systemctl reload nginx

echo "=== SSL (Let's Encrypt) for ${DOMAIN} only ==="
if [ ! -f "$CERT_PATH" ]; then
  if certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect; then
    echo "HTTPS enabled for ${DOMAIN}"
    write_nginx
    nginx -t
    systemctl reload nginx
  else
    echo "Certbot skipped or failed — site is on HTTP until DNS/SSL is ready"
  fi
else
  echo "Existing certificate kept for ${DOMAIN}"
fi

echo ""
echo "========== DEPLOYMENT COMPLETE =========="
echo "URL:          https://${DOMAIN}"
echo "API (local):  127.0.0.1:${API_PORT}"
echo "App dir:      ${APP_DIR}"
echo "Nginx site:   ${NGINX_SITE}"
echo "PM2 process:  mesms-api"
echo "DB name:      ${DB_NAME}"
echo "Admin login:  medical_equment / medical@961"
echo "========================================="
