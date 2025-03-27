# UniversalDownloader# UniversalDownloader

Una Progressive Web App (PWA) per scaricare musica da Qobuz e YouTube direttamente sul tuo Raspberry Pi.

![UniversalDownloader Logo](client/images/icon-192x192.png)

## 📝 Descrizione

UniversalDownloader è un'applicazione web che permette di scaricare brani e album da Qobuz e video audio da YouTube sul tuo Raspberry Pi. L'app è progettata per funzionare come una PWA, quindi può essere installata sui dispositivi mobili e integrarsi con la condivisione Android.

### Caratteristiche Principali

- ✅ Download da Qobuz usando `qobuz-dl`
- ✅ Download da YouTube usando `yt-dlp` con estrazione audio in formato MP3
- ✅ Installabile su smartphone come app (PWA)
- ✅ Integrazione con il menu di condivisione Android
- ✅ Rilevamento e validazione automatica degli URL
- ✅ Aggiornamenti in tempo reale tramite WebSocket
- ✅ Notifiche push per download completati o falliti
- ✅ Tema scuro OLED per risparmio batteria
- ✅ Conservazione dei metadati e copertine

## 🏗️ Architettura

Il progetto è composto da due parti principali:

1. **Frontend**: Una Progressive Web App (PWA) sviluppata in HTML, CSS e JavaScript vanilla.
2. **Backend**: Un server Node.js che comunica con il Raspberry Pi tramite SSH per eseguire i comandi di download.

### Flusso di Lavoro

1. L'utente incolla un URL di Qobuz o YouTube nell'app o lo condivide dal dispositivo mobile
2. Il frontend valida l'URL e lo invia al backend
3. Il backend si connette al Raspberry Pi tramite SSH ed esegue il comando appropriato
4. I file vengono scaricati direttamente sul Raspberry Pi
5. L'utente riceve aggiornamenti in tempo reale e notifiche

## 🔧 Tecnologie Utilizzate

- **Backend**:
  - Node.js ed Express
  - WebSocket per aggiornamenti in tempo reale
  - SSH per l'esecuzione remota dei comandi
  - Web Push API per le notifiche

- **Frontend**:
  - HTML5, CSS3, JavaScript
  - Service Worker per funzionalità offline
  - Web Share Target API per integrazione condivisione
  - Manifest PWA per installazione su dispositivi

- **Strumenti di Deploy**:
  - Docker e Docker Compose per containerizzazione
  - Configurazione SSH per connessione al Raspberry Pi

## 📁 Struttura del Progetto

```
UniversalDownloader/
├── client/                  # Frontend PWA
│   ├── css/                 # Stili CSS
│   ├── js/                  # Script JavaScript client
│   ├── images/              # Icone e assets
│   ├── index.html           # Pagina principale
│   ├── manifest.json        # Manifest PWA
│   └── service-worker.js    # Service Worker
├── server/                  # Backend Node.js
│   ├── config/              # Configurazioni
│   ├── controllers/         # Controller API
│   │   ├── downloadController.js    # Gestione download
│   │   └── notificationController.js # Gestione notifiche
│   ├── routes/              # Route API
│   ├── services/            # Servizi
│   │   ├── downloadService.js   # Servizio download
│   │   └── websocketService.js  # Servizio WebSocket
│   └── index.js             # Entry point
├── docker/                  # Configurazione Docker
│   ├── Dockerfile           # Definizione container
│   └── docker-compose.yml   # Configurazione deploy
└── package.json            # Dipendenze e script
```

## 🚀 Installazione e Setup

### Prerequisiti

- Raspberry Pi con SSH abilitato
- Node.js installato sul Raspberry Pi
- [qobuz-dl](https://github.com/vitiko98/qobuz-dl) installato per download Qobuz
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) installato per download YouTube
- Docker e Docker Compose (opzionale)

### Installazione

#### Metodo 1: Utilizzando Docker

1. Clona la repository:
   ```bash
   git clone https://github.com/TUO_USERNAME/UniversalDownloader.git
   cd UniversalDownloader
   ```

2. Configura le variabili d'ambiente in `docker/docker-compose.yml`:
   ```yml
   environment:
     - PORT=3000
     - PI_HOST=192.168.1.xxx # Indirizzo IP del tuo Raspberry Pi
     - PI_USER=raspberry # Username SSH
     - PI_PASSWORD=password # Password SSH
     - DOWNLOAD_PATH=/percorso/alla/cartella/musica
     # Altre variabili...
   ```

3. Avvia il container Docker:
   ```bash
   cd docker
   docker-compose up -d
   ```

4. Accedi all'app navigando a `http://localhost:3000` o `http://IP_RASPBERRY:3000`

#### Metodo 2: Installazione diretta

1. Clona la repository:
   ```bash
   git clone https://github.com/TUO_USERNAME/UniversalDownloader.git
   cd UniversalDownloader
   ```

2. Installa le dipendenze:
   ```bash
   npm install
   ```

3. Crea un file `.env` nella radice del progetto:
   ```
   PORT=3000
   PI_HOST=192.168.1.xxx
   PI_USER=raspberry
   PI_PASSWORD=password
   DOWNLOAD_PATH=/percorso/alla/cartella/musica
   # Altre variabili...
   ```

4. Avvia l'applicazione:
   ```bash
   npm start
   ```

## ⚙️ Configurazione

La configurazione principale si trova in `server/config/index.js`. I valori possono essere sovrascritti tramite variabili d'ambiente:

### Configurazione per Qobuz

```javascript
qobuz: {
  download: 'export PATH=$PATH:/usr/local/bin:/usr/bin:/bin:/home/raspberry/.local/bin && qobuz-dl dl',
  path: '/DATA/Media/Music/Musica/qobuz-dl',
  moveFiles: false // qobuz-dl salva direttamente nella giusta cartella
}
```

### Configurazione per YouTube

```javascript
youtube: {
  download: '/snap/bin/yt-dlp -f bestaudio --extract-audio --audio-format mp3 --audio-quality 0 --embed-thumbnail --add-metadata --ppa "ffmpeg:-metadata album=\'Scaricati da YouTube\'"',
  tempPath: '/home/raspberry/youtube-downloads',
  path: '/DATA/Media/Music/Musica/yt-dlp',
  moveFiles: true // yt-dlp richiede di spostare i file dopo il download
}
```

### Configurazione Notifiche Push

Per abilitare le notifiche push, è necessario configurare le chiavi VAPID:

```javascript
vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
vapidContact: 'mailto:tua.email@example.com'
```

Puoi generare chiavi VAPID utilizzando:
```bash
npx web-push generate-vapid-keys
```

## 🎮 Utilizzo

### 1. Download da URL

1. Apri l'app nel browser
2. Incolla un URL Qobuz o YouTube nella casella di testo
3. Premi il pulsante "Download"
4. Monitora lo stato del download in tempo reale
5. Ricevi una notifica al completamento

### 2. Condivisione da Android

1. Installa l'app sul tuo dispositivo Android aprendo il sito e selezionando "Aggiungi a schermata Home"
2. In qualsiasi app (YouTube, browser), seleziona un link Qobuz o YouTube
3. Premi "Condividi" e seleziona "UniversalDownloader"
4. L'app gestirà automaticamente il download

### 3. Monitoraggio Download

- La sezione "Stato Download" mostra il download corrente in corso
- La "Cronologia Download" mostra i download recenti con stato di completamento

## 🔌 API

Il server espone diverse API REST:

- **POST /api/download**: Avvia un nuovo download
  ```json
  {
    "url": "https://...",
    "serviceType": "qobuz/youtube"
  }
  ```

- **GET /api/downloads**: Recupera la lista di download recenti

- **GET /api/downloads/:id**: Recupera lo stato di un download specifico

- **GET /api/health**: Verifica lo stato del server

- **GET /api/vapid-public-key**: Ottiene la chiave pubblica VAPID per le notifiche push

- **POST /api/subscribe**: Registra un dispositivo per le notifiche push

## 🔄 WebSocket

L'app utilizza WebSocket per fornire aggiornamenti in tempo reale:

- Connessione a `ws://IP_SERVER:PORTA`
- Formato messaggi:
  ```json
  {
    "type": "downloadUpdate",
    "download": {
      "id": "...",
      "url": "...",
      "status": "pending/completed/failed",
      "startTime": "...",
      "endTime": "...",
      "error": null
    }
  }
  ```

## 🔐 Service Worker

Il service worker gestisce:

- Caching delle risorse per funzionamento offline
- Intercettazione delle richieste di condivisione
- Gestione delle notifiche push
- Installazione della PWA

## 🚑 Troubleshooting

### Errori di Connessione SSH

Se riscontri errori di connessione SSH:

1. Verifica che l'indirizzo IP del Raspberry Pi sia corretto in `docker-compose.yml`
2. Assicurati che il servizio SSH sia abilitato sul Raspberry Pi:
   ```bash
   sudo systemctl status ssh
   ```
3. Verifica le credenziali di accesso SSH

### Errori di Permessi

Se riscontri errori "Permission denied":

1. Assicurati che l'utente `raspberry` abbia permessi di scrittura nelle directory di destinazione:
   ```bash
   sudo chown -R raspberry:raspberry /DATA/Media/Music/Musica/yt-dlp
   sudo chmod -R 755 /DATA/Media/Music/Musica/yt-dlp
   ```
2. Per YouTube, verifica che la directory temporanea esista:
   ```bash
   mkdir -p ~/youtube-downloads
   ```

### Errori di Comando

Se i comandi di download falliscono:

1. Verifica che `qobuz-dl` e `yt-dlp` siano installati correttamente:
   ```bash
   qobuz-dl --version
   /snap/bin/yt-dlp --version
   ```
2. Controlla i percorsi nei comandi di download in `server/config/index.js`

## 📋 Comandi Utili

### Gestione Docker

- **Avvio**: `cd ~/universaldownloader/docker && docker-compose up -d`
- **Riavvio**: `cd ~/universaldownloader/docker && docker-compose restart`
- **Stop**: `cd ~/universaldownloader/docker && docker-compose down`
- **Log**: `docker logs -f universaldownloader`
- **Ricostruzione**: `cd ~/universaldownloader/docker && docker-compose down && docker-compose up -d --build`

### Test dei Comandi Download

- **Test Qobuz**:
  ```bash
  cd /DATA/Media/Music/Musica/qobuz-dl
  qobuz-dl dl URL_QOBUZ
  ```

- **Test YouTube**:
  ```bash
  cd /home/raspberry/youtube-downloads
  /snap/bin/yt-dlp -f bestaudio --extract-audio --audio-format mp3 --audio-quality 0 --embed-thumbnail URL_YOUTUBE
  ```

## 🔄 Aggiornamento dell'Applicazione

Per aggiornare l'applicazione con nuove modifiche:

1. Modifica i file necessari
2. Se in modalità sviluppo, il server si riavvierà automaticamente
3. In Docker, riavvia il container:
   ```bash
   cd ~/universaldownloader/docker
   docker-compose restart
   ```

Per aggiornare la repository GitHub:

```bash
cd ~/universaldownloader
git add .
git commit -m "Descrizione delle modifiche"
git push origin main
```

## 📱 Integrazione con altri Servizi

### Navidrome

L'app è progettata per integrarsi con [Navidrome](https://navidrome.org/) o altri server di musica:

- I file scaricati da Qobuz mantengono tutti i metadati
- I file scaricati da YouTube vengono impostati con l'album "Scaricati da YouTube"
- Le copertine vengono incorporate nei file MP3

### Integrazione con la Libreria Musicale

Dopo aver scaricato i file:

1. Navidrome rileverà automaticamente i nuovi file durante la scansione
2. I file scaricati da YouTube avranno i metadati album correttamente impostati

## 🤝 Contributi e Sviluppo

Per contribuire al progetto:

1. Effettua un fork della repository
2. Crea un branch per le tue modifiche (`git checkout -b feature/nuova-funzionalita`)
3. Effettua il commit delle modifiche (`git commit -am 'Aggiunta nuova funzionalità'`)
4. Pusha nel branch (`git push origin feature/nuova-funzionalita`)
5. Crea una Pull Request

## 📄 Licenza

Questo progetto è rilasciato sotto licenza MIT. Vedi il file `LICENSE` per maggiori dettagli.

---

**Sviluppato da [TUO_NOME]**

Per supporto: [TUA_EMAIL@example.com]