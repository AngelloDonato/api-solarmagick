Aquí tienes el **README.md** final, más detallado y con el nuevo ejemplo para la creación de oportunidades. Se han omitido comentarios muy internos, manteniendo el enfoque claro y conciso:

---

# API SolarMagick

La **API SolarMagick** integra **Magick** y **Landbot** con **Salesforce** para:
1. **Buscar duplicados** en Salesforce con base en DNI/CIF.
2. **Crear oportunidades** (y objetos relacionados) en Salesforce mediante la **Composite API**.

## Estructura de Archivos

```
API SolarMagick/
├─ node_modules/                  // Se genera automáticamente al instalar dependencias
├─ logs/                          // Carpeta donde se guardan archivos de logs
├─ services/
│   ├─ duplicatesService.js       // Lógica para consultar duplicados
│   ├─ duplicatesLogService.js    // Log específico de duplicados
│   ├─ createOpportunityService.js// Lógica para crear oportunidades
│   ├─ createLogService.js        // Log específico de alta de oportunidades
├─ controllers/
│   └─ salesforceController.js    // Coordina duplicados y alta
├─ routes/
│   └─ salesforceRoutes.js        // Endpoints /duplicates y /create
├─ middleware/
│   ├─ authMiddleware.js          // Verifica dos API Keys (Magick y Landbot)
│   └─ errorMiddleware.js         // Manejo de errores global
├─ .env.example                   // Ejemplo de variables de entorno
├─ .gitignore
├─ index.js                       // Punto de entrada principal (levanta la app)
├─ package.json
└─ README.md                      // Documentación (este archivo)
```

## 1. Requisitos

- **Node.js** v14 o superior.
- **npm** (o yarn).
- **Credenciales** de Salesforce (usuario con permisos para crear / consultar duplicados y oportunidades).

## 2. Instalación y Configuración

1. **Clonar el proyecto**  
   ```bash
   git clone https://github.com/tuorg/api-solarmagick.git
   cd api-solarmagick
   ```
2. **Instalar dependencias**  
   ```bash
   npm install
   ```
3. **Configurar variables de entorno**  
   - Crea un archivo `.env` en la raíz del proyecto y define:
     ```dotenv
     PORT=3000
     SF_TOKEN_URL=...
     SF_USERNAME=...
     SF_PASSWORD="..."
     SF_INSTANCE_URL=...
     SF_DUPLICATES_ENDPOINT=...
     SF_COMPOSITE_ENDPOINT=...
     MAGICK_API_KEY=...
     LANDBOT_API_KEY=...
     MAX_REQUESTS_PER_MIN=1000
     ```
   - Ajusta los valores a tu entorno (sandbox / producción).

4. **Ejecutar**  
   ```bash
   node index.js
   ```
   El servidor escuchará en `http://localhost:3000` (o el puerto definido en `.env`).

## 3. Endpoints

### A) `/api/salesforce/duplicates` (POST)

**Objetivo**: consultar duplicados en Salesforce dado un DNI/CIF.

- **Cuerpo (JSON)**:
  ```json
  {
    "numDocumento": "C05646900"
  }
  ```
  o
  ```json
  {
    "cif": "B12345678"
  }
  ```
- **Respuesta** (ejemplo):
  ```json
  {
    "success": true,
    "message": "OK. No hay oportunidad abierta, puedes continuar.",
    "MAI_composer_type_sf": "Opportunity_none",
    "MAI_accountid_callback_sf": "001XXXXXXXXXX",
    "sf_raw": [...]
  }
  ```
- **API Key**: Enviar en la cabecera `x-api-key` o en la query ?api_key=...

### B) `/api/salesforce/create` (POST)

**Objetivo**: crear una oportunidad (y demás objetos) en Salesforce según el escenario indicado.

- **Body (JSON)**:
  ```json
  {
    "MAI_composer_type_sf": "Client_none",
  
    "MAI_fld_masterRecordId__c": "12345678ALOCALTESTC3",
    "MAI_name": "Cliente Demo",
    "MAI_fld_tipoCliente__c": "RES",
    "MAI_fld_tipoDocumento__c": "DNI",
    "MAI_fld_numeroDocumento__c": "12345678ALOCAL",
    "MAI_billingCity": "Madrid",
    "MAI_billingCountryCode": "ES",
    "MAI_billingPostalCode": "28001",
    "MAI_billingStateCode": "28",
    "MAI_billingStreet": "Calle Mayor 1",
  
    "MAI_firstName": "Carlos",
    "MAI_lastName": "Pérez",
    "MAI_phone": "600123456",
    "MAI_contactPhone": "600654321",
    "MAI_email": "carlos@example.com",
  
    "MAI_nameUbicacion": "Oficina Central",
    "MAI_phoneUbicacion": "911223344",
    "MAI_billingCityUbicacion": "Madrid",
    "MAI_billingCountryCodeUbicacion": "ES",
    "MAI_billingPostalCodeUbicacion": "28002",
    "MAI_billingStateCodeUbicacion": "28",
    "MAI_billingStreetUbicacion": "Calle Sol 2",
  
    "MAI_opportunityName": "Oportunidad Solar Demo",
    "MAI_stageName": "Generación Oferta",
    "MAI_closeDate": "2026-12-31",
    "MAI_fld_empresaOrigen__c": "SLR",
    "MAI_fld_canal__c": "PRE",
    "MAI_fld_canalOrigen__c": "VALOR",
    "MAI_fld_subcanal__c": "TIENDA",
    "MAI_fld_tipologiaOrigen__c": "EXTERNO",
    "MAI_fld_distribuidor__c": "VALOR",
    "MAI_fld_codigoDistribuidor__c": "VALOR",
    "MAI_fld_agencia__c": "VALOR",
    "MAI_fld_figuraSolar__c": "Project Manager",
    "MAI_fld_matriculaAgente__c": "VALOR",
  
    "MAI_fld_numPaneles__c": "4",
    "MAI_fld_potenciaTotal__c": "10",
    "MAI_fld_potenciaNominalIns__c": "40",
    "MAI_fld_capacidadBateria__c": "50",
    "MAI_fld_precioConIVA__c": "40000",
    "MAI_fld_tipoImpositivo__c": "2",
    "MAI_fld_paybackOferta__c": "5",
    "MAI_fld_produccionAnualEstimada__c": "2000",
    "MAI_fld_tipoAutoconsumo__c": "IND",
    "MAI_fld_tipoInversor__c": "Microinversor",
    "MAI_fld_marcaInversor__c": "marcainversor",
    "MAI_fld_marcaPanel__c": "marcapanel",
    "MAI_fld_potenciaNominalPanel__c": "50",
    "MAI_fld_tipoInstalacionElectrica__c": "MONOFÁSICO",
    "MAI_fld_tipoEstructura__c": "COPLA",
    "MAI_ofertaId": "OFERTA789",
    "MAI_status": "6a",
    "MAI_margenBrutoComisionInstalador": "50"
  }
  ```
- **Respuesta** (ejemplo):
  ```json
  {
    "success": true,
    "message": "Enviado correctamente a Salesforce",
    "opportunityId": "006XXXXXXXXXX",
    "compositeResponse": { ... }
  }
  ```
- **API Key**: igual que en el endpoint de duplicados.

## 4. Autenticación

Se usan **dos** API Keys, definidas en `.env`:
- `MAGICK_API_KEY`
- `LANDBOT_API_KEY`

Cada servicio (Magick o Landbot) utiliza su propia clave, enviada en la cabecera `x-api-key` o en la query `?api_key=...`.

## 5. Logs

- **logs/duplicates.log**: Información de cada consulta de duplicados.
- **logs/createOpportunity.log**: Registro de cada creación de oportunidad.

## 6. Rate Limiting

El proyecto utiliza `express-rate-limit`. La variable `MAX_REQUESTS_PER_MIN` define cuántos requests se permiten por minuto desde la misma IP. Al superarlo, la API responde con:

```json
{
  "success": false,
  "message": "Rate limit exceeded. Try again in a moment."
}
```

## 7. Despliegue

1. **Variables de entorno**: Ajusta tus credenciales de Salesforce y API Keys en `.env`.
2. **HTTPS**: Para entorno productivo, se recomienda usar un balanceador o servidor con certificado SSL.
3. **PM2 u otro**: Si deseas un gestor de procesos, puedes usar [PM2](https://pm2.keymetrics.io/):
   ```bash
   pm2 start index.js --name "solar-magick-api"
   ```

## 8. Uso en Postman

Ejemplo:  
- **Endpoint**: `POST http://localhost:3000/api/salesforce/duplicates`
- **Headers**:
  ```
  x-api-key: <TU_API_KEY>
  Content-Type: application/json
  ```
- **Body**:
  ```json
  {
    "numDocumento": "C05646900"
  }
  ```

## 9. Contribuir

1. **Crear rama**:
   ```bash
   git checkout -b feature/nueva-funcionalidad
   ```
2. **Editar** y hacer commit.
3. **Pull request** para revisar y fusionar cambios.

## 10. FAQ

**¿Puedo unificar las dos API Keys en una sola?**  
Sí, pero así se pierde la separación entre Magick y Landbot.

**¿Cómo cambio a producción?**  
Modifica las URLs de Salesforce (`SF_INSTANCE_URL`, etc.) en `.env` y usa credenciales de producción.

**¿Cómo agrego validaciones de campos?**  
Puedes usar [express-validator](https://www.npmjs.com/package/express-validator) o Joi para validar el body antes de llamar a Salesforce.

---

¡Listo! Con estos pasos, tu equipo podrá entender y usar la **API SolarMagick** de manera segura y clara.