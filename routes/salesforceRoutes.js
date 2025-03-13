/******************************************************
 * routes/salesforceRoutes.js
 * Rutas específicas para Salesforce
 ******************************************************/
const express = require('express');
const router = express.Router();
const salesforceController = require('../controllers/salesforceController');

router.post('/duplicates', salesforceController.searchDuplicates);
router.post('/create', salesforceController.createOpportunity);

module.exports = router;
