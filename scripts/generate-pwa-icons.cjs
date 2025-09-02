// Script para gerar ícones PWA em diferentes tamanhos
// Execute: node scripts/generate-pwa-icons.cjs

const fs = require('fs');
const path = require('path');

// Tamanhos necessários para PWA
const iconSizes = [
  16, 32, 72, 96, 128, 144, 152, 192, 384, 512
];

// Criar browserconfig.xml para Windows
const browserConfig = `<?xml version="1.0" encoding="utf-8"?>
<browserconfig>
    <msapplication>
        <tile>
            <square150x150logo src="/icons/icon-144x144.png"/>
            <TileColor>#2563eb</TileColor>
        </tile>
    </msapplication>
</browserconfig>`;

console.log('🎨 Gerando configurações PWA...');

// Criar browserconfig.xml
fs.writeFileSync(path.join(__dirname, '../public/icons/browserconfig.xml'), browserConfig);
console.log('✅ browserconfig.xml criado');

// Criar favicon.ico placeholder
fs.writeFileSync(path.join(__dirname, '../public/favicon.ico'), '');
console.log('✅ favicon.ico placeholder criado');

console.log(`
📱 PRÓXIMOS PASSOS PARA COMPLETAR O PWA:

1. ÍCONES NECESSÁRIOS:
   Crie os seguintes ícones na pasta public/icons/:
   ${iconSizes.map(size => `   - icon-${size}x${size}.png`).join('\n')}

2. FERRAMENTAS RECOMENDADAS:
   - PWA Builder: https://www.pwabuilder.com/imageGenerator
   - Favicon Generator: https://realfavicongenerator.net/
   - Canva ou Figma para criar ícones

3. TESTE O PWA:
   - npm run build && npm run start
   - Abra Chrome DevTools > Application > Manifest
   - Teste a instalação no mobile

4. RECURSOS ADICIONAIS:
   - Push notifications já configuradas
   - Cache offline implementado
   - Detecção de instalação automática

🚀 Seu PWA está quase pronto!
`);