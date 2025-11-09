const CACHE_NAME = 'radar-detran-static-v2';

// APENAS recursos estáticos que NUNCA mudam
const staticUrlsToCache = [
  '/manifest.json?v=2',
  '/icons/v2/icon-192x192-v2.png',
  '/icons/v2/icon-512x512-v2.png'
];

// Rotas que NUNCA devem ser cacheadas (sistema de agendamento)
const neverCacheRoutes = [
  '/api/',
  '/supervisor/',
  '/membro/',
  '/admin/'
];

// Verificar se usuário está logado
function isUserAuthenticated() {
  try {
    // Verificar localStorage para auth
    const supervisorAuth = self.localStorage?.getItem('supervisorAuth');
    const membroAuth = self.localStorage?.getItem('membroAuth');
    return !!(supervisorAuth || membroAuth);
  } catch {
    return false;
  }
}

// Instalar Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(staticUrlsToCache);
    })
  );
  self.skipWaiting();
});

// Estratégia: MÍNIMO cache, máxima conectividade
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Ignorar requests de extensões
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // NUNCA cachear rotas do sistema (agendamento precisa estar sempre atualizado)
  if (neverCacheRoutes.some(route => url.pathname.startsWith(route))) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // Se offline e logado, mostrar erro
          return new Response(JSON.stringify({
            error: 'Sistema requer conexão',
            message: 'Este sistema de agendamento precisa estar online para funcionar.',
            requiresOnline: true
          }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }

  // Apenas ícones e manifest podem usar cache
  if (url.pathname.includes('/icons/') || url.pathname.includes('/manifest.json')) {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          return response || fetch(event.request).then(response => {
            if (response.ok) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseClone);
              });
            }
            return response;
          });
        })
    );
    return;
  }

  // Todas as outras requisições: SEMPRE da rede
  event.respondWith(
    fetch(event.request)
      .catch(() => {
        // Se offline, redirecionar para página de erro
        if (event.request.mode === 'navigate') {
          return new Response(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Sistema Offline</title>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
            </head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1>🌐 Conexão Necessária</h1>
              <p>Este sistema de agendamento precisa estar online para funcionar.</p>
              <button onclick="window.location.reload()" style="padding: 10px 20px; font-size: 16px; background: #2563eb; color: white; border: none; border-radius: 5px; cursor: pointer;">
                Tentar Novamente
              </button>
            </body>
            </html>
          `, {
            headers: { 'Content-Type': 'text/html' }
          });
        }
        
        return new Response('Offline', { status: 503 });
      })
  );
});

// Ativar Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Push notifications
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'Nova notificação do Radar Detran',
    icon: '/icons/v2/icon-192x192-v2.png',
    badge: '/icons/v2/icon-72x72-v2.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Ver detalhes',
        icon: '/icons/v2/icon-192x192-v2.png'
      },
      {
        action: 'close',
        title: 'Fechar',
        icon: '/icons/v2/icon-192x192-v2.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Radar Detran', options)
  );
});

// Clique na notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});