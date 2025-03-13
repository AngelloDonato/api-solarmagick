/******************************************************
 * services/duplicatesService.js
 * Lógica para consultar duplicados y devolver escenario
 ******************************************************/
const axios = require('axios');
const duplicatesLogService = require('./duplicatesLogService');

const {
  SF_TOKEN_URL,
  SF_GRANT_TYPE,
  SF_CLIENT_ID,
  SF_CLIENT_SECRET,
  SF_USERNAME,
  SF_PASSWORD,
  SF_DUPLICATES_ENDPOINT
} = process.env;

async function getAccessToken() {
  const params = new URLSearchParams();
  params.append('grant_type', SF_GRANT_TYPE);
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

async function checkDuplicates(docParaDuplicados) {
  const token = await getAccessToken();
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
    duplicatesLogService.saveDuplicatesLog({
      success: false,
      message: 'Error consultando duplicados en SF',
      error: error.message,
      docParaDuplicados
    });
    throw new Error('Error consultando duplicados en Salesforce');
  }

  const scenario = detectSfScenario(dupData);
  const accountIdCallback = extractFirstAccountId(dupData);

  if (scenario === 'Opportunity_open') {
    const responseObj = {
      success: false,
      MAI_composer_type_sf: scenario,
      message: 'Ya existe un cliente con oportunidad abierta. No se puede crear.',
      sf_raw: dupData,
      MAI_accountid_callback_sf: accountIdCallback
    };
    duplicatesLogService.saveDuplicatesLog(responseObj);
    return responseObj;
  }

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

function detectSfScenario(dupData) {
  if (!Array.isArray(dupData) || dupData.length < 2) {
    return 'Client_none';
  }

  const second = dupData[1];
  const oportunidades = second['OPORTUNIDADES'] || [];
  const ubicaciones   = second['UBICACIONES'] || [];

  if (oportunidades.length > 0) {
    for (const opp of oportunidades) {
      const status = opp['OPP: STATUS'] || '';
      if (status !== 'Closed Won' && status !== 'Closed Lost') {
        return 'Opportunity_open';
      }
    }
    return 'Opportunity_close';
  }

  if (ubicaciones.length > 0) {
    return 'Opportunity_none';
  } else {
    return 'Location_none';
  }
}

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
