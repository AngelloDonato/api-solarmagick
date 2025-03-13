/******************************************************
 * services/duplicatesService.js
 * Lógica para consultar duplicados y devolver escenario
 ******************************************************/
const axios = require('axios');
const duplicatesLogService = require('./duplicatesLogService');

// Variables de entorno
const {
  SF_TOKEN_URL,
  SF_GRANT_TYPE,
  SF_CLIENT_ID,
  SF_CLIENT_SECRET,
  SF_USERNAME,
  SF_PASSWORD,
  SF_DUPLICATES_ENDPOINT
} = process.env;

/**
 * Obtiene un token de Salesforce
 */
async function getAccessToken() {
  const params = new URLSearchParams();
  params.append('grant_type', SF_GRANT_TYPE); // password
  params.append('client_id', SF_CLIENT_ID);
  params.append('client_secret', SF_CLIENT_SECRET);
  params.append('username', SF_USERNAME);
  params.append('password', SF_PASSWORD);

  try {
    const response = await axios.post(SF_TOKEN_URL, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      timeout: 20000
    });
    return response.data.access_token;
  } catch (error) {
    console.error('[DuplicatesService] Error al obtener token:', error.response?.data || error.message);
    throw new Error('No se pudo obtener token de Salesforce para duplicados');
  }
}

/**
 * checkDuplicates
 * - Llama al endpoint de Duplicados en Salesforce
 * - Detecta escenario #1..#5
 * - Retorna un objeto con la misma estructura que en WP
 */
async function checkDuplicates(docParaDuplicados) {
  // 1) Obtener token
  const token = await getAccessToken();

  // 2) Llamar al endpoint
  const url = `${SF_DUPLICATES_ENDPOINT}?dni=${docParaDuplicados}`;
  let dupData;
  try {
    const resp = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      },
      timeout: 20000
    });
    dupData = resp.data;
  } catch (error) {
    console.error('[DuplicatesService] Error consultando duplicados:', error.response?.data || error.message);
    // Guardar log de error
    duplicatesLogService.saveDuplicatesLog({
      success: false,
      message: 'Error consultando duplicados en SF',
      error: error.message,
      docParaDuplicados
    });
    // Lanzar excepción
    throw new Error('Error consultando duplicados en Salesforce');
  }

  // 3) Detectar escenario
  const scenario = detectSfScenario(dupData);

  // 4) Extraer primer Account ID
  const accountIdCallback = extractFirstAccountId(dupData);

  // 5) Escenario #1 => Oportunidad abierta => success=false
  if (scenario === 'Opportunity_open') {
    const responseObj = {
      success: false,
      MAI_composer_type_sf: scenario,
      message: 'Ya existe un cliente con oportunidad abierta. No se puede crear.',
      sf_raw: dupData,
      MAI_accountid_callback_sf: accountIdCallback
    };
    // Log
    duplicatesLogService.saveDuplicatesLog(responseObj);
    return responseObj;
  }

  // #2..#5 => success=true
  const responseObj = {
    success: true,
    message: 'OK. No hay oportunidad abierta, puedes continuar.',
    MAI_composer_type_sf: scenario,
    MAI_accountid_callback_sf: accountIdCallback,
    sf_raw: dupData
  };
  duplicatesLogService.saveDuplicatesLog(responseObj);
  return responseObj;
}

/** 
 * detectSfScenario
 * Detecta escenario 1..5 tal como en WordPress (Opportunity_open, Opportunity_close, etc.)
 */
function detectSfScenario(dupData) {
  // A) No es array o solo 1 elemento => #5 => Client_none
  if (!Array.isArray(dupData) || dupData.length < 2) {
    return 'Client_none'; // #5
  }

  const second = dupData[1];
  const oportunidades = second['OPORTUNIDADES'] || [];
  const ubicaciones   = second['UBICACIONES'] || [];

  // B) ¿Alguna opp abierta?
  if (oportunidades.length > 0) {
    for (const opp of oportunidades) {
      const status = opp['OPP: STATUS'] || '';
      if (status !== 'Closed Won' && status !== 'Closed Lost') {
        return 'Opportunity_open'; // #1
      }
    }
    // Si llegamos aquí => todas cerradas => #2
    return 'Opportunity_close';
  }

  // C) Sin opp => #3 o #4
  if (ubicaciones.length > 0) {
    return 'Opportunity_none'; // #3
  } else {
    return 'Location_none';    // #4
  }
}

/**
 * Extraer la primera "CUENTA: ID" de dupData
 */
function extractFirstAccountId(dupData) {
  if (!Array.isArray(dupData) || dupData.length < 2) {
    return '';
  }
  for (let i = 1; i < dupData.length; i++) {
    if (dupData[i]['CUENTA: ID']) {
      return dupData[i]['CUENTA: ID'];
    }
  }
  return '';
}

module.exports = {
  checkDuplicates
};
