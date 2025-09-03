const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Tamanhos necessários para PWA
const PWA_SIZES = [
  { size: 72, name: 'icon-72x72.png' },
  { size: 96, name: 'icon-96x96.png' },
  { size: 128, name: 'icon-128x128.png' },
  { size: 144, name: 'icon-144x144.png' },
  { size: 152, name: 'icon-152x152.png' },
  { size: 192, name: 'icon-192x192.png' },
  { size: 384, name: 'icon-384x384.png' },
  { size: 512, name: 'icon-512x512.png' }
];

// Tamanhos para favicon
const FAVICON_SIZES = [16, 32, 48];

async function generateIcons(inputImagePath) {
  try {
    console.log('🎨 Iniciando geração de ícones...');
    
    // Verificar se a imagem existe
    if (!fs.existsSync(inputImagePath)) {
      throw new Error(`Imagem não encontrada: ${inputImagePath}`);
    }

    // Criar diretório de ícones se não existir
    const iconsDir = path.join(__dirname, '..', 'public', 'icons');
    if (!fs.existsSync(iconsDir)) {
      fs.mkdirSync(iconsDir, { recursive: true });
    }

    // Gerar ícones PWA
    console.log('📱 Gerando ícones PWA...');
    for (const { size, name } of PWA_SIZES) {
      const outputPath = path.join(iconsDir, name);
      await sharp(inputImagePath)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 } // Fundo transparente
        })
        .png({ quality: 100, compressionLevel: 6 })
        .toFile(outputPath);
      
      console.log(`✅ Gerado: ${name} (${size}x${size})`);
    }

    // Gerar favicon.ico
    console.log('🌐 Gerando favicon.ico...');
    const faviconBuffers = [];
    
    for (const size of FAVICON_SIZES) {
      const buffer = await sharp(inputImagePath)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 } // Fundo branco para favicon
        })
        .png()
        .toBuffer();
      faviconBuffers.push(buffer);
    }

    // Salvar favicon na pasta public
    const faviconPath = path.join(__dirname, '..', 'public', 'favicon.ico');
    
    // Para simplicidade, vamos usar o ícone de 32x32 como favicon
    await sharp(inputImagePath)
      .resize(32, 32, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toFile(faviconPath.replace('.ico', '.png'));
    
    // Copiar também para src/app/
    const appFaviconPath = path.join(__dirname, '..', 'src', 'app', 'favicon.ico');
    await sharp(inputImagePath)
      .resize(32, 32, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toFile(appFaviconPath.replace('.ico', '.png'));

    console.log('✅ Favicon gerado em public/ e src/app/');

    // Atualizar manifest.json
    console.log('📋 Atualizando manifest.json...');
    const manifestPath = path.join(__dirname, '..', 'public', 'manifest.json');
    
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      
      // Atualizar ícones no manifest
      manifest.icons = PWA_SIZES.map(({ size, name }) => ({
        src: `/icons/${name}`,
        sizes: `${size}x${size}`,
        type: 'image/png',
        purpose: 'maskable any'
      }));

      // Atualizar shortcuts se existirem
      if (manifest.shortcuts) {
        manifest.shortcuts = manifest.shortcuts.map(shortcut => ({
          ...shortcut,
          icons: [{
            src: '/icons/icon-96x96.png',
            sizes: '96x96',
            type: 'image/png'
          }]
        }));
      }

      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      console.log('✅ Manifest.json atualizado');
    }

    console.log('\n🎉 Todos os ícones foram gerados com sucesso!');
    console.log('\n📁 Arquivos gerados:');
    PWA_SIZES.forEach(({ name }) => console.log(`   - public/icons/${name}`));
    console.log('   - public/favicon.png');
    console.log('   - src/app/favicon.png');
    console.log('   - manifest.json (atualizado)');
    
  } catch (error) {
    console.error('❌ Erro ao gerar ícones:', error.message);
    process.exit(1);
  }
}

// Verificar argumentos da linha de comando
const inputImage = process.argv[2];

if (!inputImage) {
  console.log('\n🎨 Gerador de Ícones PWA');
  console.log('\nUso: node scripts/generate-icons.js <caminho-da-imagem>');
  console.log('\nExemplo:');
  console.log('  node scripts/generate-icons.js icons/meu-icone.png');
  console.log('  node scripts/generate-icons.js C:/Users/Usuario/Desktop/icone.svg');
  console.log('\nFormatos suportados: PNG, JPG, SVG, WEBP');
  console.log('Recomendação: Use uma imagem quadrada de pelo menos 512x512px');
  process.exit(1);
}

// Executar geração
generateIcons(inputImage);

module.exports = { generateIcons };