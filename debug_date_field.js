// Script de débogage pour le champ de date des dépenses
console.log('🔍 Démarrage du débogage du champ de date...');

function debugDateField() {
  const dateFilter = document.getElementById('expenses-date-filter');
  
  if (!dateFilter) {
    console.error('❌ Champ de date non trouvé !');
    return;
  }
  
  console.log('✅ Champ de date trouvé:', dateFilter);
  console.log('📍 Position:', dateFilter.getBoundingClientRect());
  console.log('🎨 Styles calculés:', window.getComputedStyle(dateFilter));
  console.log('👆 Pointer events:', window.getComputedStyle(dateFilter).pointerEvents);
  console.log('🖱️ Cursor:', window.getComputedStyle(dateFilter).cursor);
  console.log('📏 Z-index:', window.getComputedStyle(dateFilter).zIndex);
  
  // Test de clic programmatique
  console.log('🧪 Test de clic programmatique...');
  dateFilter.click();
  
  // Test de focus
  console.log('🎯 Test de focus...');
  dateFilter.focus();
  
  // Ajouter un event listener de test
  dateFilter.addEventListener('click', function(e) {
    console.log('🎉 Clic détecté sur le champ de date !', e);
  });
  
  // Vérifier les éléments qui pourraient bloquer
  const rect = dateFilter.getBoundingClientRect();
  const elementAtPosition = document.elementFromPoint(rect.left + rect.width/2, rect.top + rect.height/2);
  console.log('🎯 Élément à la position du champ:', elementAtPosition);
  
  if (elementAtPosition !== dateFilter) {
    console.warn('⚠️ Un autre élément bloque le champ de date:', elementAtPosition);
  }
}

// Exécuter le débogage quand la page est chargée
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', debugDateField);
} else {
  debugDateField();
}

// Fonction pour forcer l'ouverture du sélecteur de date
function forceOpenDatePicker() {
  const dateFilter = document.getElementById('expenses-date-filter');
  if (dateFilter) {
    console.log('🚀 Tentative d\'ouverture forcée du sélecteur de date...');
    
    // Méthode 1: showPicker (moderne)
    if (dateFilter.showPicker) {
      try {
        dateFilter.showPicker();
        console.log('✅ showPicker() appelé avec succès');
      } catch (e) {
        console.warn('⚠️ showPicker() a échoué:', e);
      }
    }
    
    // Méthode 2: focus + click
    dateFilter.focus();
    dateFilter.click();
    
    // Méthode 3: événement personnalisé
    const clickEvent = new MouseEvent('click', {
      view: window,
      bubbles: true,
      cancelable: true
    });
    dateFilter.dispatchEvent(clickEvent);
    
    console.log('🎯 Toutes les méthodes d\'ouverture tentées');
  }
}

// Exposer les fonctions de débogage globalement
window.debugDateField = debugDateField;
window.forceOpenDatePicker = forceOpenDatePicker;

console.log('🛠️ Fonctions de débogage disponibles:');
console.log('- debugDateField() : Analyser le champ de date');
console.log('- forceOpenDatePicker() : Forcer l\'ouverture du sélecteur'); 