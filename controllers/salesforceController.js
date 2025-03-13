/******************************************************
 * controllers/salesforceController.js
 * Controlador: orquesta la lógica de duplicados y alta
 ******************************************************/
const duplicatesService = require('../services/duplicatesService');
const createOpportunityService = require('../services/createOpportunityService');

/**
 * POST /api/salesforce/duplicates
 * Recibe un JSON con { numDocumento, cif } o similares.
 * Retorna la detección de duplicados: escenario #1..#5, etc.
 */
exports.searchDuplicates = async (req, res) => {
  try {
    const { numDocumento, cif } = req.body || {};

    // 1. Determinamos qué documento usar: numDocumento o cif
    const docParaDuplicados = (numDocumento || cif || '').trim();
    if (!docParaDuplicados) {
      return res.status(400).json({
        success: false,
        message: 'Falta DNI/CIF para verificar duplicados.'
      });
    }

    // 2. Llamar a duplicatesService para obtener escenario y accountId
    const responseData = await duplicatesService.checkDuplicates(docParaDuplicados);

    // 3. Devolvemos la respuesta a Landbot/Magick (en el mismo formato que WP)
    //    Ejemplo: { success, WPI_composer_type_sf, message, sf_raw, WPI_accountid_callback_sf }
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

/**
 * POST /api/salesforce/create
 * Crea la Oportunidad (y otros objetos) en Salesforce según scenario (WPI_composer_type_sf).
 * El equipo Landbot/Magick nos enviará el campo "MAI_composer_type_sf" (u otro) con el escenario.
 */
exports.createOpportunity = async (req, res) => {
  try {
    // Todo el body que nos manda Landbot/Magick
    const data = req.body;

    // Llamamos al servicio que implementa la lógica de composites
    const responseData = await createOpportunityService.createOpportunity(data);

    // Retornamos la respuesta
    // Ejemplo: { success: true, message: '...', response: sfData }
    if (responseData.success) {
      return res.status(200).json(responseData);
    } else {
      // Si hubo error en Salesforce o algo así
      return res.status(200).json(responseData); 
      // O 4xx/5xx según la preferencia, pero en WP se usaba 200
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
