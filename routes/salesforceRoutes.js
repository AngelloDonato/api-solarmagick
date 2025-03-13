/******************************************************
 * routes/salesforceRoutes.js
 * Rutas específicas para Salesforce
 ******************************************************/
const express = require('express');
const router = express.Router();
const salesforceController = require('../controllers/salesforceController');

// Endpoint para buscar duplicados
router.post('/duplicates', salesforceController.searchDuplicates);

// Endpoint para crear oportunidad / alta
router.post('/create', salesforceController.createOpportunity);

module.exports = router;
