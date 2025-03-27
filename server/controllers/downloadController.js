const { executeDownload } = require('../services/downloadService');
const { broadcastStatus } = require('../services/websocketService');
const { sendNotification } = require('./notificationController');
const { loadConfig } = require('../config');

// Array per memorizzare lo storico dei download (in memoria)
// In un'applicazione di produzione sarebbe preferibile usare un database
const downloads = [];

/**
 * Avvia un nuovo download da Qobuz o YouTube
 * @param {Express.Request} req - La richiesta HTTP
 * @param {Express.Response} res - La risposta HTTP
 */
const startDownload = async (req, res) => {
  try {
    const { url, serviceType } = req.body;
    
    // Verifica che l'URL e il tipo di servizio siano stati forniti
    if (!url) {
      return res.status(400).json({ error: 'URL richiesto' });
    }
    
    if (!serviceType) {
      return res.status(400).json({ error: 'Tipo di servizio richiesto' });
    }
    
    // Carica la configurazione per verificare che il servizio sia supportato
    const config = loadConfig();
    if (!config.commands[serviceType]) {
      return res.status(400).json({ error: `Servizio "${serviceType}" non supportato` });
    }
    
    // Valida URL in base al tipo di servizio
    if (serviceType === 'qobuz' && !url.includes('qobuz.com')) {
      return res.status(400).json({ error: 'URL Qobuz non valido' });
    } else if (serviceType === 'youtube' && 
              !(url.includes('youtube.com/watch') || url.includes('youtu.be/'))) {
      return res.status(400).json({ error: 'URL YouTube non valido' });
    }
    
    // Crea un record per il download
    const download = {
      id: Date.now().toString(), // ID unico basato sul timestamp
      url,
      serviceType,
      status: 'pending', // pending, completed, failed
      startTime: new Date(),
      endTime: null,
      error: null
    };
    
    // Aggiungi all'inizio dell'array (più recente in cima)
    downloads.unshift(download);
    
    // Rispondi immediatamente al client
    res.status(202).json({ download });
    
    // Esegui il download in modo asincrono
    try {
      // Esegui il comando di download
      const result = await executeDownload(url, download.id, serviceType);
      
      // Aggiorna lo stato del download
      download.status = 'completed';
      download.endTime = new Date();
      
      // Invia aggiornamenti tramite WebSocket
      broadcastStatus(req.app.locals.wss, download);
      
      // Invia notifica di completamento
      sendNotification('all', {
        title: 'Download Completato',
        body: `Download da ${serviceType === 'youtube' ? 'YouTube' : 'Qobuz'} completato con successo`,
        icon: '/images/icon-192x192.png',
        tag: download.id,
        data: { url, downloadId: download.id, status: 'completed', serviceType }
      });
    } catch (error) {
      // In caso di errore, aggiorna lo stato
      download.status = 'failed';
      download.error = error.message;
      download.endTime = new Date();
      
      // Registra dettagli dell'errore nei log
      console.error('Dettagli errore download:', {
        id: download.id,
        url: url,
        serviceType: serviceType,
        error: error.message,
        stack: error.stack
      });
      
      // Invia aggiornamenti tramite WebSocket
      broadcastStatus(req.app.locals.wss, download);
      
      // Invia notifica di errore
      sendNotification('all', {
        title: 'Errore Download',
        body: `Impossibile completare il download: ${error.message}`,
        icon: '/images/icon-192x192.png',
        tag: download.id,
        data: { url, downloadId: download.id, status: 'failed', serviceType }
      });
      
      console.error('Errore durante il download:', error);
    }
  } catch (error) {
    console.error('Errore durante l\'avvio del download:', error);
    res.status(500).json({ error: 'Impossibile avviare il download' });
  }
};

/**
 * Ottiene la lista dei download recenti
 * @param {Express.Request} req - La richiesta HTTP
 * @param {Express.Response} res - La risposta HTTP
 */
const getDownloads = (req, res) => {
  // Restituisci tutti i download (limitati ai primi 20 per performance)
  res.json({ downloads: downloads.slice(0, 20) });
};

/**
 * Ottiene lo stato di un singolo download
 * @param {Express.Request} req - La richiesta HTTP
 * @param {Express.Response} res - La risposta HTTP
 */
const getDownloadStatus = (req, res) => {
  const downloadId = req.params.id;
  const download = downloads.find(d => d.id === downloadId);
  
  if (!download) {
    return res.status(404).json({ error: 'Download non trovato' });
  }
  
  res.json({ download });
};

module.exports = {
  startDownload,
  getDownloads,
  getDownloadStatus
};