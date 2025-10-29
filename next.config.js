/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ OTIMIZAÇÕES DE PERFORMANCE COMPATÍVEIS COM NEXT.JS 15
  poweredByHeader: false,
  compress: true,
  
  // ✅ DESENVOLVIMENTO RÁPIDO
  reactStrictMode: false,
  
  // ✅ CONFIGURAÇÕES DE UPLOAD DE ARQUIVOS
  experimental: {
    serverComponentsExternalPackages: [],
  },
  
  // ✅ CONFIGURAÇÕES DE API PARA UPLOADS
  api: {
    bodyParser: {
      sizeLimit: '20mb', // Limite de 20MB para uploads
    },
    responseLimit: false,
  },
  
  // ✅ IGNORAR ESLINT EM BUILD PARA RAPIDEZ
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // ✅ IGNORAR TYPESCRIPT ERRORS EM BUILD
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // ✅ OTIMIZAÇÕES DE BUNDLE
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{member}}'
    }
  },

  // ✅ PWA CONFIGURATION
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/manifest+json',
          },
        ],
      },
    ];
  },
};

export default nextConfig;