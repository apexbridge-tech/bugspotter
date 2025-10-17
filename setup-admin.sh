#!/bin/bash

# Setup admin account for BugSpotter
API_URL="http://localhost:3000"

echo "🔍 Checking setup status..."
STATUS=$(curl -s "$API_URL/api/v1/setup/status")
echo "$STATUS"
echo ""

echo "🔧 Initializing admin account..."
INIT_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/setup/initialize" \
  -H "Content-Type: application/json" \
  -d '{
    "adminEmail": "admin@bugspotter.dev",
    "adminPassword": "admin123",
    "adminName": "Admin User"
  }')

echo "$INIT_RESPONSE"
echo ""

if echo "$INIT_RESPONSE" | grep -q "error"; then
  echo "❌ Setup failed! Admin account may already exist."
  echo "Try logging in with: admin@bugspotter.dev / admin123"
else
  echo "✅ Admin account created successfully!"
  echo ""
  echo "📋 Credentials:"
  echo "   Email: admin@bugspotter.dev"
  echo "   Password: admin123"
  echo ""
  echo "🌐 Access Admin UI:"
  echo "   http://localhost:3001"
fi
