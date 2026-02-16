/**
 * Test rapide avec les données brutes exactes fournies
 * Ce script simule la réception de données depuis l'API externe Mata viande
 */

const rawData = {
    "success": true,
    "count": 1,
    "orders": [
        {
            "id": 20,
            "commandId": "1118",
            "messageId": "19c1330c52eb42c4",
            "threadId": "19c1330c52eb42c4",
            "jsonContent": {
                "date": "2026-01-31T08:34:47.000Z",
                "note": "RAS. Ceci est un test",
                "items": [
                    {
                        "prix": {
                            "raw": "3 800 CFA",
                            "amount": 3800,
                            "currency": "CFA"
                        },
                        "produit": "viande de boeuf",
                        "quantite": 1
                    },
                    {
                        "prix": {
                            "raw": "4 000 CFA",
                            "amount": 4000,
                            "currency": "CFA"
                        },
                        "produit": "viande de veau",
                        "quantite": 1
                    },
                    {
                        "prix": {
                            "raw": "3 400 CFA",
                            "amount": 3400,
                            "currency": "CFA"
                        },
                        "produit": "Poulet entier - 1.5 kilos minimum",
                        "quantite": 1
                    }
                ],
                "phone": "773929671",
                "total": {
                    "raw": "11 200 CFA",
                    "amount": 11200,
                    "currency": "CFA"
                },
                "subject": "[Mata viande] : Nouvelle commande n°1118",
                "threadId": "19c1330c52eb42c4",
                "messageId": "19c1330c52eb42c4",
                "orderNumber": "1118",
                "customerName": "TEST TEST SALIOU",
                "billingAddress": {
                    "full": "TEST TEST SALIOU, 43 Rue Vineuse, 773929671",
                    "name": "TEST TEST SALIOU",
                    "lines": [
                        "43 Rue Vineuse"
                    ],
                    "phone": "773929671"
                },
                "shippingAddress": {
                    "full": "TEST TEST SALIOU, 43 Rue Vineuse, 773929671, Une nouvelle commande pour Mata. Appler le client pour confirmer avec elle, les details de sa commande, Traitez vos commandes à la volée. Téléchargez l'application, <https://woocommerce.com/mobile?blog_id=0&utm_campaign=deeplinks_promote_app&utm_medium=email&utm_source=mataviande.com&utm_term=0>., Mata viande — Built with WooCommerce <https://woocommerce.com>",
                    "name": "TEST TEST SALIOU",
                    "lines": [
                        "43 Rue Vineuse",
                        "773929671",
                        "Une nouvelle commande pour Mata. Appler le client pour confirmer avec elle",
                        "les details de sa commande",
                        "Traitez vos commandes à la volée. Téléchargez l'application",
                        "<https://woocommerce.com/mobile?blog_id=0&utm_campaign=deeplinks_promote_app&utm_medium=email&utm_source=mataviande.com&utm_term=0>.",
                        "Mata viande — Built with WooCommerce <https://woocommerce.com>"
                    ],
                    "phone": null
                }
            },
            "orderDate": "2026-01-31",
            "totalAmount": "11200.00",
            "currency": "CFA",
            "createdAt": "2026-01-31T08:35:02.764Z",
            "updatedAt": "2026-01-31T08:35:54.509Z",
            "assignedTo": "OSF",
            "assignedAt": "2026-01-31T08:35:54.509Z",
            "convertedToPOS": false,
            "convertedAt": null,
            "convertedBy": null,
            "posVenteId": null,
            "created_at": "2026-01-31T08:35:02.764Z",
            "updated_at": "2026-01-31T08:35:54.509Z"
        }
    ]
};

console.log('═'.repeat(100));
console.log('📦 ANALYSE DES DONNÉES BRUTES - COMMANDE MATA VIANDE N°1118');
console.log('═'.repeat(100));
console.log('');

// Extraction des informations principales
const order = rawData.orders[0];
const content = order.jsonContent;

console.log('📋 INFORMATIONS GÉNÉRALES');
console.log('─'.repeat(100));
console.log(`Commande n°: ${order.commandId}`);
console.log(`Date: ${new Date(content.date).toLocaleString('fr-FR')}`);
console.log(`Status: ${order.convertedToPOS ? 'Converti en POS' : 'En attente'}`);
console.log(`Assigné à: ${order.assignedTo}`);
console.log(`Note: ${content.note}`);
console.log('');

console.log('👤 CLIENT');
console.log('─'.repeat(100));
console.log(`Nom: ${content.customerName}`);
console.log(`Téléphone: ${content.phone}`);
console.log(`Adresse facturation: ${content.billingAddress.lines.join(', ')}`);
console.log(`Adresse livraison: ${content.shippingAddress.lines[0]}`);
console.log('');

console.log('🛒 ARTICLES COMMANDÉS');
console.log('─'.repeat(100));
content.items.forEach((item, index) => {
    console.log(`${index + 1}. ${item.produit}`);
    console.log(`   Quantité: ${item.quantite}`);
    console.log(`   Prix unitaire: ${item.prix.raw}`);
    console.log(`   Sous-total: ${item.quantite * item.prix.amount} ${item.prix.currency}`);
    console.log('');
});

console.log('─'.repeat(100));
console.log(`💰 TOTAL: ${content.total.raw}`);
console.log('');

console.log('═'.repeat(100));
console.log('🔄 TRANSFORMATION POUR L\'API COMMANDES EN COURS');
console.log('═'.repeat(100));
console.log('');

// Transformation pour l'API
const apiPayload = {
    commande_id: order.commandId,
    livreur_id: order.assignedTo || "Massaer",
    livreur_nom: order.assignedTo || "Massaer",
    client: {
        nom: content.customerName,
        telephone: content.phone,
        adresse: content.shippingAddress.lines[0]
    },
    articles: content.items.map(item => ({
        produit: item.produit,
        quantite: item.quantite,
        prix: item.prix.amount
    })),
    total: content.total.amount,
    point_vente: "O.Foire", // À extraire du sujet ou configurer
    date_commande: order.orderDate,
    statut: "en_attente",
    metadata: {
        note: content.note,
        messageId: order.messageId,
        threadId: order.threadId,
        subject: content.subject
    }
};

console.log('📤 Payload pour API:');
console.log(JSON.stringify(apiPayload, null, 2));
console.log('');

console.log('═'.repeat(100));
console.log('✅ VALIDATION DES DONNÉES');
console.log('═'.repeat(100));
console.log('');

const validations = [
    {
        champ: 'commande_id',
        valeur: apiPayload.commande_id,
        valide: !!apiPayload.commande_id && apiPayload.commande_id.length > 0,
        requis: true
    },
    {
        champ: 'livreur_id',
        valeur: apiPayload.livreur_id,
        valide: !!apiPayload.livreur_id && apiPayload.livreur_id.length > 0,
        requis: true
    },
    {
        champ: 'client.nom',
        valeur: apiPayload.client.nom,
        valide: !!apiPayload.client.nom && apiPayload.client.nom.length > 0 && apiPayload.client.nom.toLowerCase() !== 'client inconnu',
        requis: true
    },
    {
        champ: 'client.telephone',
        valeur: apiPayload.client.telephone,
        valide: !!apiPayload.client.telephone && apiPayload.client.telephone.length > 0,
        requis: false
    },
    {
        champ: 'client.adresse',
        valeur: apiPayload.client.adresse,
        valide: !!apiPayload.client.adresse && apiPayload.client.adresse.length > 0,
        requis: false
    },
    {
        champ: 'articles',
        valeur: `${apiPayload.articles.length} article(s)`,
        valide: Array.isArray(apiPayload.articles) && apiPayload.articles.length > 0,
        requis: true
    },
    {
        champ: 'total',
        valeur: apiPayload.total,
        valide: typeof apiPayload.total === 'number' && apiPayload.total > 0,
        requis: true
    },
    {
        champ: 'point_vente',
        valeur: apiPayload.point_vente,
        valide: !!apiPayload.point_vente && apiPayload.point_vente.length > 0,
        requis: true
    },
    {
        champ: 'date_commande',
        valeur: apiPayload.date_commande,
        valide: !!apiPayload.date_commande,
        requis: true
    },
    {
        champ: 'statut',
        valeur: apiPayload.statut,
        valide: ['en_attente', 'en_livraison', 'livre', 'annule'].includes(apiPayload.statut),
        requis: true
    }
];

console.log('Champ                 | Valeur              | Valide | Requis');
console.log('─'.repeat(100));

let allValid = true;
let missingOptional = [];

validations.forEach(v => {
    const icon = v.valide ? '✅' : (v.requis ? '❌' : '⚠️');
    const requiredIcon = v.requis ? '🔴' : '🟡';
    const valeurDisplay = String(v.valeur).substring(0, 18).padEnd(18);
    
    console.log(`${v.champ.padEnd(20)} | ${valeurDisplay} | ${icon}     | ${requiredIcon}`);
    
    if (!v.valide && v.requis) {
        allValid = false;
    }
    
    if (!v.valide && !v.requis) {
        missingOptional.push(v.champ);
    }
});

console.log('');
console.log('Légende:');
console.log('  ✅ Valide   ❌ Invalide   ⚠️  Manquant (optionnel)');
console.log('  🔴 Requis   🟡 Optionnel');
console.log('');

if (allValid) {
    console.log('✅ TOUTES LES VALIDATIONS REQUISES SONT PASSÉES!');
    if (missingOptional.length > 0) {
        console.log(`⚠️  Champs optionnels manquants: ${missingOptional.join(', ')}`);
    }
} else {
    console.log('❌ CERTAINES VALIDATIONS REQUISES ONT ÉCHOUÉ!');
    console.log('   La commande ne peut pas être créée.');
}

console.log('');
console.log('═'.repeat(100));
console.log('📊 RÉSUMÉ');
console.log('═'.repeat(100));
console.log('');
console.log(`Commande: ${apiPayload.commande_id}`);
console.log(`Client: ${apiPayload.client.nom} (${apiPayload.client.telephone})`);
console.log(`Livreur: ${apiPayload.livreur_nom}`);
console.log(`Articles: ${apiPayload.articles.length}`);
console.log(`Total: ${apiPayload.total} FCFA`);
console.log(`Point de vente: ${apiPayload.point_vente}`);
console.log(`Date: ${apiPayload.date_commande}`);
console.log(`Statut: ${apiPayload.statut}`);
console.log('');

console.log('═'.repeat(100));
console.log('🚀 PRÊT POUR L\'ENVOI À L\'API');
console.log('═'.repeat(100));
console.log('');
console.log('Pour envoyer cette commande à l\'API, utilisez:');
console.log('');
console.log('curl -X POST http://localhost:3000/api/external/commande-en-cours \\');
console.log('  -H "Content-Type: application/json" \\');
console.log('  -H "x-api-key: VOTRE_CLE_API" \\');
console.log('  -d \'', JSON.stringify(apiPayload, null, 2), '\'');
console.log('');
console.log('Ou utilisez les scripts de test:');
console.log('  - node test_mata_viande_commande.js');
console.log('  - powershell .\\test_mata_viande_commande.ps1');
console.log('  - bash ./test_mata_viande_commande.sh');
console.log('');
