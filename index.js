/******************************************************
 * index.js
 * Punto de entrada principal de la aplicación
 ******************************************************/
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { errorMiddleware } = require('./middleware/errorMiddleware');
const { apiKeyMiddleware } = require('./middleware/authMiddleware');
const salesforceRoutes = require('./routes/salesforceRoutes');

const app = express();

app.use(helmet());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.MAX_REQUESTS_PER_MIN) || 1000,
  message: {
    success: false,
    message: 'Rate limit exceeded. Try again in a moment.'
  }
});
app.use(limiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(apiKeyMiddleware);

app.use('/api/salesforce', salesforceRoutes);

app.use(errorMiddleware);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor arrancado en http://localhost:${PORT}`);
});
