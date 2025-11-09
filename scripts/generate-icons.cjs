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

// Escala segura para ícones "maskable" no Android (conteúdo centralizado)
// Mantém ~8% de margem em cada lado (84% do tamanho dentro da máscara)
const MASKABLE_SAFE_SCALE = 0.84;

async function createPaddedPWAIcon(inputImagePath, size, outputPath) {
  const inner = Math.max(1, Math.round(size * MASKABLE_SAFE_SCALE));
  const canvas = {
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  };

  const innerBuffer = await sharp(inputImagePath)
    .resize(inner, inner, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ quality: 100, compressionLevel: 6 })
    .toBuffer();

  await sharp(canvas)
    .composite([{ input: innerBuffer, gravity: 'center' }])
    .png({ quality: 100, compressionLevel: 6 })
    .toFile(outputPath);
}

async function generateIcons(inputImagePath, options = {}) {
  try {
    console.log('🎨 Iniciando geração de ícones...');
    
    // Verificar se a imagem existe
    if (!fs.existsSync(inputImagePath)) {
      throw new Error(`Imagem não encontrada: ${inputImagePath}`);
    }

    // Opções de versionamento
    const dirSuffix = options.dir ? options.dir.replace(/^\/+|\/+$/g, '') : '';
    const nameSuffix = options.suffix || '';

    // Criar diretório de ícones (suporta subpasta para versionamento)
    const iconsDir = dirSuffix
      ? path.join(__dirname, '..', 'public', 'icons', dirSuffix)
      : path.join(__dirname, '..', 'public', 'icons');
    if (!fs.existsSync(iconsDir)) {
      fs.mkdirSync(iconsDir, { recursive: true });
    }

    // Gerar ícones PWA
    console.log('📱 Gerando ícones PWA (com margem maskable)...');
    for (const { size, name } of PWA_SIZES) {
      const fileName = nameSuffix ? name.replace('.png', `${nameSuffix}.png`) : name;
      const outputPath = path.join(iconsDir, fileName);
      await createPaddedPWAIcon(inputImagePath, size, outputPath);
      
      console.log(`✅ Gerado: ${fileName} (${size}x${size})`);
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

    // Também gerar ícones 16x16 e 32x32 versionados na pasta icons
    console.log('🧩 Gerando ícones pequenos (16x16, 32x32) na pasta de ícones...');
    for (const size of [16, 32]) {
      const smallOutput = path.join(
        iconsDir,
        `icon-${size}x${size}${nameSuffix}.png`
      );
      await sharp(inputImagePath)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .png()
        .toFile(smallOutput);
      console.log(`✅ Gerado: icon-${size}x${size}${nameSuffix}.png (${size}x${size})`);
    }

    console.log('✅ Favicon gerado em public/ e src/app/');

    // Atualizar manifest.json
    console.log('📋 Atualizando manifest.json...');
    const manifestPath = path.join(__dirname, '..', 'public', 'manifest.json');
    
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      
      // Atualizar ícones no manifest (suporta subpasta e sufixo)
      manifest.icons = PWA_SIZES.map(({ size, name }) => {
        const fileName = nameSuffix ? name.replace('.png', `${nameSuffix}.png`) : name;
        const basePath = `/icons/${dirSuffix ? dirSuffix + '/' : ''}${fileName}`;
        return {
          src: basePath,
          sizes: `${size}x${size}`,
          type: 'image/png',
          purpose: 'maskable any'
        };
      });

      // Atualizar shortcuts se existirem
      if (manifest.shortcuts) {
        manifest.shortcuts = manifest.shortcuts.map(shortcut => ({
          ...shortcut,
          icons: [{
            src: `/icons/${dirSuffix ? dirSuffix + '/' : ''}${nameSuffix ? 'icon-96x96' + nameSuffix + '.png' : 'icon-96x96.png'}`,
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
    PWA_SIZES.forEach(({ name }) => {
      const fileName = nameSuffix ? name.replace('.png', `${nameSuffix}.png`) : name;
      console.log(`   - public/icons/${dirSuffix ? dirSuffix + '/' : ''}${fileName}`);
    });
    console.log(`   - public/icons/${dirSuffix ? dirSuffix + '/' : ''}icon-16x16${nameSuffix}.png`);
    console.log(`   - public/icons/${dirSuffix ? dirSuffix + '/' : ''}icon-32x32${nameSuffix}.png`);
    console.log('   - public/favicon.png');
    console.log('   - src/app/favicon.png');
    console.log('   - manifest.json (atualizado)');
    
  } catch (error) {
    console.error('❌ Erro ao gerar ícones:', error.message);
    process.exit(1);
  }
}

// Verificar argumentos da linha de comando
// Parse de argumentos: input, --dir=v2, --suffix=-v2
const argv = process.argv.slice(2);
let inputImage = null;
let dir = '';
let suffix = '';

for (const arg of argv) {
  if (arg.startsWith('--dir=')) {
    dir = arg.split('=')[1] || '';
  } else if (arg.startsWith('--suffix=')) {
    suffix = arg.split('=')[1] || '';
  } else if (!inputImage) {
    inputImage = arg;
  }
}

if (!inputImage) {
  console.log('\n🎨 Gerador de Ícones PWA');
  console.log('\nUso: node scripts/generate-icons.cjs <caminho-da-imagem> [--dir=v2] [--suffix=-v2]');
  console.log('\nExemplo:');
  console.log('  node scripts/generate-icons.cjs icons/meu-icone.png --dir=v2 --suffix=-v2');
  console.log('  node scripts/generate-icons.cjs C:/Users/Usuario/Desktop/icone.svg --dir=v2 --suffix=-v2');
  console.log('\nFormatos suportados: PNG, JPG, SVG, WEBP');
  console.log('Recomendação: Use uma imagem quadrada de pelo menos 512x512px');
  process.exit(1);
}

// Executar geração
generateIcons(inputImage, { dir, suffix });

module.exports = { generateIcons };