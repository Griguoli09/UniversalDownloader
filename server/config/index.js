const fs = require('fs');
const path = require('path');

/**
 * Carica la configurazione del server
 * Gestisce le variabili d'ambiente e i valori predefiniti
 */
const loadConfig = () => {
  // Configurazione predefinita
  const defaultConfig = {
    // Configurazione Raspberry Pi
    raspberryPiHost: process.env.PI_HOST || '192.168.1.178',
    raspberryPiUser: process.env.PI_USER || 'raspberry',
    raspberryPiPassword: process.env.PI_PASSWORD,
    raspberryPiKey: process.env.PI_KEY_PATH,
    
    // Configurazione dei comandi e percorsi
    commands: {
      qobuz: {
        download: 'export PATH=$PATH:/usr/local/bin:/usr/bin:/bin:/home/raspberry/.local/bin && qobuz-dl dl',
        path: '/DATA/Media/Music/Musica/qobuz-dl',
        moveFiles: false // qobuz-dl salva direttamente nella giusta cartella
      },
      youtube: {
        download: '/snap/bin/yt-dlp -f bestaudio --extract-audio --audio-format mp3 --audio-quality 0',
        path: '/DATA/Media/Music/Musica/yt-dlp',
        moveFiles: true // yt-dlp richiede di spostare i file dopo il download
      }
    },
    
    // Configurazione notifiche push
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
    vapidContact: process.env.VAPID_CONTACT || 'mailto:your-email@example.com'
  };
  
  return defaultConfig;
};

module.exports = { loadConfig };