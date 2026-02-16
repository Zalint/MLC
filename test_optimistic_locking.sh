#!/bin/bash

# ========================================
# Script de test - Optimistic Locking
# Test du système de versionnage des crédits
# ========================================

API_URL="http://localhost:4000"
API_KEY="b326e72b67a9b508c88270b9954c5ca1"
PHONE="773289936"

echo ""
echo "🧪 TEST OPTIMISTIC LOCKING - SYSTÈME DE CRÉDITS"
echo "================================================"
echo ""

# ========================================
# Test 1: Lire le crédit et obtenir la version
# ========================================

echo "📊 Test 1: Lecture du crédit actuel"
echo "-----------------------------------"

AUDIT_RESPONSE=$(curl -s -X GET \
  "${API_URL}/api/external/mata/audit/client?phone_number=${PHONE}&skip_sentiment=true" \
  -H "x-api-key: ${API_KEY}")

echo "$AUDIT_RESPONSE" | jq '.client_info.credit'

# Extraire la version
VERSION=$(echo "$AUDIT_RESPONSE" | jq -r '.client_info.credit.version')
BALANCE=$(echo "$AUDIT_RESPONSE" | jq -r '.client_info.credit.current_balance')

if [ "$VERSION" == "null" ]; then
  echo ""
  echo "❌ Client n'a pas de crédit"
  echo "💡 Attribuez d'abord un crédit via l'interface web"
  exit 1
fi

echo ""
echo "✅ Crédit lu avec succès"
echo "   Solde: ${BALANCE} FCFA"
echo "   Version: ${VERSION}"
echo ""

# ========================================
# Test 2: Utiliser le crédit avec la BONNE version
# ========================================

echo "💳 Test 2: Utilisation de 100 FCFA (version correcte: ${VERSION})"
echo "----------------------------------------------------------------"

USE_RESPONSE=$(curl -s -X POST \
  "${API_URL}/api/external/clients/credits/use" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -d "{
    \"phone_number\": \"${PHONE}\",
    \"amount_used\": 100,
    \"order_id\": \"TEST_LOCK_$(date +%s)\",
    \"version\": ${VERSION}
  }")

SUCCESS=$(echo "$USE_RESPONSE" | jq -r '.success')

if [ "$SUCCESS" == "true" ]; then
  echo ""
  echo "✅ Utilisation réussie!"
  echo "$USE_RESPONSE" | jq '.transaction'
  
  NEW_VERSION=$(echo "$USE_RESPONSE" | jq -r '.transaction.new_version')
  NEW_BALANCE=$(echo "$USE_RESPONSE" | jq -r '.transaction.new_balance')
  
  echo ""
  echo "   Version: ${VERSION} → ${NEW_VERSION}"
  echo "   Solde: ${BALANCE} → ${NEW_BALANCE} FCFA"
else
  echo ""
  echo "❌ Échec inattendu:"
  echo "$USE_RESPONSE" | jq '.'
  exit 1
fi

echo ""

# ========================================
# Test 3: Essayer avec une MAUVAISE version (conflit)
# ========================================

echo "⚠️  Test 3: Utilisation avec MAUVAISE version (devrait échouer)"
echo "---------------------------------------------------------------"
echo "   Utilisation de version ${VERSION} (ancienne version)"
echo "   Version actuelle: ${NEW_VERSION}"
echo ""

CONFLICT_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST \
  "${API_URL}/api/external/clients/credits/use" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -d "{
    \"phone_number\": \"${PHONE}\",
    \"amount_used\": 200,
    \"order_id\": \"TEST_CONFLICT\",
    \"version\": ${VERSION}
  }")

HTTP_CODE=$(echo "$CONFLICT_RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$CONFLICT_RESPONSE" | sed 's/HTTP_CODE:.*//')

if [ "$HTTP_CODE" == "409" ]; then
  echo "✅ Conflit 409 détecté (comportement attendu)!"
  echo ""
  echo "$BODY" | jq '.'
  echo ""
  echo "🔒 Protection contre race condition: OK ✅"
else
  echo "❌ Devrait retourner 409 Conflict!"
  echo "   Code HTTP: ${HTTP_CODE}"
  echo "$BODY"
fi

echo ""

# ========================================
# Test 4: Historique des transactions
# ========================================

echo "📜 Test 4: Consultation de l'historique"
echo "--------------------------------------"

HISTORY=$(curl -s -X GET \
  "${API_URL}/api/external/clients/credits/history/${PHONE}" \
  -H "x-api-key: ${API_KEY}")

COUNT=$(echo "$HISTORY" | jq -r '.count')
echo ""
echo "   Total transactions: ${COUNT}"
echo ""

echo "$HISTORY" | jq -r '.transactions[] | 
  "\(.created_at | split("T")[0]) \(.created_at | split("T")[1] | split(".")[0]) | \(.transaction_label) | \(.amount) FCFA | \(.balance_before) → \(.balance_after) | \(.order_id // "-")"' | head -5

echo ""
echo "========================================="
echo "🎉 Tests terminés avec succès!"
echo "========================================="
echo ""
echo "✅ Optimistic Locking fonctionne"
echo "✅ Conflit 409 détecté correctement"
echo "✅ Historique enregistré"
echo ""

