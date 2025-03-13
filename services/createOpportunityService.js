/******************************************************
 * services/createOpportunityService.js
 * Lógica para crear oportunidades (y objetos asociados)
 * Adaptado 100% del código de WordPress para "Enviar Definitiva"
 ******************************************************/
const axios = require('axios');
const createLogService = require('./createLogService');

// Variables de entorno
const {
  SF_TOKEN_URL,
  SF_GRANT_TYPE,
  SF_CLIENT_ID,
  SF_CLIENT_SECRET,
  SF_USERNAME,
  SF_PASSWORD,
  SF_INSTANCE_URL
} = process.env;

/**
 * Obtiene el token de acceso a Salesforce usando el flujo password.
 */
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

/**
 * createOpportunity
 * Recibe el payload del controlador (landbot/magick).
 * Se espera que en data se incluya el campo MAI_composer_type_sf para determinar el composite.
 */
async function createOpportunity(data) {
  // 1) Obtenemos token
  const token = await getAccessToken();

  // 2) Extraemos el scenario (composerType) enviado en MAI_composer_type_sf
  const composerType = data.MAI_composer_type_sf || '';

  // 3) Si el scenario es "Opportunity_open" no se procede a crear nada
  if (composerType === 'Opportunity_open') {
    const responseObj = {
      success: false,
      message: 'Ya existe un cliente con oportunidad abierta. No se puede crear (scenario #1).'
    };
    createLogService.saveCreateLog(responseObj);
    return responseObj;
  }

  // 4) Construimos el body del composite según el scenario recibido
  const compositeBody = buildCompositeBody(data, composerType);

  // Si buildCompositeBody retorna null, significa que no se crea nada (Scenario 1)
  if (!compositeBody) {
    const responseObj = {
      success: true,
      message: 'No se procede a crear nada en Salesforce (Scenario 1).'
    };
    createLogService.saveCreateLog(responseObj);
    return responseObj;
  }

  // 5) Enviamos el composite a Salesforce
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

    // Verificamos errores en compositeResponse
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

    // 6) Extraemos el ID de la oportunidad creada (ReferenceId "oportunidad")
    let opportunityId = null;
    if (sfData.compositeResponse && Array.isArray(sfData.compositeResponse)) {
      for (const item of sfData.compositeResponse) {
        if (item.referenceId === 'oportunidad' && item.body?.id) {
          opportunityId = item.body.id;
          break;
        }
      }
    }

    // 7) Armamos la respuesta final
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

/**
 * buildCompositeBody
 * Construye la estructura del composite a enviar a Salesforce según el scenario.
 * Se traducen los campos de WordPress (WPI_) a los enviados por Magick (MAI_).
 * Se incluyen los 10 pasos completos en el caso de "Client_none",
 * y las estructuras completas para "Location_none" y para "Opportunity_close"/"Opportunity_none".
 */
function buildCompositeBody(data, composerType) {
  // Si no se envía un composerType o es Opportunity_open, no se crea composite.
  if (!composerType || composerType === 'Opportunity_open') {
    return null;
  }

  // Se asume que los datos que se reciben en "data" tienen los siguientes nombres:
  // MAI_fld_masterRecordId__c, MAI_registroID, MAI_name, MAI_phone, MAI_fld_tipoCliente__c, MAI_fld_tipoDocumento__c, MAI_fld_numeroDocumento__c,
  // MAI_billingCity, MAI_billingCountryCode, MAI_billingPostalCode, MAI_billingStateCode, MAI_billingStreet,
  // MAI_firstName, MAI_lastName, MAI_contactPhone, MAI_email,
  // MAI_nameUbicacion, MAI_phoneUbicacion, MAI_billingCityUbicacion, MAI_billingCountryCodeUbicacion, MAI_billingPostalCodeUbicacion, MAI_billingStateCodeUbicacion, MAI_billingStreetUbicacion,
  // MAI_opportunityName, MAI_stageName, MAI_closeDate,
  // MAI_ofertaId, MAI_status,
  // y en el caso de escenarios parciales, MAI_accountid_callback_sf.
  //
  // Además, calculamos el tipo de instalación a partir de MAI_fld_tipoInstalacionElectrica__c:
  let tipoInst = data.MAI_fld_tipoInstalacionElectrica__c || '';
  if (tipoInst.toUpperCase() === 'MONOFASICO') {
    tipoInst = 'Monofásico';
  } else if (tipoInst.toUpperCase() === 'TRIFASICO') {
    tipoInst = 'Trifásico';
  }

  // Para los escenarios en los que se utiliza una cuenta existente, se espera que se reciba en MAI_accountid_callback_sf.
  const accountIdExisting = data.MAI_accountid_callback_sf || '';

  // Según el scenario recibido, se arma el composite:
  switch (composerType) {
    /************************************************
     * SCENARIO 5: Client_none => Composite completo original
     ************************************************/
    case 'Client_none':
      return {
        compositeRequest: [
          // 1) Account => "cliente"
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
          // 2) Contact => "contacto1"
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
          // 3) Query Account => "cliente1"
          {
            method: 'GET',
            url: "/services/data/v57.0/query/?q=SELECT+Id+FROM+Account+WHERE+Id='@{cliente.id}'+LIMIT+1",
            referenceId: 'cliente1'
          },
          // 4) Query Contact => "contacto2"
          {
            method: 'GET',
            url: "/services/data/v57.0/query/?q=SELECT+Id+FROM+Contact+WHERE+Id='@{contacto1.id}'+LIMIT+1",
            referenceId: 'contacto2'
          },
          // 5) Query AccountContactRelation => "relacion1"
          {
            method: 'GET',
            url: "/services/data/v57.0/query/?q=SELECT+Id+FROM+AccountContactRelation+WHERE+AccountId+='@{cliente.id}'+AND+ContactId+='@{contacto1.id}'+LIMIT+1",
            referenceId: 'relacion1'
          },
          // 6) Account => "ubicacion"
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
          // 7) AccountContactRelation => "relacion2"
          {
            method: 'POST',
            url: '/services/data/v57.0/sobjects/AccountContactRelation/',
            referenceId: 'relacion2',
            body: {
              'AccountId': '@{ubicacion.id}',
              'ContactId': '@{contacto1.id}'
            }
          },
          // 8) Opportunity => "oportunidad"
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
          // 9) Query PriceBook2 => "catalogo"
          {
            method: 'GET',
            url: "/services/data/v57.0/query/?q=SELECT+Id+FROM+PriceBook2+WHERE+IsStandard=true+LIMIT+1",
            referenceId: 'catalogo'
          },
          // 10) Quote => "oferta"
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
              'SLR_fld_tipoInstalacionElectrica__c': data.MAI_tipoInst,
              'SLR_fld_tipoEstructura__c': data.MAI_fld_tipoEstructura__c || '',
              'SLR_fld_cuotaSuscripcion__c': data.MAI_fld_cuotaSuscripcion__c,
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

       /************************************************
     * SCENARIO 4: Location_none => Composite parcial (Ubicación + Contacto + Opportunity + Quote)
     ************************************************/
       case 'Location_none':
        return {
          'compositeRequest': [
            // 1) Contact => se utiliza la cuenta existente
            {
              'method': 'POST',
              'url': '/services/data/v57.0/sobjects/Contact/',
              'referenceId': 'contacto1',
              'body': {
                'AccountId': data.MAI_accountid_callback_sf || '',
                'FirstName': data.MAI_firstName || '',
                'LastName': data.MAI_lastName || '',
                'MobilePhone': data.MAI_contactPhone || '',
                'Email': data.MAI_email || '',
                'RecordType': { 'Name': 'SLR_rt_contacto' }
              }
            },
            // 2) Query Account (consulta intermedia para ejemplo)
            {
              'method': 'GET',
              'url': "/services/data/v57.0/query/?q=SELECT+Id+FROM+Account+WHERE+Id='001dt0000062qgkAAA'+LIMIT+1",
              'referenceId': 'cliente1'
            },
            // 3) Query Contact
            {
              'method': 'GET',
              'url': "/services/data/v57.0/query/?q=SELECT+Id+FROM+Contact+WHERE+Id='@{contacto1.id}'+LIMIT+1",
              'referenceId': 'contacto2'
            },
            // 4) Query AccountContactRelation
            {
              'method': 'GET',
              'url': "/services/data/v57.0/query/?q=SELECT+Id+FROM+AccountContactRelation+WHERE+AccountId+='001dt0000062qgkAAA'+AND+ContactId+='@{contacto1.id}'+LIMIT+1",
              'referenceId': 'relacion1'
            },
            // 5) Crear Ubicación
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
                'ParentId': data.MAI_accountid_callback_sf || '',
                'RecordType': { 'Name': 'Ubicación' }
              }
            },
            // 6) AccountContactRelation => Ubicación
            {
              'method': 'POST',
              'url': '/services/data/v57.0/sobjects/AccountContactRelation/',
              'referenceId': 'relacion2',
              'body': {
                'AccountId': '@{ubicacion.id}',
                'ContactId': '@{contacto1.id}'
              }
            },
            // 7) Opportunity => "oportunidad"
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
                'SLR_fld_cliente__c': data.MAI_accountid_callback_sf || '',
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
            // 8) Query PriceBook2 => "catalogo"
            {
              'method': 'GET',
              'url': "/services/data/v57.0/query/?q=SELECT+Id+FROM+PriceBook2+WHERE+IsStandard=true+LIMIT+1",
              'referenceId': 'catalogo'
            },
            // 9) Quote => "PREoferta"
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
                'SLR_fld_tipoInstalacionElectrica__c': data.MAI_tipoInst, // valor ya procesado (ej. "Monofásico" o "Trifásico")
                'SLR_fld_tipoEstructura__c': data.MAI_fld_tipoEstructura__c,
                'SLR_fld_cuotaSuscripcion__c': data.MAI_fld_cuotaSuscripcion__c,
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

    /************************************************
     * SCENARIOS 2 y 3: Opportunity_close / Opportunity_none => Composite solo para Opportunity y Quote
     ************************************************/
    case 'Opportunity_close':
    case 'Opportunity_none':
      return {
        'compositeRequest': [
          // Opportunity
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
          // Query PriceBook2 => "catalogo"
          {
            'method': 'GET',
            'url': "/services/data/v57.0/query/?q=SELECT+Id+FROM+PriceBook2+WHERE+IsStandard=true+LIMIT+1",
            'referenceId': 'catalogo'
          },
          // Quote
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
              'SLR_fld_tipoInstalacionElectrica__c': data.MAI_tipoInst,
              'SLR_fld_tipoEstructura__c': data.MAI_fld_tipoEstructura__c,
              'SLR_fld_cuotaSuscripcion__c': data.MAI_fld_cuotaSuscripcion__c,
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


    /************************************************
     * SCENARIO 1: Opportunity_open => No se crea composite
     ************************************************/
    default:
      return null;
  }
}

module.exports = {
  createOpportunity
};
