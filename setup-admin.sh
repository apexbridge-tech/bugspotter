#!/bin/bash

# Setup admin account for BugSpotter
API_URL="http://localhost:3000"

echo "🔍 Checking setup status..."
STATUS=$(curl -s "$API_URL/api/v1/setup/status")
echo "$STATUS"
echo ""

echo "🔧 Initializing admin account..."

# WARNING: Change these credentials before running in production!
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-change-this-password}"

INIT_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/setup/initialize" \
  -H "Content-Type: application/json" \
  -d "{
    \"adminEmail\": \"$ADMIN_EMAIL\",
    \"adminPassword\": \"$ADMIN_PASSWORD\",
    \"adminName\": \"Admin User\"
  }")

echo "$INIT_RESPONSE"
echo ""

if echo "$INIT_RESPONSE" | grep -q "error"; then
  echo "❌ Setup failed! Admin account may already exist."
  echo "Try logging in with your configured credentials"
else
  echo "✅ Admin account created successfully!"
  echo ""
  echo "📋 Credentials:"
  echo "   Email: $ADMIN_EMAIL"
  echo "   Password: [hidden for security]"
  echo ""
  echo "🌐 Access Admin UI:"
  echo "   http://localhost:3001"
  echo ""
  echo "⚠️  IMPORTANT: Change the default password immediately!"
fi
