const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const dotenv = require('dotenv');

// Carica le variabili d'ambiente dal file .env
dotenv.config();

// Importa i moduli necessari
const { setupRoutes } = require('./routes');
const { loadConfig } = require('./config');

// Carica la configurazione
const config = loadConfig();

// Crea l'applicazione Express
const app = express();
const port = process.env.PORT || 3000;

// Configura i middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../client')));

// Crea il server HTTP
const server = http.createServer(app);

// Configura il server WebSocket per aggiornamenti in tempo reale
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('Client connesso al WebSocket');
  
  ws.on('close', () => {
    console.log('Client disconnesso dal WebSocket');
  });
});

// Rende disponibile il server WebSocket ad altri moduli
app.locals.wss = wss;

// Configura le route API
setupRoutes(app);

// Avvia il server
server.listen(port, () => {
  console.log(`Server UniversalDownloader avviato su http://localhost:${port}`);
  console.log(`Disponibile all'indirizzo http://${config.raspberryPiHost}:${port}`);
  
  // Log della configurazione in un formato sicuro
  try {
    if (config.commands) {
      console.log('Servizi supportati:', Object.keys(config.commands).join(', '));
      
      Object.keys(config.commands).forEach(service => {
        const serviceInfo = {
          command: config.commands[service].download,
          path: config.commands[service].path,
          moveFiles: config.commands[service].moveFiles
        };
        console.log(`Configurazione per ${service}:`, serviceInfo);
      });
    } else {
      console.log('Avviso: config.commands non è definito');
    }
  } catch (error) {
    console.error('Errore durante il logging della configurazione:', error);
  }
});