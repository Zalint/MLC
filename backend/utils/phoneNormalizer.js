// Utilitaire pour normaliser les numéros de téléphone internationaux

/**
 * Normalise un numéro de téléphone dans différents formats
 * @param {string} phone - Numéro de téléphone brut
 * @returns {Object} - { normalized, variants, country }
 */
function normalizePhoneNumber(phone) {
  if (!phone) {
    return null;
  }

  // Nettoyer le numéro (enlever espaces, tirets, parenthèses, etc.)
  let cleaned = phone.toString().replace(/[\s\-\(\)\+]/g, '');

  // Détecter le pays et normaliser
  let country = null;
  let normalized = null;
  let variants = [];

  // SÉNÉGAL (221)
  if (cleaned.match(/^(221)?7[7056]\d{7}$/)) {
    // 773929671 ou 221773929671
    const local = cleaned.replace(/^221/, '');
    normalized = `221${local}`;
    country = 'SN';
    variants = [
      local,                    // 773929671
      `221${local}`,           // 221773929671
      `00221${local}`,         // 00221773929671
      `+221${local}`,          // +221773929671
      `0${local}`              // 0773929671 (moins commun)
    ];
  }
  
  // FRANCE (33)
  else if (cleaned.match(/^(0033|33)?[67]\d{8}$/)) {
    // 679854465 ou 33679854465 ou 0033679854465
    let local = cleaned.replace(/^(0033|33)/, '');
    
    // Si commence par 0, l'enlever pour le format international
    if (local.startsWith('0')) {
      local = local.substring(1);
    }
    
    normalized = `33${local}`;
    country = 'FR';
    variants = [
      `0${local}`,             // 0679854465 (format national)
      `33${local}`,            // 33679854465
      `0033${local}`,          // 0033679854465
      `+33${local}`,           // +33679854465
      local                    // 679854465
    ];
  }
  
  // USA/CANADA (1)
  else if (cleaned.match(/^(001|1)?\d{10}$/)) {
    // 4436273965 ou 14436273965 ou 0014436273965
    const local = cleaned.replace(/^(001|1)/, '');
    normalized = `1${local}`;
    country = 'US';
    variants = [
      local,                   // 4436273965
      `1${local}`,            // 14436273965
      `001${local}`,          // 0014436273965
      `+1${local}`            // +14436273965
    ];
  }
  
  // Autres pays - format générique
  else {
    // Garder tel quel
    normalized = cleaned;
    country = 'UNKNOWN';
    variants = [
      cleaned,
      `00${cleaned}`,
      `+${cleaned}`
    ];
  }

  return {
    normalized,
    country,
    variants,
    original: phone
  };
}

/**
 * Construit une clause SQL pour chercher un numéro dans ses différentes variantes
 * @param {string} phone - Numéro de téléphone
 * @param {string} columnName - Nom de la colonne SQL (default: 'phone_number')
 * @returns {Object} - { clause, params }
 */
function buildPhoneSearchClause(phone, columnName = 'phone_number') {
  const normalized = normalizePhoneNumber(phone);
  
  if (!normalized) {
    return { clause: '1=0', params: [] };
  }

  const placeholders = normalized.variants.map((_, i) => `$${i + 1}`).join(', ');
  const clause = `${columnName} IN (${placeholders})`;
  
  return {
    clause,
    params: normalized.variants,
    normalized: normalized.normalized,
    country: normalized.country
  };
}

module.exports = {
  normalizePhoneNumber,
  buildPhoneSearchClause
};

