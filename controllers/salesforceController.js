/******************************************************
 * controllers/salesforceController.js
 * Controlador: orquesta la lógica de duplicados y alta
 ******************************************************/
const duplicatesService = require('../services/duplicatesService');
const createOpportunityService = require('../services/createOpportunityService');

exports.searchDuplicates = async (req, res) => {
  try {
    const { numDocumento, cif } = req.body || {};
    const docParaDuplicados = (numDocumento || cif || '').trim();

    if (!docParaDuplicados) {
      return res.status(400).json({
        success: false,
        message: 'Falta DNI/CIF para verificar duplicados.'
      });
    }

    const responseData = await duplicatesService.checkDuplicates(docParaDuplicados);
    return res.status(200).json(responseData);
  } catch (error) {
    console.error('Error en searchDuplicates:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno al buscar duplicados',
      error: error.message
    });
  }
};

exports.createOpportunity = async (req, res) => {
  try {
    const data = req.body;
    const responseData = await createOpportunityService.createOpportunity(data);

    if (responseData.success) {
      return res.status(200).json(responseData);
    } else {
      return res.status(200).json(responseData);
    }
  } catch (error) {
    console.error('Error en createOpportunity:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno al crear oportunidad',
      error: error.message
    });
  }
};
