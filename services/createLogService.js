/******************************************************
 * services/createLogService.js
 * Guarda un log específico para la operación de alta (createOpportunity)
 ******************************************************/
const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

const LOG_FILE = path.join(LOGS_DIR, 'createOpportunity.log');

/**
 * Guarda la respuesta en createOpportunity.log
 */
function saveCreateLog(info) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    ...info
  };

  fs.appendFile(LOG_FILE, JSON.stringify(logEntry) + '\n', (err) => {
    if (err) {
      console.error('[CreateLog] Error al escribir en createOpportunity.log:', err);
    }
  });
}

module.exports = {
  saveCreateLog
};
