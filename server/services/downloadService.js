const { NodeSSH } = require('node-ssh');
const { loadConfig } = require('../config');

// Carica la configurazione
const config = loadConfig();

// Istanza SSH per la connessione al Raspberry Pi
const ssh = new NodeSSH();

// Flag per tracciare se c'è un tentativo di connessione in corso
let isConnecting = false;
// Timestamp dell'ultima connessione
let lastConnectionAttempt = 0;

/**
 * Connette al Raspberry Pi tramite SSH
 * @returns {Promise<NodeSSH>} - Istanza SSH connessa
 */
const connectToRaspberryPi = async () => {
  try {
    // Controlla se è già connesso
    if (ssh.isConnected()) {
      console.log('Riutilizzo connessione SSH esistente');
      return ssh;
    }

    // Evita tentativi di connessione multipli simultanei
    if (isConnecting) {
      console.log('Connessione SSH già in corso, in attesa...');
      // Attendi fino a 10 secondi per il completamento della connessione
      for (let i = 0; i < 20; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        if (ssh.isConnected()) {
          return ssh;
        }
      }
      throw new Error('Timeout durante attesa connessione SSH');
    }

    // Previene tentativi di riconnessione troppo frequenti
    const now = Date.now();
    if (now - lastConnectionAttempt < 5000) {
      console.log('Attesa breve prima di tentare la riconnessione...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    lastConnectionAttempt = Date.now();
    isConnecting = true;
    
    // Opzioni di connessione base
    const connectionOptions = {
      host: config.raspberryPiHost,
      username: config.raspberryPiUser,
      // Aumenta i timeout per connessioni più stabili
      readyTimeout: 30000, // 30 secondi di timeout 
      keepaliveInterval: 10000, // Invia keepalive ogni 10 secondi
      // Configura i tentativi di riconnessione
      reconnect: true,
      reconnectTries: 3,
      reconnectDelay: 5000
    };
    
    // Aggiungi metodo di autenticazione (password o chiave)
    if (config.raspberryPiPassword) {
      connectionOptions.password = config.raspberryPiPassword;
    } else if (config.raspberryPiKey) {
      connectionOptions.privateKey = config.raspberryPiKey;
    } else {
      isConnecting = false;
      throw new Error('Nessun metodo di autenticazione fornito per SSH');
    }
    
    console.log(`Connessione SSH a ${config.raspberryPiHost}...`);
    
    try {
      // Connessione SSH
      await ssh.connect(connectionOptions);
      console.log('Connesso al Raspberry Pi con successo');
      return ssh;
    } catch (connError) {
      console.error('Errore durante la connessione SSH:', connError);
      
      // Verifica se l'errore è di tipo ECONNRESET o ETIMEDOUT
      if (connError.code === 'ECONNRESET' || connError.code === 'ETIMEDOUT') {
        console.log('Errore di connessione temporaneo, tentativo di riconnessione...');
        // Breve attesa prima di riprovare
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Secondo tentativo
        console.log('Secondo tentativo di connessione...');
        await ssh.connect(connectionOptions);
        console.log('Connesso al Raspberry Pi al secondo tentativo');
        return ssh;
      } else {
        throw connError; // Rilancia altri tipi di errore
      }
    } finally {
      isConnecting = false;
    }
  } catch (error) {
    isConnecting = false;
    console.error('Errore connessione SSH:', error);
    
    // Messaggi di errore più dettagliati e suggerimenti
    if (error.code === 'ECONNREFUSED') {
      throw new Error(`Connessione SSH rifiutata: verifica che il servizio SSH sia attivo su ${config.raspberryPiHost}`);
    } else if (error.code === 'ECONNRESET') {
      throw new Error(`Connessione SSH interrotta: verifica che la rete sia stabile e il Raspberry Pi sia raggiungibile`);
    } else if (error.code === 'ETIMEDOUT') {
      throw new Error(`Timeout connessione SSH: il Raspberry Pi (${config.raspberryPiHost}) non risponde`);
    } else if (error.level === 'client-authentication') {
      throw new Error(`Autenticazione SSH fallita: verifica username e password`);
    } else {
      throw new Error(`Errore connessione SSH: ${error.message}`);
    }
  }
};

/**
 * Esegue il comando di download sul Raspberry Pi
 * @param {string} url - URL da scaricare
 * @param {string} downloadId - ID del download
 * @param {string} serviceType - Tipo di servizio ('qobuz' o 'youtube')
 * @returns {Promise<object>} - Risultato dell'esecuzione del comando
 */
const executeDownload = async (url, downloadId, serviceType = 'qobuz') => {
  let sshConnection = null;
  
  try {
    // Ottieni configurazione specifica per il servizio
    if (!config.commands[serviceType]) {
      throw new Error(`Servizio non supportato: ${serviceType}`);
    }
    
    const serviceConfig = config.commands[serviceType];
    console.log(`Usando configurazione per ${serviceType}:`, serviceConfig);
    
    // Connetti al Raspberry Pi
    console.log('Inizializzazione connessione SSH...');
    sshConnection = await connectToRaspberryPi();
    
    // Gestione specializzata per YouTube
    if (serviceType === 'youtube') {
      return await executeYouTubeDownload(url, sshConnection, serviceConfig);
    } else {
      // Logica esistente per Qobuz
      const command = `${serviceConfig.download} ${url}`;
      console.log(`Esecuzione comando per ${serviceType}: ${command}`);
      console.log(`Directory di lavoro: ${serviceConfig.path}`);
      
      // Esegui il comando remoto
      const result = await sshConnection.execCommand(command, {
        cwd: serviceConfig.path,
        onStdout: (chunk) => {
          console.log(`STDOUT: ${chunk.toString('utf8')}`);
        },
        onStderr: (chunk) => {
          console.error(`STDERR: ${chunk.toString('utf8')}`);
        }
      });
      
      // Verifica se il comando è stato eseguito con successo
      if (result.code !== 0) {
        const errorMsg = `Download fallito: ${result.stderr}`;
        throw new Error(errorMsg);
      }
      
      console.log(`Download ${serviceType} completato con successo, codice: ${result.code}`);
      return result;
    }
  } catch (error) {
    console.error('Errore esecuzione download:', error);
    throw error;
  }
};

/**
 * Gestisce in modo specifico il download da YouTube
 * @param {string} url - URL YouTube
 * @param {NodeSSH} ssh - Connessione SSH
 * @param {object} serviceConfig - Configurazione del servizio
 * @returns {Promise<object>} - Risultato dell'esecuzione
 */
const executeYouTubeDownload = async (url, ssh, serviceConfig) => {
  try {
    // Crea le directory se non esistono
    console.log(`Creazione directory temporanea: ${serviceConfig.tempPath}`);
    await ssh.execCommand(`mkdir -p "${serviceConfig.tempPath}"`, { cwd: '/' });
    
    console.log(`Verifica directory finale: ${serviceConfig.path}`);
    await ssh.execCommand(`sudo mkdir -p "${serviceConfig.path}"`, { cwd: '/' });
    
    // Comando di download
    const command = `${serviceConfig.download} "${url}" -o "%(title)s.%(ext)s"`;
    console.log(`Esecuzione download YouTube: ${command}`);
    
    // Variabili per monitorare il progresso
    let downloadedFileName = null;
    let isDownloadSuccessful = false;
    let downloadOutput = '';
    
    // Esegui il comando di download
    const downloadResult = await ssh.execCommand(command, {
      cwd: serviceConfig.tempPath,
      onStdout: (chunk) => {
        const output = chunk.toString('utf8');
        downloadOutput += output;
        console.log(`YouTube download output: ${output}`);
        
        // Cerca di identificare il nome del file dall'output
        const destMatch = output.match(/Destination: (.+\.mp3)/);
        if (destMatch && destMatch[1]) {
          downloadedFileName = destMatch[1];
          console.log(`File identificato: ${downloadedFileName}`);
        }
        
        // Verifica se il download è stato completato
        if (output.includes('[ExtractAudio] Destination:') || 
            output.includes('Deleting original file') || 
            output.includes('has already been downloaded and merged')) {
          isDownloadSuccessful = true;
        }
      },
      onStderr: (chunk) => {
        const output = chunk.toString('utf8');
        downloadOutput += output;
        console.error(`YouTube download error: ${output}`);
      }
    });
    
    // Se non abbiamo trovato il nome del file nell'output, cerchiamolo
    if (!downloadedFileName) {
      console.log('Nome file non identificato, cercando MP3 recenti...');
      const findResult = await ssh.execCommand('find . -name "*.mp3" -type f -mmin -5 | head -1', {
        cwd: serviceConfig.tempPath
      });
      
      if (findResult.stdout.trim()) {
        downloadedFileName = findResult.stdout.trim().replace('./', '');
        console.log(`File trovato con ricerca: ${downloadedFileName}`);
      }
    }
    
    // Verifica se il download è completo
    if (downloadResult.code !== 0 && !isDownloadSuccessful) {
      throw new Error(`Errore download YouTube: processo terminato con codice ${downloadResult.code}`);
    }
    
    console.log('Download YouTube completato con successo');
    
    // Attendi 5 secondi prima di spostare il file (come richiesto)
    console.log('Attesa di 5 secondi prima di spostare il file...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Sposta il file nella destinazione finale
    if (downloadedFileName) {
      console.log(`Spostamento di "${downloadedFileName}" nella directory finale...`);
      
      const moveCommand = `sudo cp "${serviceConfig.tempPath}/${downloadedFileName}" "${serviceConfig.path}/${downloadedFileName}" && sudo rm "${serviceConfig.tempPath}/${downloadedFileName}"`;
      
      const moveResult = await ssh.execCommand(moveCommand);
      
      if (moveResult.stderr) {
        console.error(`Errore durante lo spostamento: ${moveResult.stderr}`);
        throw new Error(`Errore nel trasferimento del file: ${moveResult.stderr}`);
      }
      
      console.log(`File spostato con successo in ${serviceConfig.path}/${downloadedFileName}`);
    } else {
      console.warn('Nessun file MP3 trovato da spostare');
    }
    
    // Restituisci un risultato pulito senza tutti i dettagli verbosi
    return {
      code: 0,
      stdout: 'Download completato e file spostato nella destinazione finale',
      stderr: ''
    };
  } catch (error) {
    console.error('Errore download YouTube:', error);
    throw error;
  }
};

module.exports = {
  executeDownload
};