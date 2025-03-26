const webPush = require('web-push');
const { loadConfig } = require('../config');

// Carica la configurazione
const config = loadConfig();

// Configura web-push con le chiavi VAPID (necessarie per le notifiche push)
if (config.vapidPublicKey && config.vapidPrivateKey) {
  webPush.setVapidDetails(
    config.vapidContact,
    config.vapidPublicKey,
    config.vapidPrivateKey
  );
}

// Mappa per memorizzare le sottoscrizioni alle notifiche push
// In un'applicazione di produzione sarebbe preferibile usare un database
const subscriptions = new Map();

/**
 * Gestisce la sottoscrizione alle notifiche push
 * @param {Express.Request} req - La richiesta HTTP
 * @param {Express.Response} res - La risposta HTTP
 */
const subscribe = (req, res) => {
  try {
    const { subscription, clientId } = req.body;
    
    // Verifica che i dati necessari siano presenti
    if (!subscription || !clientId) {
      return res.status(400).json({ 
        error: 'Sottoscrizione e ID client richiesti' 
      });
    }
    
    // Memorizza la sottoscrizione
    subscriptions.set(clientId, subscription);
    
    console.log(`Nuovo client sottoscritto: ${clientId}`);
    res.status(201).json({ message: 'Sottoscrizione completata' });
  } catch (error) {
    console.error('Errore di sottoscrizione:', error);
    res.status(500).json({ error: 'Impossibile completare la sottoscrizione' });
  }
};

/**
 * Invia una notifica push a un client specifico o a tutti
 * @param {string} clientId - ID del client o 'all' per tutti
 * @param {object} message - Messaggio da inviare
 */
const sendNotification = async (clientId, message) => {
  try {
    // Se non ci sono sottoscrizioni o le chiavi VAPID non sono configurate, esci
    if (subscriptions.size === 0 || !config.vapidPublicKey || !config.vapidPrivateKey) {
      console.log('Nessuna sottoscrizione o configurazione VAPID mancante');
      return;
    }
    
    // Se clientId è 'all', invia a tutti i client sottoscritti
    if (clientId === 'all') {
      console.log('Invio notifica a tutti i client...');
      
      const sendPromises = [];
      
      // Cicla su tutte le sottoscrizioni
      for (const [id, subscription] of subscriptions.entries()) {
        try {
          const sendPromise = webPush.sendNotification(
            subscription,
            JSON.stringify(message)
          );
          sendPromises.push(sendPromise);
        } catch (error) {
          console.error(`Errore invio a ${id}:`, error);
          
          // Se la sottoscrizione non è più valida, rimuovila
          if (error.statusCode === 410) {
            subscriptions.delete(id);
          }
        }
      }
      
      // Attendi che tutte le notifiche siano inviate
      await Promise.allSettled(sendPromises);
      console.log('Notifiche inviate con successo');
    } else {
      // Invia solo al client specifico
      const subscription = subscriptions.get(clientId);
      
      if (!subscription) {
        console.warn(`Nessuna sottoscrizione trovata per il client: ${clientId}`);
        return;
      }
      
      await webPush.sendNotification(
        subscription,
        JSON.stringify(message)
      );
      
      console.log(`Notifica inviata al client: ${clientId}`);
    }
  } catch (error) {
    console.error('Errore invio notifica:', error);
  }
};

module.exports = {
  subscribe,
  sendNotification
};