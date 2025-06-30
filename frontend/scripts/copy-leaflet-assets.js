#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Fonction pour créer un dossier s'il n'existe pas
function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`✅ Dossier créé: ${dirPath}`);
    }
}

// Fonction pour copier un fichier
function copyFile(src, dest) {
    try {
        fs.copyFileSync(src, dest);
        console.log(`✅ Copié: ${path.basename(src)} -> ${dest}`);
    } catch (error) {
        console.error(`❌ Erreur lors de la copie de ${src}:`, error.message);
    }
}

// Fonction pour copier un dossier récursivement
function copyDirectory(src, dest) {
    ensureDirectoryExists(dest);
    
    const files = fs.readdirSync(src);
    
    files.forEach(file => {
        const srcPath = path.join(src, file);
        const destPath = path.join(dest, file);
        
        if (fs.statSync(srcPath).isDirectory()) {
            copyDirectory(srcPath, destPath);
        } else {
            copyFile(srcPath, destPath);
        }
    });
}

console.log('🚀 Copie des assets Leaflet...');

try {
    // Chemins source et destination
    const leafletNodeModules = path.join(__dirname, '..', 'node_modules', 'leaflet', 'dist');
    const leafletAssets = path.join(__dirname, '..', 'assets', 'leaflet');
    
    // Vérifier que le package Leaflet est installé
    if (!fs.existsSync(leafletNodeModules)) {
        console.error('❌ Leaflet non trouvé dans node_modules. Assurez-vous que npm install a été exécuté.');
        process.exit(1);
    }
    
    // Créer le dossier assets/leaflet
    ensureDirectoryExists(leafletAssets);
    
    // Copier les fichiers CSS et JS
    const filesToCopy = [
        'leaflet.css',
        'leaflet.js'
    ];
    
    filesToCopy.forEach(file => {
        const srcFile = path.join(leafletNodeModules, file);
        const destFile = path.join(leafletAssets, file);
        
        if (fs.existsSync(srcFile)) {
            copyFile(srcFile, destFile);
        } else {
            console.warn(`⚠️  Fichier non trouvé: ${srcFile}`);
        }
    });
    
    // Copier le dossier images
    const imagesSource = path.join(leafletNodeModules, 'images');
    const imagesDestination = path.join(leafletAssets, 'images');
    
    if (fs.existsSync(imagesSource)) {
        copyDirectory(imagesSource, imagesDestination);
    } else {
        console.warn('⚠️  Dossier images non trouvé dans Leaflet');
    }
    
    console.log('🎉 Assets Leaflet copiés avec succès!');
    
    // Afficher un résumé
    console.log('\n📋 Résumé:');
    console.log('├── leaflet.css');
    console.log('├── leaflet.js');
    console.log('└── images/');
    console.log('    ├── marker-icon.png');
    console.log('    ├── marker-icon-2x.png');
    console.log('    └── marker-shadow.png');
    
} catch (error) {
    console.error('❌ Erreur lors de la copie des assets:', error.message);
    process.exit(1);
} 