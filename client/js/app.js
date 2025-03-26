// Variabili globali
let websocket;
let clientId = localStorage.getItem('clientId') || generateClientId();
let isOnline = navigator.onLine;
let notificationPermission = false;

// Salva l'ID client
localStorage.setItem('clientId', clientId);

// Elementi DOM
const qobuzUrlInput = document.getElementById('qobuz-url');
const downloadBtn = document.getElementById('download-btn');
const urlInfo = document.getElementById('url-info');
const currentDownload = document.getElementById('current-download');
const statusLabel = document.getElementById('status-label');
const statusTime = document.getElementById('status-time');
const statusUrl = document.getElementById('status-url');
const progressBar = document.getElementById('progress-bar');
const downloadHistory = document.getElementById('download-history');

/**
 * Inizializza l'applicazione
 */
function init() {
  // Controlla se l'app è stata aperta tramite condivisione
  checkForSharedUrl();
  
  // Configura gli event listener
  setupEventListeners();
  
  // Connette al WebSocket per aggiornamenti in tempo reale
  connectWebSocket();
  
  // Carica lo storico dei download
  loadDownloadHistory();
  
  // Richiedi permesso per le notifiche
  requestNotificationPermission();
}

/**
 * Genera un ID client univoco
 * @returns {string} - ID client generato
 */
function generateClientId() {
  return 'client_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Valida se l'URL è un link supportato (Qobuz o YouTube)
 * @param {string} url - URL da validare
 * @returns {string|null} - Il tipo di servizio ('qobuz', 'youtube') o null se non valido
 */
function getServiceType(url) {
  if (!url) return null;
  
  // Verifica se è un URL Qobuz
  if (url.includes('qobuz.com')) {
    return 'qobuz';
  }
  
  // Verifica se è un URL YouTube
  if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
    return 'youtube';
  }
  
  return null;
}

/**
 * Estrae un URL valido (Qobuz o YouTube) da un testo completo
 * @param {string} text - Testo completo che potrebbe contenere un URL
 * @returns {string|null} - URL estratto o null se non trovato
 */
function extractUrl(text) {
  if (!text) return null;
  
  // Regex per trovare URL di Qobuz
  const qobuzUrlRegex = /(https?:\/\/(?:open|play|www)\.qobuz\.com\/[^\s]+)/i;
  const qobuzMatch = text.match(qobuzUrlRegex);
  
  if (qobuzMatch && qobuzMatch[1]) {
    return qobuzMatch[1];
  }
  
  // Regex per trovare URL di YouTube
  const youtubeUrlRegex = /(https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[^\s&]+)/i;
  const youtubeMatch = text.match(youtubeUrlRegex);
  
  if (youtubeMatch && youtubeMatch[1]) {
    return youtubeMatch[1];
  }
  
  return null;
}

/**
 * Controlla se l'app è stata aperta tramite condivisione
 * Estrae l'URL dal testo completo condiviso
 */
function checkForSharedUrl() {
  // Ottieni URL dai parametri query se presente
  const urlParams = new URLSearchParams(window.location.search);
  const sharedText = urlParams.get('url') || urlParams.get('text');
  
  if (sharedText) {
    console.log('Testo condiviso ricevuto:', sharedText);
    
    // Estrai l'URL dal testo condiviso
    const extractedUrl = extractUrl(sharedText);
    
    if (extractedUrl) {
      // Imposta solo l'URL estratto nell'input
      qobuzUrlInput.value = extractedUrl;
      
      const serviceType = getServiceType(extractedUrl);
      urlInfo.textContent = `URL ${serviceType === 'qobuz' ? 'Qobuz' : 'YouTube'} estratto da condivisione`;
      
      console.log('URL estratto:', extractedUrl, 'Tipo:', serviceType);
      
      // Rimuovi i parametri URL senza ricaricare la pagina
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Avvia automaticamente il download dell'URL estratto
      downloadFromUrl();
    } else {
      // Nessun URL valido trovato nel testo condiviso
      qobuzUrlInput.value = decodeURIComponent(sharedText);
      urlInfo.textContent = 'Nessun URL valido trovato';
      urlInfo.style.color = 'var(--error-color)';
      
      // Rimuovi i parametri URL senza ricaricare la pagina
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }
}

/**
 * Configura tutti gli event listener
 */
function setupEventListeners() {
  // Click sul pulsante di download
  downloadBtn.addEventListener('click', downloadFromUrl);
  
  // Convalida dell'input
  qobuzUrlInput.addEventListener('input', () => {
    // Controlla se l'input contiene un URL valido
    const extractedUrl = extractUrl(qobuzUrlInput.value);
    
    if (extractedUrl) {
      // Se abbiamo trovato un URL, lo sostituiamo nell'input
      if (extractedUrl !== qobuzUrlInput.value) {
        qobuzUrlInput.value = extractedUrl;
      }
      
      const serviceType = getServiceType(extractedUrl);
      urlInfo.textContent = `URL ${serviceType === 'qobuz' ? 'Qobuz' : 'YouTube'} valido`;
      urlInfo.style.color = 'var(--success-color)';
    } else if (qobuzUrlInput.value.trim() !== '') {
      urlInfo.textContent = 'Inserisci un URL valido (Qobuz o YouTube)';
      urlInfo.style.color = 'var(--error-color)';
    } else {
      urlInfo.textContent = '';
    }
  });
  
  // Aggiungi anche un listener per paste
  qobuzUrlInput.addEventListener('paste', (e) => {
    // Lascia che l'evento paste avvenga normalmente
    setTimeout(() => {
      // Dopo che il testo è stato incollato, controlla se contiene un URL
      const extractedUrl = extractUrl(qobuzUrlInput.value);
      if (extractedUrl && extractedUrl !== qobuzUrlInput.value) {
        qobuzUrlInput.value = extractedUrl;
        
        const serviceType = getServiceType(extractedUrl);
        urlInfo.textContent = `URL ${serviceType === 'qobuz' ? 'Qobuz' : 'YouTube'} estratto`;
        urlInfo.style.color = 'var(--success-color)';
      }
    }, 0);
  });
  
  // Stato online/offline
  window.addEventListener('online', () => {
    isOnline = true;
    connectWebSocket();
  });
  
  window.addEventListener('offline', () => {
    isOnline = false;
    if (websocket) {
      websocket.close();
    }
  });
}

/**
 * Connette al server WebSocket per aggiornamenti in tempo reale
 */
function connectWebSocket() {
  if (!isOnline || websocket) return;
  
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;
  
  websocket = new WebSocket(wsUrl);
  
  websocket.onopen = () => {
    console.log('WebSocket connesso');
  };
  
  websocket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      if (data.type === 'downloadUpdate') {
        updateDownloadStatus(data.download);
      }
    } catch (error) {
      console.error('Errore parsing messaggio WebSocket:', error);
    }
  };
  
  websocket.onclose = () => {
    console.log('WebSocket disconnesso');
    websocket = null;
    
    // Prova a riconnetterti dopo 5 secondi se online
    if (isOnline) {
      setTimeout(connectWebSocket, 5000);
    }
  };
  
  websocket.onerror = (error) => {
    console.error('Errore WebSocket:', error);
    websocket.close();
  };
}

/**
 * Richiede il permesso per le notifiche
 */
async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('Questo browser non supporta le notifiche');
    return;
  }
  
  if (Notification.permission === 'granted') {
    notificationPermission = true;
    subscribeToPushNotifications();
  } else if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    notificationPermission = permission === 'granted';
    
    if (notificationPermission) {
      subscribeToPushNotifications();
    }
  }
}

/**
 * Sottoscrive alle notifiche push
 */
async function subscribeToPushNotifications() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Notifiche push non supportate');
      return;
    }
    
    const registration = await navigator.serviceWorker.ready;
    
    // Ottieni la sottoscrizione push
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      try {
        // Ottieni la chiave pubblica dal server
        const response = await fetch('/api/vapid-public-key');
        if (!response.ok) {
          throw new Error('Chiave VAPID non disponibile');
        }
        
        const vapidPublicKey = await response.text();
        
        // Converti la chiave pubblica in Uint8Array
        const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
        
        // Crea una nuova sottoscrizione
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey
        });
      } catch (error) {
        console.error('Errore durante la sottoscrizione push:', error);
        return;
      }
    }
    
    // Invia la sottoscrizione al server
    await fetch('/api/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        subscription,
        clientId
      })
    });
    
    console.log('Sottoscrizione push completata');
  } catch (error) {
    console.error('Impossibile sottoscriversi alle notifiche push:', error);
  }
}

/**
 * Converte base64 in Uint8Array per la sottoscrizione push
 * @param {string} base64String - Stringa base64
 * @returns {Uint8Array} - Array convertito
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  
  return outputArray;
}

/**
 * Avvia il download dall'URL
 */
async function downloadFromUrl() {
  console.log("Avvio funzione downloadFromUrl");
  const url = qobuzUrlInput.value.trim();
  
  if (!url) {
    urlInfo.textContent = 'Inserisci un URL da scaricare';
    urlInfo.style.color = 'var(--error-color)';
    return;
  }
  
  // Prova a estrarre un URL valido dal testo incollato
  const extractedUrl = extractUrl(url);
  
  if (!extractedUrl) {
    urlInfo.textContent = 'URL non valido. Inserisci un link Qobuz o YouTube';
    urlInfo.style.color = 'var(--error-color)';
    return;
  }
  
  // Determina il tipo di servizio
  const serviceType = getServiceType(extractedUrl);
  if (!serviceType) {
    urlInfo.textContent = 'URL non supportato. Supportiamo solo Qobuz e YouTube';
    urlInfo.style.color = 'var(--error-color)';
    return;
  }
  
  console.log(`URL estratto: ${extractedUrl}, Tipo: ${serviceType}`);
  
  // Usa l'URL estratto, non quello originale
  const finalUrl = extractedUrl;
  
  // Disabilita il pulsante durante la richiesta
  downloadBtn.disabled = true;
  downloadBtn.textContent = 'Invio in corso...';
  
  try {
    console.log(`Invio richiesta API con URL: ${finalUrl}, Tipo: ${serviceType}`);
    
    const response = await fetch('/api/download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        url: finalUrl,
        serviceType: serviceType
      })
    });
    
    console.log(`Risposta ricevuta, status: ${response.status}`);
    
    let data;
    
    try {
      data = await response.json();
      console.log('Dati risposta:', data);
    } catch (e) {
      console.error('Errore parsing JSON:', e);
      throw new Error('Risposta non valida dal server');
    }
    
    if (!response.ok) {
      throw new Error(data.error || `Errore durante l'avvio del download da ${serviceType}`);
    }
    
    // Mostra lo stato del download corrente
    updateDownloadStatus(data.download);
    
    // Pulisci l'input
    qobuzUrlInput.value = '';
    urlInfo.textContent = `Download da ${serviceType === 'qobuz' ? 'Qobuz' : 'YouTube'} iniziato con successo`;
    urlInfo.style.color = 'var(--success-color)';
  } catch (error) {
    console.error('Errore download:', error);
    urlInfo.textContent = `Errore: ${error.message}`;
    urlInfo.style.color = 'var(--error-color)';
    
    // Crea un oggetto download fittizio per mostrare l'errore
    const errorDownload = {
      id: 'error-' + Date.now(),
      url: finalUrl,
      serviceType: serviceType,
      status: 'failed',
      startTime: new Date(),
      endTime: new Date(),
      error: error.message
    };
    
    updateDownloadStatus(errorDownload);
  } finally {
    // Riabilita il pulsante
    downloadBtn.disabled = false;
    downloadBtn.textContent = 'Download';
  }
}

/**
 * Carica la cronologia dei download dall'API
 */
async function loadDownloadHistory() {
  try {
    const response = await fetch('/api/downloads');
    
    if (!response.ok) {
      throw new Error('Impossibile caricare la cronologia dei download');
    }
    
    const data = await response.json();
    
    // Pulisci la visualizzazione corrente della cronologia
    downloadHistory.innerHTML = '';
    
    if (data.downloads.length === 0) {
      downloadHistory.innerHTML = '<div class="empty-state">Nessun download recente</div>';
      return;
    }
    
    // Aggiungi ogni download alla cronologia
    data.downloads.forEach(download => {
      addToDownloadHistory(download, false);
    });
    
    // Se c'è un download attivo, mostralo nello stato corrente
    const activeDownload = data.downloads.find(d => d.status === 'pending');
    if (activeDownload) {
      updateDownloadStatus(activeDownload);
    }
  } catch (error) {
    console.error('Errore caricamento cronologia:', error);
    downloadHistory.innerHTML = '<div class="empty-state">Impossibile caricare la cronologia</div>';
  }
}

/**
 * Aggiorna l'interfaccia per lo stato di un download
 * @param {object} download - Oggetto download
 */
function updateDownloadStatus(download) {
  // Aggiorna la card del download attivo
  currentDownload.classList.remove('hidden');
  
  // Determina il testo del servizio
  const serviceLabel = download.serviceType === 'youtube' ? 'YouTube' : 'Qobuz';
  
  statusUrl.textContent = `${serviceLabel}: ${download.url}`;
  statusTime.textContent = formatTime(download.startTime);
  
  // Aggiorna l'etichetta di stato
  statusLabel.textContent = getStatusText(download.status);
  statusLabel.className = 'status-label ' + download.status;
  
  // Anima la barra di progresso se in attesa
  if (download.status === 'pending') {
    progressBar.style.width = '100%';
    progressBar.style.animation = 'progress-indeterminate 1.5s infinite linear';
    
    // Nascondi il messaggio di errore se presente
    document.getElementById('error-container').classList.add('hidden');
  } else {
    progressBar.style.width = '100%';
    progressBar.style.animation = 'none';
    
    // Se c'è un errore, mostralo
    if (download.status === 'failed' && download.error) {
      const errorContainer = document.getElementById('error-container');
      const errorMessage = document.getElementById('error-message');
      
      errorContainer.classList.remove('hidden');
      errorMessage.textContent = download.error;
    } else {
      document.getElementById('error-container').classList.add('hidden');
    }
  }
  
  // Aggiungi alla cronologia se completato o fallito
  if (download.status === 'completed' || download.status === 'failed') {
    addToDownloadHistory(download);
  }
}

/**
 * Aggiunge un download alla lista della cronologia
 * @param {object} download - Oggetto download
 * @param {boolean} prepend - Se true, aggiunge all'inizio della lista
 */
function addToDownloadHistory(download, prepend = true) {
  // Rimuovi lo stato vuoto se presente
  const emptyState = downloadHistory.querySelector('.empty-state');
  if (emptyState) {
    emptyState.remove();
  }
  
  // Determina il testo del servizio
  const serviceLabel = download.serviceType === 'youtube' ? 'YouTube' : 'Qobuz';
  
  // Crea l'elemento della cronologia
  const historyItem = document.createElement('div');
  historyItem.className = 'history-item';
  historyItem.dataset.id = download.id;
  
  // Indicatore di stato
  const statusIndicator = document.createElement('span');
  statusIndicator.className = 'status-label ' + download.status;
  statusIndicator.textContent = getStatusText(download.status);
  
  // Indicatore di servizio
  const serviceIndicator = document.createElement('span');
  serviceIndicator.className = 'service-label';
  serviceIndicator.textContent = serviceLabel;
  
  // Visualizzazione URL
  const urlElement = document.createElement('div');
  urlElement.className = 'history-url';
  urlElement.textContent = download.url;
  
  // Visualizzazione ora
  const timeElement = document.createElement('span');
  timeElement.className = 'status-time';
  timeElement.textContent = formatTime(download.endTime || download.startTime);
  
  // Assemblaggio dell'elemento
  historyItem.appendChild(statusIndicator);
  historyItem.appendChild(serviceIndicator);
  historyItem.appendChild(urlElement);
  historyItem.appendChild(timeElement);
  
  // Aggiungi alla lista della cronologia
  if (prepend) {
    downloadHistory.prepend(historyItem);
  } else {
    downloadHistory.appendChild(historyItem);
  }
  
  // Limita gli elementi della cronologia (mantieni gli ultimi 10)
  const historyItems = downloadHistory.querySelectorAll('.history-item');
  if (historyItems.length > 10) {
    for (let i = 10; i < historyItems.length; i++) {
      historyItems[i].remove();
    }
  }
}

/**
 * Formatta l'ora per la visualizzazione
 * @param {string} timeString - Stringa dell'ora
 * @returns {string} - Ora formattata
 */
function formatTime(timeString) {
  const date = new Date(timeString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Ottiene il testo leggibile dello stato
 * @param {string} status - Codice di stato
 * @returns {string} - Testo dello stato
 */
function getStatusText(status) {
  switch (status) {
    case 'pending':
      return 'In corso';
    case 'completed':
      return 'Completato';
    case 'failed':
      return 'Fallito';
    default:
      return 'Sconosciuto';
  }
}

// Inizializza quando il documento è pronto
document.addEventListener('DOMContentLoaded', init);