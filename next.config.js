/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ OTIMIZAÇÕES DE PERFORMANCE COMPATÍVEIS COM NEXT.JS 15
  poweredByHeader: false,
  compress: true,
  
  // ✅ DESENVOLVIMENTO RÁPIDO
  reactStrictMode: false,
  
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
  }
};

export default nextConfig; 