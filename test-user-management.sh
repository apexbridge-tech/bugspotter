#!/bin/bash

# Test script for User Management and Analytics APIs
# Make sure the services are running with: docker-compose up -d

API_URL="http://localhost:3000"
ADMIN_EMAIL="admin@bugspotter.dev"
ADMIN_PASSWORD="admin123"

echo "🔐 Step 1: Login as admin to get JWT token..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$ADMIN_EMAIL\",
    \"password\": \"$ADMIN_PASSWORD\"
  }")

echo "$LOGIN_RESPONSE" | jq '.'

ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.access_token')

if [ "$ACCESS_TOKEN" == "null" ] || [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ Login failed! Make sure you've set up the admin account first."
  echo "Run: docker-compose exec api node packages/backend/dist/index.js setup"
  exit 1
fi

echo "✅ Login successful! Token: ${ACCESS_TOKEN:0:20}..."
echo ""

# ==============================================================================
# USER MANAGEMENT TESTS
# ==============================================================================

echo "👥 Step 2: List all users (with pagination)..."
curl -s "$API_URL/api/v1/admin/users?page=1&limit=10" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'
echo ""

echo "👤 Step 3: Create a new user..."
CREATE_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/admin/users" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "name": "Test User",
    "password": "password123",
    "role": "user"
  }')

echo "$CREATE_RESPONSE" | jq '.'
USER_ID=$(echo "$CREATE_RESPONSE" | jq -r '.data.id')
echo "✅ Created user with ID: $USER_ID"
echo ""

echo "🔍 Step 4: Search users by email..."
curl -s "$API_URL/api/v1/admin/users?email=test" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'
echo ""

echo "🔄 Step 5: Update user details..."
curl -s -X PATCH "$API_URL/api/v1/admin/users/$USER_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Test User"
  }' | jq '.'
echo ""

echo "🔐 Step 6: Filter users by role (admin only)..."
curl -s "$API_URL/api/v1/admin/users?role=admin" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'
echo ""

# ==============================================================================
# ANALYTICS TESTS
# ==============================================================================

echo "📊 Step 7: Get dashboard overview metrics..."
curl -s "$API_URL/api/v1/analytics/dashboard" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'
echo ""

echo "📈 Step 8: Get 7-day trend analysis..."
curl -s "$API_URL/api/v1/analytics/reports/trend?days=7" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'
echo ""

echo "🗂️  Step 9: Get per-project statistics..."
curl -s "$API_URL/api/v1/analytics/projects/stats" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'
echo ""

# ==============================================================================
# CLEANUP
# ==============================================================================

echo "🗑️  Step 10: Delete test user..."
curl -s -X DELETE "$API_URL/api/v1/admin/users/$USER_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'
echo ""

echo "✅ All tests completed!"
echo ""
echo "💡 Tips:"
echo "  - User Management UI: http://localhost:3001/users"
echo "  - Analytics Dashboard: http://localhost:3001/dashboard"
echo "  - Login with: $ADMIN_EMAIL / $ADMIN_PASSWORD"
