/******************************************************
 * index.js
 * Punto de entrada principal de la aplicación
 ******************************************************/
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Middlewares
const { errorMiddleware } = require('./middleware/errorMiddleware');
const { apiKeyMiddleware } = require('./middleware/authMiddleware');

// Rutas
const salesforceRoutes = require('./routes/salesforceRoutes');

const app = express();

// 1. Seguridad HTTP
app.use(helmet());

// 2. Rate Limit
const limiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minuto
  max: parseInt(process.env.MAX_REQUESTS_PER_MIN) || 1000,
  message: {
    success: false,
    message: 'Rate limit exceeded. Try again in a moment.'
  }
});
app.use(limiter);

// 3. Parsear cuerpo JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. Autenticación vía 2 API Keys (Magick / Landbot)
app.use(apiKeyMiddleware);

// 5. Rutas
app.use('/api/salesforce', salesforceRoutes);

// 6. Manejo de errores
app.use(errorMiddleware);

// 7. Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor arrancado en http://localhost:${PORT}`);
});
