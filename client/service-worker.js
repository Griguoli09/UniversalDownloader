// Nome della cache
const CACHE_NAME = 'universaldownloader-cache-v2';

// File da mettere in cache
const FILES_TO_CACHE = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/manifest.json',
  '/images/icon-192x192.png',
  '/images/icon-512x512.png',
  '/images/favicon.ico'
];

// Installazione del Service Worker
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installazione');
  
  // Forza l'attivazione immediata
  self.skipWaiting();
  
  // Mette in cache i file statici
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Cache aperta');
        return cache.addAll(FILES_TO_CACHE);
      })
  );
});

// Attivazione del Service Worker
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Attivazione');
  
  // Prendi il controllo immediato
  self.clients.claim();
  
  // Rimuovi le vecchie cache
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('[Service Worker] Rimozione vecchia cache', key);
          return caches.delete(key);
        }
      }));
    })
  );
});

// Creazione di pagine offline semplici
const offlineResponse = (type) => {
  switch (type) {
    case 'document':
      return new Response(
        '<html><head><title>Offline</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#000;color:#fff;text-align:center;padding:20px;font-family:sans-serif;"><h1>UniversalDownloader Offline</h1><p>Controlla la tua connessione e riprova.</p></body></html>',
        { headers: { 'Content-Type': 'text/html' } }
      );
    default:
      return new Response('Risorsa non disponibile offline', { status: 503 });
  }
};

// Gestione delle richieste di rete
self.addEventListener('fetch', (event) => {
  // Ignora le richieste API e WebSocket
  if (event.request.url.includes('/api/') || 
      event.request.url.startsWith('ws://') || 
      event.request.url.startsWith('wss://')) {
    return;
  }
  
  // Gestione condivisione da Android
  const url = new URL(event.request.url);
  if (url.pathname === '/' && (url.searchParams.has('url') || url.searchParams.has('text'))) {
    console.log('[Service Worker] Intercettazione condivisione URL');
    
    // Non fare cache delle richieste di condivisione
    return;
  }
  
  // Strategia Cache First per le risorse statiche
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - restituisci la risposta dalla cache
        if (response) {
          return response;
        }
        
        // Altrimenti, scarica e memorizza nella cache
        return fetch(event.request)
          .then((response) => {
            // Controlla se abbiamo ricevuto una risposta valida
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clona la risposta (il corpo può essere usato solo una volta)
            var responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch(() => {
            // Se offline e non in cache, mostra una pagina offline
            const acceptHeader = event.request.headers.get('Accept');
            if (acceptHeader && acceptHeader.includes('text/html')) {
              return offlineResponse('document');
            }
            return offlineResponse('resource');
          });
      })
  );
});

// Gestione di eventi push per le notifiche
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Notifica push ricevuta', event);
  
  if (!event.data) {
    console.log('Nessun dato nella notifica push');
    return;
  }
  
  try {
    // Ottieni i dati della notifica
    const data = event.data.json();
    
    // Opzioni di notifica
    const options = {
      body: data.body || 'Nuovo aggiornamento',
      icon: data.icon || '/images/icon-192x192.png',
      badge: '/images/icon-192x192.png',
      vibrate: [100, 50, 100],
      data: data.data || {},
      actions: data.actions || []
    };
    
    // Mostra la notifica
    event.waitUntil(
      self.registration.showNotification(data.title || 'UniversalDownloader', options)
    );
  } catch (error) {
    console.error('Errore elaborazione notifica push:', error);
  }
});

// Gestione del click sulle notifiche
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Click su notifica', event);
  
  // Chiudi la notifica
  event.notification.close();
  
  // Ottieni la URL per aprire l'app
  const urlToOpen = new URL('/', self.location.origin).href;
  
  // Apri l'applicazione nella finestra corretta
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then((windowClients) => {
        // Verifica se c'è già una finestra aperta
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          // Se esiste, porta in primo piano
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Altrimenti apri una nuova finestra
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Intercetta le richieste di condivisione
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Verifica se è una richiesta di condivisione
  if (url.pathname === '/' && (url.searchParams.has('url') || url.searchParams.has('text'))) {
    console.log('[Service Worker] Rilevata condivisione:', url.toString());
    
    // Estrai il testo condiviso
    const sharedText = url.searchParams.get('url') || url.searchParams.get('text') || '';
    
    // Estrai l'URL dalla condivisione
    let extractedUrl = null;
    let serviceType = null;
    
    // Controlla se è un URL Qobuz
    const qobuzUrlRegex = /(https?:\/\/(?:open|play|www)\.qobuz\.com\/[^\s]+)/i;
    const qobuzMatch = sharedText.match(qobuzUrlRegex);
    
    // Controlla se è un URL YouTube
    const youtubeUrlRegex = /(https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[^\s&]+)/i;
    const youtubeMatch = sharedText.match(youtubeUrlRegex);
    
    if (qobuzMatch && qobuzMatch[1]) {
      extractedUrl = qobuzMatch[1];
      serviceType = 'qobuz';
    } else if (youtubeMatch && youtubeMatch[1]) {
      extractedUrl = youtubeMatch[1];
      serviceType = 'youtube';
    }
    
    // Se abbiamo trovato un URL valido, avvia il download
    if (extractedUrl) {
      console.log(`[Service Worker] URL ${serviceType} rilevato:`, extractedUrl);
      
      // Previeni l'apertura dell'interfaccia web
      event.respondWith(
        fetch('/api/download', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            url: extractedUrl,
            serviceType: serviceType
          })
        })
        .then(response => response.json())
        .then(data => {
          // Mostra una notifica di avvio download
          self.registration.showNotification('Download avviato', {
            body: `Download ${serviceType} avviato: ${extractedUrl}`,
            icon: '/images/icon-192x192.png',
            tag: data.download.id,
            vibrate: [100, 50, 100]
          });
          
          // Restituisci una pagina vuota con redirect
          return new Response(`
            <html>
              <head>
                <title>Downloading...</title>
                <meta http-equiv="refresh" content="0;url=about:blank">
                <script>window.close();</script>
              </head>
              <body style="background:black;color:white;text-align:center">
                <h3>Download avviato, questa pagina si chiuderà automaticamente</h3>
              </body>
            </html>
          `, {
            headers: {'Content-Type': 'text/html'}
          });
        })
        .catch(error => {
          console.error('[Service Worker] Errore:', error);
          
          // Mostra una notifica di errore
          self.registration.showNotification('Errore download', {
            body: `Non è stato possibile avviare il download: ${error.message}`,
            icon: '/images/icon-192x192.png',
            vibrate: [100, 50, 100]
          });
          
          // Restituisci una pagina vuota con redirect per non mostrare errori
          return new Response(`
            <html>
              <head>
                <title>Error</title>
                <meta http-equiv="refresh" content="0;url=about:blank">
                <script>window.close();</script>
              </head>
              <body style="background:black;color:white;text-align:center">
                <h3>Si è verificato un errore, questa pagina si chiuderà automaticamente</h3>
              </body>
            </html>
          `, {
            headers: {'Content-Type': 'text/html'}
          });
        })
      );
      
      return;
    }
    
    // Se non abbiamo trovato un URL valido, mostra un messaggio di errore
    event.respondWith(
      Promise.resolve().then(() => {
        self.registration.showNotification('URL non supportato', {
          body: 'Nessun URL valido trovato nel testo condiviso',
          icon: '/images/icon-192x192.png',
          vibrate: [100, 50, 100]
        });
        
        return new Response(`
          <html>
            <head>
              <title>URL non supportato</title>
              <meta http-equiv="refresh" content="0;url=about:blank">
              <script>window.close();</script>
            </head>
            <body style="background:black;color:white;text-align:center">
              <h3>URL non supportato, questa pagina si chiuderà automaticamente</h3>
            </body>
          </html>
        `, {
          headers: {'Content-Type': 'text/html'}
        });
      })
    );
  }
});