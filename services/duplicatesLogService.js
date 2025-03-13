/******************************************************
 * services/duplicatesLogService.js
 * Guarda un log específico para la operación de duplicados
 ******************************************************/
const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

const LOG_FILE = path.join(LOGS_DIR, 'duplicates.log');

/**
 * saveDuplicatesLog
 * @param {object} info - El objeto de respuesta a loguear
 */
function saveDuplicatesLog(info) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    ...info
  };

  fs.appendFile(LOG_FILE, JSON.stringify(logEntry) + '\n', (err) => {
    if (err) {
      console.error('[DuplicatesLog] Error al escribir en duplicates.log:', err);
    }
  });
}

module.exports = {
  saveDuplicatesLog
};
