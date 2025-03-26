const { NodeSSH } = require('node-ssh');
const { loadConfig } = require('../config');

// Carica la configurazione
const config = loadConfig();

// Istanza SSH per la connessione al Raspberry Pi
const ssh = new NodeSSH();

/**
 * Connette al Raspberry Pi tramite SSH
 * @returns {Promise<NodeSSH>} - Istanza SSH connessa
 */
const connectToRaspberryPi = async () => {
  try {
    // Se già connesso, riusa la connessione
    if (ssh.isConnected()) {
      return ssh;
    }
    
    // Opzioni di connessione base
    const connectionOptions = {
      host: config.raspberryPiHost,
      username: config.raspberryPiUser
    };
    
    // Aggiungi metodo di autenticazione (password o chiave)
    if (config.raspberryPiPassword) {
      connectionOptions.password = config.raspberryPiPassword;
    } else if (config.raspberryPiKey) {
      connectionOptions.privateKey = config.raspberryPiKey;
    } else {
      throw new Error('Nessun metodo di autenticazione fornito per SSH');
    }
    
    // Connessione SSH
    await ssh.connect(connectionOptions);
    console.log('Connesso al Raspberry Pi');
    return ssh;
  } catch (error) {
    console.error('Errore connessione SSH:', error);
    throw new Error(`Errore connessione SSH: ${error.message}`);
  }
};

/**
 * Sposta i file scaricati nella cartella di destinazione
 * @param {string} sourceDir - Directory di origine
 * @param {string} targetDir - Directory di destinazione
 * @param {string} filePattern - Pattern per identificare i file da spostare
 * @returns {Promise<string[]>} - Lista di file spostati
 */
const moveDownloadedFiles = async (sourceDir, targetDir, filePattern = '*.mp3') => {
  try {
    console.log(`Creazione directory target se non esiste: ${targetDir}`);
    // Crea directory di destinazione se non esiste
    await ssh.execCommand(`mkdir -p "${targetDir}"`, { cwd: '/' });
    
    // Attendi 3 secondi per permettere al file di essere completamente scritto
    console.log(`Attesa di 3 secondi per il completamento dei file...`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Trova i file che corrispondono al pattern
    console.log(`Ricerca di file '${filePattern}' in ${sourceDir} modificati nell'ultimo minuto`);
    const findResult = await ssh.execCommand(`find "${sourceDir}" -name "${filePattern}" -type f -mmin -1`, { cwd: '/' });
    
    if (findResult.stderr) {
      console.error('Errore trovando i file:', findResult.stderr);
    }
    
    const fileList = findResult.stdout.trim().split('\n').filter(Boolean);
    console.log('File trovati da spostare:', fileList);
    
    if (fileList.length === 0) {
      // Proviamo una ricerca più ampia se non troviamo nulla
      console.log('Nessun file trovato. Tentativo con ricerca più ampia...');
      const findAllResult = await ssh.execCommand(`find "${sourceDir}" -name "${filePattern}" -type f`, { cwd: '/' });
      const allFiles = findAllResult.stdout.trim().split('\n').filter(Boolean);
      console.log('Tutti i file trovati:', allFiles);
      
      if (allFiles.length === 0) {
        console.warn('Nessun file trovato da spostare, anche con ricerca estesa');
        return [];
      }
      
      // Usa tutti i file trovati se nessuno è stato modificato nell'ultimo minuto
      console.log('Utilizzo di tutti i file trovati');
      fileList.push(...allFiles);
    }
    
    // Sposta ogni file trovato
    const movedFiles = [];
    for (const file of fileList) {
      const filename = file.split('/').pop();
      // Utilizziamo sudo per assicurarci di avere i permessi necessari
      const moveCommand = `sudo cp "${file}" "${targetDir}/${filename}" && sudo rm "${file}"`;
      
      console.log(`Esecuzione comando di spostamento: ${moveCommand}`);
      const moveResult = await ssh.execCommand(moveCommand, { cwd: '/' });
      
      if (moveResult.stderr && !moveResult.stderr.includes('sudo: command not found')) {
        console.error(`Errore spostando ${file}:`, moveResult.stderr);
        
        // Fallback: prova senza sudo
        if (moveResult.stderr.includes('sudo: command not found')) {
          console.log('Sudo non disponibile, tentativo senza sudo');
          const fallbackMoveCommand = `cp "${file}" "${targetDir}/${filename}" && rm "${file}"`;
          const fallbackResult = await ssh.execCommand(fallbackMoveCommand, { cwd: '/' });
          
          if (fallbackResult.stderr) {
            console.error(`Errore fallback spostando ${file}:`, fallbackResult.stderr);
          } else {
            console.log(`File spostato con successo (fallback): ${file} -> ${targetDir}/${filename}`);
            movedFiles.push(`${targetDir}/${filename}`);
          }
        }
      } else {
        console.log(`File spostato con successo: ${file} -> ${targetDir}/${filename}`);
        movedFiles.push(`${targetDir}/${filename}`);
      }
    }
    
    return movedFiles;
  } catch (error) {
    console.error('Errore durante lo spostamento dei file:', error);
    throw new Error(`Errore spostamento file: ${error.message}`);
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
  try {
    // Connetti al Raspberry Pi
    const ssh = await connectToRaspberryPi();
    
    // Ottieni configurazione specifica per il servizio
    if (!config.commands[serviceType]) {
      throw new Error(`Servizio non supportato: ${serviceType}`);
    }
    
    const serviceConfig = config.commands[serviceType];
    console.log(`Usando configurazione per ${serviceType}:`, serviceConfig);
    
    // Prepara il comando per il download (senza virgolette)
    const command = `${serviceConfig.download} ${url}`;
    
    console.log(`Esecuzione comando per ${serviceType}: ${command}`);
    console.log(`Directory di lavoro: ${serviceConfig.path}`);
    
    // Esegui il comando remoto
    const result = await ssh.execCommand(command, {
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
    
    // Se necessario, sposta i file scaricati
    if (serviceConfig.moveFiles) {
      console.log(`Spostamento file richiesto per ${serviceType}`);
      const currentDir = process.cwd(); // Directory corrente
      const targetDir = serviceConfig.path;
      
      try {
        console.log(`Tentativo di spostare i file da "${currentDir}" a "${targetDir}"`);
        const movedFiles = await moveDownloadedFiles(currentDir, targetDir);
        console.log('File spostati:', movedFiles);
      } catch (moveError) {
        console.error('Errore durante lo spostamento dei file:', moveError);
        // Non facciamo fallire il download se lo spostamento fallisce
      }
    } else {
      console.log(`Nessuno spostamento file necessario per ${serviceType}`);
    }
    
    return result;
  } catch (error) {
    console.error('Errore esecuzione download:', error);
    throw error;
  }
};

module.exports = {
  executeDownload
};