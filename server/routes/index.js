const path = require('path');
const webPush = require('web-push');
const { loadConfig } = require('../config');

// Importa i controller
const downloadController = require('../controllers/downloadController');
const notificationController = require('../controllers/notificationController');

/**
 * Configura tutte le rotte API dell'applicazione
 * @param {Express.Application} app - L'istanza dell'applicazione Express
 */
const setupRoutes = (app) => {
  const config = loadConfig();
  
  // Endpoint per il controllo salute del server
  app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'OK', version: '1.0.0' });
  });
  
  // Endpoint per ottenere la chiave pubblica VAPID (per notifiche push)
  app.get('/api/vapid-public-key', (req, res) => {
    if (!config.vapidPublicKey) {
      return res.status(404).send('Chiave VAPID non configurata');
    }
    res.send(config.vapidPublicKey);
  });
  
  // Endpoint per la gestione dei download
  app.post('/api/download', downloadController.startDownload);
  app.get('/api/downloads', downloadController.getDownloads);
  app.get('/api/downloads/:id', downloadController.getDownloadStatus);
  
  // Endpoint per la gestione delle notifiche
  app.post('/api/subscribe', notificationController.subscribe);
  
  // Rotta catch-all per servire la PWA (per routing lato client)
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/index.html'));
  });
};

module.exports = { setupRoutes };