const fs = require('fs');
const path = require('path');

// Configuration
const BACKEND_URL = process.env.BACKEND_URL || 'https://your-backend-url.onrender.com';
const FRONTEND_DIR = './frontend';

// Files to update
const filesToUpdate = [
    'js/app.js',
    'js/auth.js',
    'js/dashboard.js',
    'js/orders.js',
    'js/expenses.js',
    'js/users.js'
];

// Patterns to replace
const patterns = [
    {
        from: /http:\/\/localhost:4000/g,
        to: BACKEND_URL
    },
    {
        from: /http:\/\/localhost:\d+/g,
        to: BACKEND_URL
    },
    {
        from: /'\/api\//g,
        to: `'${BACKEND_URL}/api/`
    },
    {
        from: /`\/api\//g,
        to: `\`${BACKEND_URL}/api/`
    }
];

function updateFile(filePath) {
    const fullPath = path.join(FRONTEND_DIR, filePath);
    
    if (!fs.existsSync(fullPath)) {
        console.log(`⚠️  File not found: ${fullPath}`);
        return;
    }
    
    try {
        let content = fs.readFileSync(fullPath, 'utf8');
        let updated = false;
        
        patterns.forEach(pattern => {
            if (pattern.from.test(content)) {
                content = content.replace(pattern.from, pattern.to);
                updated = true;
            }
        });
        
        if (updated) {
            fs.writeFileSync(fullPath, content, 'utf8');
            console.log(`✅ Updated: ${filePath}`);
        } else {
            console.log(`ℹ️  No changes needed: ${filePath}`);
        }
        
    } catch (error) {
        console.error(`❌ Error updating ${filePath}:`, error.message);
    }
}

function main() {
    console.log('🔄 Updating frontend API URLs for production...');
    console.log(`🎯 Backend URL: ${BACKEND_URL}\n`);
    
    if (BACKEND_URL === 'https://your-backend-url.onrender.com') {
        console.log('⚠️  Warning: Using placeholder backend URL. Set BACKEND_URL environment variable.');
        console.log('   Example: BACKEND_URL=https://matix-livreur-backend.onrender.com node update_frontend_urls.js\n');
    }
    
    filesToUpdate.forEach(updateFile);
    
    console.log('\n🎉 Frontend URL update complete!');
    console.log('📝 Remember to commit these changes before deploying.');
}

main(); 