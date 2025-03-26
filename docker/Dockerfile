# Immagine base Node.js leggera
FROM node:18-alpine

# Mantiene la cache dei moduli attraverso le build
RUN mkdir -p /app/node_modules && chown -R node:node /app

# Directory di lavoro
WORKDIR /app

# Copia i file package.json
COPY package*.json ./

# Installa le dipendenze usando npm install invece di npm ci
RUN npm install --only=production

# Copia il resto dell'applicazione
COPY --chown=node:node . .

# Utente non-root per sicurezza
USER node

# Espone la porta del server
EXPOSE 3000

# Avvia il server
CMD ["node", "server/index.js"]