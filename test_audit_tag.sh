#!/bin/bash

# ========================================
# Script de test de l'API Audit avec Tag
# ========================================

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

# Paramètres par défaut
PHONE_NUMBER="${1:-773289936}"
BACKEND_URL="${2:-http://localhost:3000}"
API_KEY="${3:-}"

echo -e "${CYAN}================================================${NC}"
echo -e "${CYAN}   Test API Audit Client avec Tag              ${NC}"
echo -e "${CYAN}================================================${NC}"
echo ""

# Vérifier si l'API key est fournie
if [ -z "$API_KEY" ]; then
    echo -e "${YELLOW}⚠️  API Key non fournie${NC}"
    echo ""
    
    # Essayer de charger depuis .env
    if [ -f ".env" ]; then
        echo -e "${GRAY}📄 Chargement de l'API Key depuis .env...${NC}"
        API_KEY=$(grep -E '^API_KEY=' .env | cut -d '=' -f2)
    fi
    
    if [ -z "$API_KEY" ]; then
        echo -e "${RED}❌ API Key requise pour tester l'API externe${NC}"
        echo -e "${YELLOW}Usage: ./test_audit_tag.sh [phone_number] [backend_url] [api_key]${NC}"
        echo -e "${YELLOW}Exemple: ./test_audit_tag.sh 773289936 http://localhost:3000 YOUR_API_KEY${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}🔍 Configuration:${NC}"
echo -e "${GRAY}   URL: $BACKEND_URL${NC}"
echo -e "${GRAY}   Téléphone: $PHONE_NUMBER${NC}"
echo -e "${GRAY}   API Key: ${API_KEY:0:10}...${NC}"
echo ""

# Construire l'URL
URL="$BACKEND_URL/api/external/mata/audit/client?phone_number=$PHONE_NUMBER&skip_sentiment=true"

echo -e "${YELLOW}📡 Envoi de la requête...${NC}"
echo -e "${GRAY}   GET $URL${NC}"
echo ""

# Faire la requête
RESPONSE=$(curl -s -w "\n%{http_code}" -H "x-api-key: $API_KEY" "$URL")

# Extraire le code HTTP et le body
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

# Vérifier le code HTTP
if [ "$HTTP_CODE" != "200" ]; then
    echo -e "${RED}================================================${NC}"
    echo -e "${RED}❌ ERREUR${NC}"
    echo -e "${RED}================================================${NC}"
    echo ""
    echo -e "${RED}   Code HTTP: $HTTP_CODE${NC}"
    echo -e "${RED}   Message: $BODY${NC}"
    echo ""
    echo -e "${YELLOW}🔧 Vérifications:${NC}"
    echo -e "${GRAY}   1. Le backend est-il démarré? ($BACKEND_URL)${NC}"
    echo -e "${GRAY}   2. L'API key est-elle correcte?${NC}"
    echo -e "${GRAY}   3. Le numéro existe-t-il? ($PHONE_NUMBER)${NC}"
    echo -e "${GRAY}   4. La migration add_client_tags.sql a-t-elle été exécutée?${NC}"
    echo ""
    exit 1
fi

# Vérifier que jq est installé
if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}⚠️  jq n'est pas installé. Affichage de la réponse brute:${NC}"
    echo "$BODY" | python -m json.tool 2>/dev/null || echo "$BODY"
    exit 0
fi

# Extraire les informations avec jq
CLIENT_NAME=$(echo "$BODY" | jq -r '.client_info.name')
CLIENT_PHONE=$(echo "$BODY" | jq -r '.client_info.phone_number')
CLIENT_TAG=$(echo "$BODY" | jq -r '.client_info.client_tag')
FIRST_ORDER=$(echo "$BODY" | jq -r '.client_info.first_order')
LAST_ORDER=$(echo "$BODY" | jq -r '.client_info.last_order')
TOTAL_ORDERS=$(echo "$BODY" | jq -r '.client_info.total_orders')

CREDIT_AMOUNT=$(echo "$BODY" | jq -r '.client_info.credit.amount // "N/A"')
CREDIT_BALANCE=$(echo "$BODY" | jq -r '.client_info.credit.current_balance // "N/A"')
CREDIT_TAG=$(echo "$BODY" | jq -r '.client_info.credit.client_tag // "N/A"')
CREDIT_EXPIRES=$(echo "$BODY" | jq -r '.client_info.credit.expires_at // "N/A"')
DAYS_REMAINING=$(echo "$BODY" | jq -r '.client_info.credit.days_remaining // "N/A"')
IS_EXPIRED=$(echo "$BODY" | jq -r '.client_info.credit.is_expired // "null"')

TOTAL_AMOUNT=$(echo "$BODY" | jq -r '.statistics.total_amount')
AVG_AMOUNT=$(echo "$BODY" | jq -r '.statistics.avg_amount')
AVG_RATING=$(echo "$BODY" | jq -r '.statistics.avg_rating // "N/A"')

RESPONSE_TIME=$(echo "$BODY" | jq -r '.performance.total_time_ms')
CACHE_SIZE=$(echo "$BODY" | jq -r '.performance.cache_size')

# Afficher les résultats
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}✅ RÉPONSE RÉUSSIE${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""

# Emoji selon le tag
case $CLIENT_TAG in
    "VVIP")
        TAG_EMOJI="👑"
        TAG_COLOR="${RED}"
        ;;
    "VIP")
        TAG_EMOJI="⭐"
        TAG_COLOR="${YELLOW}"
        ;;
    *)
        TAG_EMOJI="👤"
        TAG_COLOR="${GRAY}"
        ;;
esac

echo -e "${CYAN}🏷️  TAG CLIENT${NC}"
echo -e "${TAG_COLOR}   $TAG_EMOJI $CLIENT_TAG${NC}"
echo ""

echo -e "${CYAN}👤 INFORMATIONS CLIENT${NC}"
echo -e "${GRAY}   Nom: $CLIENT_NAME${NC}"
echo -e "${GRAY}   Téléphone: $CLIENT_PHONE${NC}"
echo -e "${GRAY}   Tag: $CLIENT_TAG${NC}"
echo -e "${GRAY}   Première commande: $FIRST_ORDER${NC}"
echo -e "${GRAY}   Dernière commande: $LAST_ORDER${NC}"
echo -e "${GRAY}   Total commandes: $TOTAL_ORDERS${NC}"
echo ""

if [ "$CREDIT_AMOUNT" != "N/A" ]; then
    echo -e "${CYAN}💰 CRÉDIT CLIENT${NC}"
    echo -e "${GRAY}   Montant: $CREDIT_AMOUNT FCFA${NC}"
    echo -e "${GRAY}   Solde actuel: $CREDIT_BALANCE FCFA${NC}"
    echo -e "${GRAY}   Tag du crédit: $CREDIT_TAG${NC}"
    echo -e "${GRAY}   Expire le: $CREDIT_EXPIRES${NC}"
    echo -e "${GRAY}   Jours restants: $DAYS_REMAINING${NC}"
    if [ "$IS_EXPIRED" = "false" ]; then
        echo -e "${GRAY}   Expiré: Non ✅${NC}"
    else
        echo -e "${GRAY}   Expiré: Oui ❌${NC}"
    fi
else
    echo -e "${CYAN}💰 CRÉDIT CLIENT${NC}"
    echo -e "${GRAY}   Aucun crédit actif${NC}"
fi
echo ""

echo -e "${CYAN}📊 STATISTIQUES${NC}"
echo -e "${GRAY}   Total commandes: $TOTAL_ORDERS${NC}"
echo -e "${GRAY}   Montant total: $(printf '%.0f' $TOTAL_AMOUNT) FCFA${NC}"
echo -e "${GRAY}   Montant moyen: $(printf '%.0f' $AVG_AMOUNT) FCFA${NC}"
if [ "$AVG_RATING" != "N/A" ]; then
    echo -e "${GRAY}   Note moyenne: $AVG_RATING/5${NC}"
fi
echo ""

echo -e "${CYAN}⚡ PERFORMANCE${NC}"
echo -e "${GRAY}   Temps de réponse: ${RESPONSE_TIME}ms${NC}"
echo -e "${GRAY}   Cache size: $CACHE_SIZE${NC}"
echo ""

echo -e "${GREEN}================================================${NC}"
echo -e "${CYAN}🎯 EMPLACEMENTS DU TAG DANS LA RÉPONSE:${NC}"
echo -e "${GREEN}================================================${NC}"
echo -e "${YELLOW}   1. client_info.client_tag = '$CLIENT_TAG'${NC}"
if [ "$CREDIT_TAG" != "N/A" ]; then
    echo -e "${YELLOW}   2. client_info.credit.client_tag = '$CREDIT_TAG'${NC}"
fi
echo ""

# Sauvegarder la réponse complète
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTPUT_FILE="test_audit_response_$TIMESTAMP.json"
echo "$BODY" | jq '.' > "$OUTPUT_FILE"

echo -e "${GREEN}💾 Réponse complète sauvegardée: $OUTPUT_FILE${NC}"
echo ""

echo -e "${GREEN}✨ Test terminé avec succès!${NC}"
echo ""
echo -e "${CYAN}📖 Pour plus d'infos:${NC}"
echo -e "${GRAY}   - Voir exemple_reponse_audit_avec_tag.json${NC}"
echo -e "${GRAY}   - Voir VISUALISATION_TAG_API.md${NC}"
echo -e "${GRAY}   - Ouvrir test_client_tags.html${NC}"
echo ""
