/******************************************************
 * services/createOpportunityService.js
 * Lógica para crear oportunidades (y objetos asociados)
 * Adaptado 100% del código de WordPress para "Enviar Definitiva"
 ******************************************************/
const axios = require('axios');
const createLogService = require('./createLogService');

const {
  SF_TOKEN_URL,
  SF_GRANT_TYPE,
  SF_CLIENT_ID,
  SF_CLIENT_SECRET,
  SF_USERNAME,
  SF_PASSWORD,
  SF_INSTANCE_URL
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
    console.error('[CreateOppService] Error al obtener token:', error.response?.data || error.message);
    throw new Error('No se pudo obtener token de Salesforce');
  }
}

async function createOpportunity(data) {
  const token = await getAccessToken();
  const composerType = data.MAI_composer_type_sf || '';

  if (composerType === 'Opportunity_open') {
    const responseObj = {
      success: false,
      message: 'Ya existe un cliente con oportunidad abierta. No se puede crear (scenario #1).'
    };
    createLogService.saveCreateLog(responseObj);
    return responseObj;
  }

  const compositeBody = buildCompositeBody(data, composerType);
  if (!compositeBody) {
    const responseObj = {
      success: true,
      message: 'No se procede a crear nada en Salesforce (Scenario 1).'
    };
    createLogService.saveCreateLog(responseObj);
    return responseObj;
  }

  try {
    const compositeUrl = `${SF_INSTANCE_URL}/services/data/v57.0/composite`;
    const sfResponse = await axios.post(compositeUrl, compositeBody, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    const sfData = sfResponse.data;

    if (sfData.compositeResponse && Array.isArray(sfData.compositeResponse)) {
      for (const sub of sfData.compositeResponse) {
        if (Array.isArray(sub.body) && sub.body[0]?.errorCode) {
          const { errorCode, message } = sub.body[0];
          const responseObj = {
            success: false,
            message: `Error Salesforce: ${errorCode} => ${message}`,
            compositeResponse: sfData
          };
          createLogService.saveCreateLog(responseObj);
          return responseObj;
        }
      }
    } else if (sfData.errors) {
      const responseObj = {
        success: false,
        message: 'Error global en Salesforce',
        errors: sfData.errors
      };
      createLogService.saveCreateLog(responseObj);
      return responseObj;
    }

    let opportunityId = null;
    if (sfData.compositeResponse && Array.isArray(sfData.compositeResponse)) {
      for (const item of sfData.compositeResponse) {
        if (item.referenceId === 'oportunidad' && item.body?.id) {
          opportunityId = item.body.id;
          break;
        }
      }
    }

    const responseObj = {
      success: true,
      message: 'Enviado correctamente a Salesforce',
      opportunityId,
      compositeResponse: sfData
    };
    createLogService.saveCreateLog(responseObj);
    return responseObj;
  } catch (error) {
    console.error('[CreateOppService] Error al enviar composite:', error.response?.data || error.message);
    const responseObj = {
      success: false,
      message: 'Error al enviar composite a Salesforce',
      error: error.response?.data || error.message
    };
    createLogService.saveCreateLog(responseObj);
    return responseObj;
  }
}

function buildCompositeBody(data, composerType) {
  if (!composerType || composerType === 'Opportunity_open') {
    return null;
  }

  let tipoInst = data.MAI_fld_tipoInstalacionElectrica__c || '';
  if (tipoInst.toUpperCase() === 'MONOFASICO') {
    tipoInst = 'Monofásico';
  } else if (tipoInst.toUpperCase() === 'TRIFASICO') {
    tipoInst = 'Trifásico';
  }

  const accountIdExisting = data.MAI_accountid_callback_sf || '';

  switch (composerType) {
    case 'Client_none':
      return {
        compositeRequest: [
          {
            method: 'POST',
            url: '/services/data/v57.0/sobjects/Account/',
            referenceId: 'cliente',
            body: {
              'SLR_fld_masterRecordId__c': (data.MAI_fld_masterRecordId__c || '') + (data.MAI_registroID || ''),
              'Name': data.MAI_name || 'Cliente Genérico',
              'Phone': data.MAI_phone || '',
              'SLR_fld_tipoCliente__c': data.MAI_fld_tipoCliente__c || '',
              'SLR_fld_tipoDocumento__c': data.MAI_fld_tipoDocumento__c || '',
              'SLR_fld_numeroDocumento__c': data.MAI_fld_numeroDocumento__c || '',
              'BillingCity': data.MAI_billingCity || '',
              'BillingCountryCode': data.MAI_billingCountryCode || '',
              'BillingPostalCode': data.MAI_billingPostalCode || '',
              'BillingStateCode': data.MAI_billingStateCode || '',
              'BillingStreet': data.MAI_billingStreet || '',
              'RecordType': { 'Name': 'Cliente' }
            }
          },
          {
            method: 'POST',
            url: '/services/data/v57.0/sobjects/Contact/',
            referenceId: 'contacto1',
            body: {
              'AccountId': '@{cliente.id}',
              'FirstName': data.MAI_firstName || '',
              'LastName': data.MAI_lastName || '',
              'MobilePhone': data.MAI_contactPhone || '',
              'Email': data.MAI_email || '',
              'RecordType': { 'Name': 'SLR_rt_contacto' }
            }
          },
          {
            method: 'GET',
            url: "/services/data/v57.0/query/?q=SELECT+Id+FROM+Account+WHERE+Id='@{cliente.id}'+LIMIT+1",
            referenceId: 'cliente1'
          },
          {
            method: 'GET',
            url: "/services/data/v57.0/query/?q=SELECT+Id+FROM+Contact+WHERE+Id='@{contacto1.id}'+LIMIT+1",
            referenceId: 'contacto2'
          },
          {
            method: 'GET',
            url: "/services/data/v57.0/query/?q=SELECT+Id+FROM+AccountContactRelation+WHERE+AccountId+='@{cliente.id}'+AND+ContactId+='@{contacto1.id}'+LIMIT+1",
            referenceId: 'relacion1'
          },
          {
            method: 'POST',
            url: '/services/data/v57.0/sobjects/Account/',
            referenceId: 'ubicacion',
            body: {
              'Name': data.MAI_nameUbicacion || '',
              'Phone': data.MAI_phoneUbicacion || '',
              'BillingCity': data.MAI_billingCityUbicacion || '',
              'BillingCountryCode': data.MAI_billingCountryCodeUbicacion || '',
              'BillingPostalCode': data.MAI_billingPostalCodeUbicacion || '',
              'BillingStateCode': data.MAI_billingStateCodeUbicacion || '',
              'BillingStreet': data.MAI_billingStreetUbicacion || '',
              'ParentId': '@{cliente.id}',
              'RecordType': { 'Name': 'Ubicación' }
            }
          },
          {
            method: 'POST',
            url: '/services/data/v57.0/sobjects/AccountContactRelation/',
            referenceId: 'relacion2',
            body: {
              'AccountId': '@{ubicacion.id}',
              'ContactId': '@{contacto1.id}'
            }
          },
          {
            method: 'POST',
            url: '/services/data/v57.0/sobjects/Opportunity/',
            referenceId: 'oportunidad',
            body: {
              'Name': data.MAI_opportunityName || '',
              'AccountId': '@{ubicacion.id}',
              'SLR_fld_tipoCliente__c': data.MAI_fld_tipoCliente__c || '',
              'CloseDate': data.MAI_closeDate || '',
              'SLR_fld_masterRecordId__c': 'INC|' + (data.MAI_registroID || ''),
              'SLR_fld_cliente__c': '@{cliente.id}',
              'StageName': data.MAI_stageName || '',
              'SLR_fld_distribuidor__c': data.MAI_fld_distribuidor__c || '',
              'SLR_fld_codigoDistribuidor__c': data.MAI_fld_codigoDistribuidor__c || '',
              'SLR_fld_agencia__c': data.MAI_fld_agencia__c || '',
              'SLR_fld_canal__c': data.MAI_fld_canal__c || '',
              'SLR_fld_canalOrigen__c': data.MAI_fld_canalOrigen__c || '',
              'SLR_fld_empresaOrigen__c': data.MAI_fld_empresaOrigen__c || '',
              'SLR_fld_subcanal__c': data.MAI_fld_subcanal__c || '',
              'SLR_fld_tipologiaOrigen__c': data.MAI_fld_tipologiaOrigen__c || '',
              'SLR_fld_campanya__c': data.MAI_fld_campanya__c || '',
              'SLR_fld_figuraSolar__c': data.MAI_fld_figuraSolar__c || '',
              'SLR_fld_matriculaAgente__c': data.MAI_fld_matriculaAgente__c || '',
              'SLR_fld_codigo_instalador__c': '134',
              'RecordType': { 'Name': 'Op. Instalación' }
            }
          },
          {
            method: 'GET',
            url: "/services/data/v57.0/query/?q=SELECT+Id+FROM+PriceBook2+WHERE+IsStandard=true+LIMIT+1",
            referenceId: 'catalogo'
          },
          {
            method: 'POST',
            url: '/services/data/v57.0/sobjects/Quote/',
            referenceId: 'oferta',
            body: {
              'SLR_fld_numPaneles__c': parseFloat(data.MAI_fld_numPaneles__c) || 0,
              'SLR_fld_potenciaTotal__c': parseFloat(data.MAI_fld_potenciaTotal__c) || 0,
              'SLR_fld_potenciaNominalIns__c': parseFloat(data.MAI_fld_potenciaNominalIns__c) || 0,
              'SLR_fld_capacidadBateria__c': parseFloat(data.MAI_fld_capacidadBateria__c) || 0,
              'SLR_fld_precioConIVA__c': parseFloat(data.MAI_fld_precioConIVA__c) || 0,
              'SLR_fld_tipoImpositivo__c': parseFloat(data.MAI_fld_tipoImpositivo__c) || 0,
              'SLR_fld_paybackOferta__c': parseInt(data.MAI_fld_paybackOferta__c) || 0,
              'SLR_fld_produccionAnualEstimada__c': parseFloat(data.MAI_fld_produccionAnualEstimada__c) || 0,
              'SLR_fld_tipoAutoconsumo__c': data.MAI_fld_tipoAutoconsumo__c || '',
              'SLR_fld_tipoInversor__c': data.MAI_fld_tipoInversor__c || '',
              'SLR_fld_marcaInversor__c': data.MAI_fld_marcaInversor__c || '',
              'SLR_fld_marcaPanel__c': data.MAI_fld_marcaPanel__c || '',
              'SLR_fld_potenciaNominalPanel__c': parseFloat(data.MAI_fld_potenciaNominalPanel__c) || 0,
              'SLR_fld_tipoInstalacionElectrica__c': tipoInst,
              'SLR_fld_tipoEstructura__c': data.MAI_fld_tipoEstructura__c || '',
              'OpportunityId': '@{oportunidad.id}',
              'Name': data.MAI_ofertaId || '',
              'Pricebook2Id': '@{catalogo.records[0].Id}',
              'Status': data.MAI_status || '',
              'SLR_fld_asociadoWattwin__c': false,
              'SLR_fld_comisionInstalador__c': parseFloat(data.MAI_margenBrutoComisionInstalador) || 0,
              'SLR_fld_preofertaID__c': data.MAI_ofertaId || '',
              'RecordType': { 'Name': 'Preoferta' }
            }
          }
        ]
      };

    case 'Location_none':
      return {
        'compositeRequest': [
          {
            'method': 'POST',
            'url': '/services/data/v57.0/sobjects/Contact/',
            'referenceId': 'contacto1',
            'body': {
              'AccountId': accountIdExisting || '',
              'FirstName': data.MAI_firstName || '',
              'LastName': data.MAI_lastName || '',
              'MobilePhone': data.MAI_contactPhone || '',
              'Email': data.MAI_email || '',
              'RecordType': { 'Name': 'SLR_rt_contacto' }
            }
          },
          {
            'method': 'GET',
            'url': "/services/data/v57.0/query/?q=SELECT+Id+FROM+Account+WHERE+Id='001dt0000062qgkAAA'+LIMIT+1",
            'referenceId': 'cliente1'
          },
          {
            'method': 'GET',
            'url': "/services/data/v57.0/query/?q=SELECT+Id+FROM+Contact+WHERE+Id='@{contacto1.id}'+LIMIT+1",
            'referenceId': 'contacto2'
          },
          {
            'method': 'GET',
            'url': "/services/data/v57.0/query/?q=SELECT+Id+FROM+AccountContactRelation+WHERE+AccountId+='001dt0000062qgkAAA'+AND+ContactId+='@{contacto1.id}'+LIMIT+1",
            'referenceId': 'relacion1'
          },
          {
            'method': 'POST',
            'url': '/services/data/v57.0/sobjects/Account/',
            'referenceId': 'ubicacion',
            'body': {
              'Name': data.MAI_nameUbicacion || '',
              'Phone': data.MAI_phoneUbicacion || '',
              'BillingCity': data.MAI_billingCityUbicacion || '',
              'BillingCountryCode': data.MAI_billingCountryCodeUbicacion || '',
              'BillingPostalCode': data.MAI_billingPostalCodeUbicacion || '',
              'BillingStateCode': data.MAI_billingStateCodeUbicacion || '',
              'BillingStreet': data.MAI_billingStreetUbicacion || '',
              'ParentId': accountIdExisting || '',
              'RecordType': { 'Name': 'Ubicación' }
            }
          },
          {
            'method': 'POST',
            'url': '/services/data/v57.0/sobjects/AccountContactRelation/',
            'referenceId': 'relacion2',
            'body': {
              'AccountId': '@{ubicacion.id}',
              'ContactId': '@{contacto1.id}'
            }
          },
          {
            'method': 'POST',
            'url': '/services/data/v57.0/sobjects/Opportunity/',
            'referenceId': 'oportunidad',
            'body': {
              'Name': data.MAI_opportunityName || '',
              'AccountId': '@{ubicacion.id}',
              'SLR_fld_tipoCliente__c': data.MAI_fld_tipoCliente__c || '',
              'CloseDate': data.MAI_closeDate || '',
              'SLR_fld_masterRecordId__c': 'INC|' + data.MAI_registroID,
              'SLR_fld_cliente__c': accountIdExisting || '',
              'StageName': data.MAI_stageName || '',
              'SLR_fld_distribuidor__c': data.MAI_fld_distribuidor__c || '',
              'SLR_fld_canal__c': data.MAI_fld_canal__c || '',
              'SLR_fld_canalOrigen__c': data.MAI_fld_canalOrigen__c || '',
              'SLR_fld_empresaOrigen__c': data.MAI_fld_empresaOrigen__c || '',
              'SLR_fld_subcanal__c': data.MAI_fld_subcanal__c || '',
              'SLR_fld_tipologiaOrigen__c': data.MAI_fld_tipologiaOrigen__c || '',
              'SLR_fld_campanya__c': data.MAI_fld_campanya__c || '',
              'SLR_fld_figuraSolar__c': '',
              'SLR_fld_matriculaAgente__c': '',
              'SLR_fld_codigo_instalador__c': '134',
              'RecordType': { 'Name': 'Op. Instalación' }
            }
          },
          {
            'method': 'GET',
            'url': "/services/data/v57.0/query/?q=SELECT+Id+FROM+PriceBook2+WHERE+IsStandard=true+LIMIT+1",
            'referenceId': 'catalogo'
          },
          {
            'method': 'POST',
            'url': '/services/data/v57.0/sobjects/Quote/',
            'referenceId': 'PREoferta',
            'body': {
              'SLR_fld_numPaneles__c': parseFloat(data.MAI_fld_numPaneles__c),
              'SLR_fld_potenciaTotal__c': parseFloat(data.MAI_fld_potenciaTotal__c),
              'SLR_fld_potenciaNominalIns__c': parseFloat(data.MAI_fld_potenciaNominalIns__c),
              'SLR_fld_capacidadBateria__c': parseFloat(data.MAI_fld_capacidadBateria__c),
              'SLR_fld_precioConIVA__c': parseFloat(data.MAI_fld_precioConIVA__c),
              'SLR_fld_tipoImpositivo__c': parseFloat(data.MAI_fld_tipoImpositivo__c),
              'SLR_fld_paybackOferta__c': parseInt(data.MAI_fld_paybackOferta__c),
              'SLR_fld_produccionAnualEstimada__c': parseFloat(data.MAI_fld_produccionAnualEstimada__c),
              'SLR_fld_tipoAutoconsumo__c': data.MAI_fld_tipoAutoconsumo__c,
              'SLR_fld_tipoInversor__c': data.MAI_fld_tipoInversor__c,
              'SLR_fld_marcaInversor__c': data.MAI_fld_marcaInversor__c,
              'SLR_fld_marcaPanel__c': data.MAI_fld_marcaPanel__c,
              'SLR_fld_potenciaNominalPanel__c': parseFloat(data.MAI_fld_potenciaNominalPanel__c),
              'SLR_fld_tipoInstalacionElectrica__c': tipoInst,
              'SLR_fld_tipoEstructura__c': data.MAI_fld_tipoEstructura__c,
              'OpportunityId': '@{oportunidad.id}',
              'Name': data.MAI_ofertaId,
              'Pricebook2Id': '@{catalogo.records[0].Id}',
              'Status': data.MAI_status,
              'SLR_fld_asociadoWattwin__c': false,
              'SLR_fld_comisionInstalador__c': parseFloat(data.MAI_fld_margenBrutoComisionInstalador),
              'SLR_fld_preofertaID__c': data.MAI_ofertaId,
              'RecordType': { 'Name': 'Preoferta' }
            }
          }
        ]
      };

    case 'Opportunity_close':
    case 'Opportunity_none':
      return {
        'compositeRequest': [
          {
            'method': 'POST',
            'url': '/services/data/v57.0/sobjects/Opportunity/',
            'referenceId': 'oportunidad',
            'body': {
              'Name': data.MAI_opportunityName || '',
              'AccountId': data.MAI_accountid_callback_sf || '',
              'SLR_fld_tipoCliente__c': data.MAI_fld_tipoCliente__c || '',
              'CloseDate': data.MAI_closeDate || '',
              'SLR_fld_masterRecordId__c': 'INC|' + data.MAI_registroID,
              'SLR_fld_cliente__c': data.MAI_accountid_callback_sf || '',
              'StageName': data.MAI_stageName || '',
              'SLR_fld_distribuidor__c': data.MAI_fld_distribuidor__c || '',
              'SLR_fld_codigoDistribuidor__c': data.MAI_fld_codigoDistribuidor__c || '',
              'SLR_fld_agencia__c': data.MAI_fld_agencia__c || '',
              'SLR_fld_canal__c': data.MAI_fld_canal__c || '',
              'SLR_fld_canalOrigen__c': data.MAI_fld_canalOrigen__c || '',
              'SLR_fld_empresaOrigen__c': data.MAI_fld_empresaOrigen__c || '',
              'SLR_fld_subcanal__c': data.MAI_fld_subcanal__c || '',
              'SLR_fld_tipologiaOrigen__c': data.MAI_fld_tipologiaOrigen__c || '',
              'SLR_fld_campanya__c': data.MAI_fld_campanya__c || '',
              'SLR_fld_figuraSolar__c': data.MAI_fld_figuraSolar__c || '',
              'SLR_fld_matriculaAgente__c': data.MAI_fld_matriculaAgente__c || '',
              'SLR_fld_codigo_instalador__c': '134',
              'RecordType': { 'Name': 'Op. Instalación' }
            }
          },
          {
            'method': 'GET',
            'url': "/services/data/v57.0/query/?q=SELECT+Id+FROM+PriceBook2+WHERE+IsStandard=true+LIMIT+1",
            'referenceId': 'catalogo'
          },
          {
            'method': 'POST',
            'url': '/services/data/v57.0/sobjects/Quote/',
            'referenceId': 'PREoferta',
            'body': {
              'SLR_fld_numPaneles__c': parseFloat(data.MAI_fld_numPaneles__c),
              'SLR_fld_potenciaTotal__c': parseFloat(data.MAI_fld_potenciaTotal__c),
              'SLR_fld_potenciaNominalIns__c': parseFloat(data.MAI_fld_potenciaNominalIns__c),
              'SLR_fld_capacidadBateria__c': parseFloat(data.MAI_fld_capacidadBateria__c),
              'SLR_fld_precioConIVA__c': parseFloat(data.MAI_fld_precioConIVA__c),
              'SLR_fld_tipoImpositivo__c': parseFloat(data.MAI_fld_tipoImpositivo__c),
              'SLR_fld_paybackOferta__c': parseFloat(data.MAI_fld_paybackOferta__c),
              'SLR_fld_produccionAnualEstimada__c': parseFloat(data.MAI_fld_produccionAnualEstimada__c),
              'SLR_fld_tipoAutoconsumo__c': data.MAI_fld_tipoAutoconsumo__c,
              'SLR_fld_tipoInversor__c': data.MAI_fld_tipoInversor__c,
              'SLR_fld_marcaInversor__c': data.MAI_fld_marcaInversor__c,
              'SLR_fld_marcaPanel__c': data.MAI_fld_marcaPanel__c,
              'SLR_fld_potenciaNominalPanel__c': parseFloat(data.MAI_fld_potenciaNominalPanel__c),
              'SLR_fld_tipoInstalacionElectrica__c': tipoInst,
              'SLR_fld_tipoEstructura__c': data.MAI_fld_tipoEstructura__c,
              'OpportunityId': '@{oportunidad.id}',
              'Name': data.MAI_ofertaId,
              'Pricebook2Id': '@{catalogo.records[0].Id}',
              'Status': data.MAI_status || 'Draft',
              'SLR_fld_asociadoWattwin__c': false,
              'SLR_fld_comisionInstalador__c': parseFloat(data.MAI_fld_margenBrutoComisionInstalador),
              'SLR_fld_preofertaID__c': data.MAI_ofertaId,
              'RecordType': { 'Name': 'Preoferta' }
            }
          }
        ]
      };

    default:
      return null;
  }
}

module.exports = {
  createOpportunity
};
