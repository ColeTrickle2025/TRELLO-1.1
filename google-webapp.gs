/**
 * ═══════════════════════════════════════════════════════════════════════
 *  STELLANTIS RECAMBIOS — Google Apps Script Web App
 *  Recibe datos del Power-Up de Trello y los escribe en Google Sheets
 *  Versión 1.0  |  Uso interno concesionario
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  INSTALACIÓN (una sola vez):
 *  1. Abre Google Sheets → Extensiones → Apps Script
 *  2. Pega este código completo
 *  3. Menú: Implementar → Nueva implementación
 *  4. Tipo: "Aplicación web"
 *  5. Ejecutar como: "Yo (tu email)"
 *  6. Quién tiene acceso: "Cualquier persona"   ← importante
 *  7. Implementar → Copia la URL que te da
 *  8. Pega esa URL en el modal.html del Power-Up (instrucciones abajo)
 * ═══════════════════════════════════════════════════════════════════════
 */

// ── Nombre de la hoja donde se guardarán los datos ──────────────────────
var SHEET_NAME = 'Airbags';   // cámbialo si quieres otro nombre

// ── Cabeceras de la tabla (orden de las columnas) ───────────────────────
var HEADERS = [
  'Fecha/Hora',
  'Tipo Pedido',
  'Matrícula',
  'Cliente',
  'Teléfono',
  'Marca',
  'Modelo',
  'VIN/Bastidor',
  'Tipo Airbag',       // solo para plantilla airbag
  'Medida Neumático',  // solo para plantilla neumáticos
  'Cantidad',          // solo para neumáticos/general
  'Referencia',        // solo para pedido general
  'Descripción',       // solo para pedido general
  'Prioridad',
  'Pedido Por',
  'Notas',
  'Trello Card ID',
  'Lista Trello',
  'Fecha Cita',
  'Estado'
];

// ════════════════════════════════════════════════════════════════════════
//  ENDPOINT PRINCIPAL — recibe el POST del Power-Up
// ════════════════════════════════════════════════════════════════════════

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var result = appendRow(data);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, row: result }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Permite peticiones GET para verificar que el endpoint funciona
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, msg: 'Stellantis Recambios Web App activa ✅' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ════════════════════════════════════════════════════════════════════════
//  ESCRIBIR FILA EN EL SHEET
// ════════════════════════════════════════════════════════════════════════

function appendRow(data) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);

  // Crear la hoja si no existe
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    setupSheet(sheet);
  }

  // Crear cabeceras si la hoja está vacía
  if (sheet.getLastRow() === 0) {
    setupSheet(sheet);
  }

  var v = data.fields || {};
  var now = new Date().toLocaleString('es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  var prioMap = {
    'normal': '🟢 Normal',
    'urgente': '⚠️ Urgente',
    'muy-urgente': '🔴 MUY URGENTE'
  };

  var tplMap = {
    'airbag':     '🛡️ AIRBAG',
    'neumaticos': '🔄 NEUMÁTICOS',
    'general':    '📦 PEDIDO GENERAL'
  };

  var row = [
    now,
    tplMap[data.template] || data.template || '—',
    (v.matricula   || '').toUpperCase(),
    (v.cliente     || '').toUpperCase(),
    v.telefono     || '—',
    (v.marca       || '').toUpperCase(),
    (v.modelo      || '').toUpperCase(),
    (v.vin         || '').toUpperCase(),
    (v.tipo_airbag || '—').toUpperCase(),          // Airbag
    (v.medida      || '—').toUpperCase(),          // Neumáticos
    v.cantidad     || '—',                         // Neumáticos / General
    (v.referencia  || '—').toUpperCase(),          // General
    (v.descripcion || '—').toUpperCase(),          // General
    prioMap[data.priority] || data.priority || '🟢 Normal',
    (data.pedidoPor || '—').toUpperCase(),
    v.notas          || '—',
    data.trelloCardId || '—',
    (data.listName || '—').toUpperCase(),
    data.sinCita ? 'SIN CITA' : (data.fechaCita ? data.fechaCita : '—'),
    'SIN PEDIR'    // Estado inicial
  ];

  sheet.appendRow(row);

  // Formatear la última fila
  var lastRow = sheet.getLastRow();
  formatRow(sheet, lastRow, data.priority);

  return lastRow;
}

// ════════════════════════════════════════════════════════════════════════
//  FORMATEAR CABECERAS Y FILAS
// ════════════════════════════════════════════════════════════════════════

function setupSheet(sheet) {
  // Cabeceras
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  var hRange = sheet.getRange(1, 1, 1, HEADERS.length);
  hRange.setBackground('#0c1a35');
  hRange.setFontColor('#ffffff');
  hRange.setFontWeight('bold');
  hRange.setFontFamily('Arial');
  hRange.setFontSize(10);
  sheet.setFrozenRows(1);

  // Anchos de columna
  var widths = [130,120,100,160,110,100,100,160,140,120,80,120,180,120,160,200,160,160,100];
  widths.forEach(function(w, i) {
    if (i < HEADERS.length) sheet.setColumnWidth(i + 1, w);
  });

  // Desplegable en columna Estado (columna 19)
  var estadoRange = sheet.getRange(2, 19, 1000, 1);
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['SIN PEDIR','PENDIENTE','RECIBIDO','INSTALADO'], true)
    .setAllowInvalid(false)
    .build();
  estadoRange.setDataValidation(rule);
}

function formatRow(sheet, row, priority) {
  var range = sheet.getRange(row, 1, 1, HEADERS.length);

  // Color de fondo según prioridad
  var bgColor = '#ffffff';
  if (priority === 'muy-urgente') bgColor = '#fff0f0';
  if (priority === 'urgente')     bgColor = '#fffbeb';
  range.setBackground(bgColor);

  // Bordes
  range.setBorder(false, false, true, false, false, false, '#e2e8f0', SpreadsheetApp.BorderStyle.SOLID);

  // Fuente monospace para matrícula y VIN
  sheet.getRange(row, 3).setFontFamily('Courier New').setFontWeight('bold');  // Matrícula
  sheet.getRange(row, 8).setFontFamily('Courier New');                        // VIN
}

// ════════════════════════════════════════════════════════════════════════
//  FUNCIÓN DE PRUEBA — ejecutar manualmente para verificar
// ════════════════════════════════════════════════════════════════════════

function testAppend() {
  appendRow({
    template: 'airbag',
    priority: 'urgente',
    pedidoPor: 'JOAN ALVAREZ',
    trelloCardId: 'test123',
    listName: 'PEDIDOS',
    fields: {
      matricula:  '4413HYS',
      cliente:    'EZEQUIEL DIEGUEZ',
      telefono:   '615263538',
      marca:      'Fiat',
      modelo:     'Doblò',
      vin:        'ZFA31200006123456',
      tipo_airbag:'Frontal conductor',
      notas:      'Prueba de integración'
    }
  });
  Logger.log('✅ Fila de prueba añadida correctamente');
}
