/******************************************************
 * index.js
 * Punto de entrada principal de la aplicación
 ******************************************************/
require('dotenv').config();  // Carga variables de entorno de .env

const express = require('express');
const helmet = require('helmet');
const { errorMiddleware } = require('./middleware/errorMiddleware');

// Rutas
const salesforceRoutes = require('./routes/salesforceRoutes');

const app = express();

// Middlewares globales
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Montamos las rutas bajo /api/salesforce
app.use('/api/salesforce', salesforceRoutes);

// Manejo centralizado de errores (opcional, recomendado)
app.use(errorMiddleware);

// Levantamos el servidor en el puerto definido en .env o 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor arrancado en http://localhost:${PORT}`);
});
