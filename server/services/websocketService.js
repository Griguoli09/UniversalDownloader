/**
 * Invia un aggiornamento di stato a tutti i client connessi via WebSocket
 * @param {WebSocket.Server} wss - Server WebSocket
 * @param {object} download - Oggetto download da inviare
 */
const broadcastStatus = (wss, download) => {
    // Verifica che il server WebSocket esista
    if (!wss) return;
    
    // Crea il messaggio JSON
    const message = JSON.stringify({
      type: 'downloadUpdate',
      download
    });
    
    // Numero di client connessi
    let connectedClients = 0;
    
    // Invia a tutti i client connessi
    wss.clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
        connectedClients++;
      }
    });
    
    console.log(`Stato download inviato a ${connectedClients} client`);
  };
  
  module.exports = {
    broadcastStatus
  };