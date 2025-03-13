/******************************************************
 * middleware/authMiddleware.js
 * Verifica la presencia de dos API Keys: Magick y Landbot
 ******************************************************/
require('dotenv').config();

function apiKeyMiddleware(req, res, next) {
  const apiKeySent = req.headers['x-api-key'] || req.query.api_key;
  if (!apiKeySent) {
    return res.status(401).json({
      success: false,
      message: 'API Key is required'
    });
  }

  const magickKey = process.env.MAGICK_API_KEY;
  const landbotKey = process.env.LANDBOT_API_KEY;

  if (apiKeySent !== magickKey && apiKeySent !== landbotKey) {
    return res.status(403).json({
      success: false,
      message: 'Invalid API Key'
    });
  }

  next();
}

module.exports = {
  apiKeyMiddleware
};
