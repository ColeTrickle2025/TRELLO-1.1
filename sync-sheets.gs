/**
 * ═══════════════════════════════════════════════════════════════════════
 *  STELLANTIS RECAMBIOS — Sincronización Google Sheets ↔ Trello
 *  Google Apps Script  |  Uso interno concesionario
 *  Versión 1.0
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  INSTALACIÓN (5 pasos):
 *  1. Abre tu Google Sheet → Extensiones → Apps Script
 *  2. Borra el código de ejemplo y pega todo este archivo
 *  3. Rellena la sección ⚙️ CONFIGURACIÓN con tus datos
 *  4. Ejecuta la función  createHeaders()  una sola vez para preparar la hoja
 *  5. Ejecuta la función  setup()  una sola vez para activar los triggers
 *  6. Autoriza los permisos que pide Google → ¡listo!
 *
 *  ESTRUCTURA DE LA HOJA:
 *  Col A: Matrícula       Col B: Cliente         Col C: Teléfono
 *  Col D: Marca           Col E: Modelo          Col F: VIN/Bastidor
 *  Col G: Estado  ← CLAVE (Sin Pedir / Pendiente / Recibido / Instalado)
 *  Col H: Fecha Cita      Col I: Notas
 *  Col J: Trello Card ID  ← se rellena automáticamente, no tocar
 *  Col K: Última Sincronización
 *
 *  COMPORTAMIENTO:
 *  · Cambias Estado en columna G → tarjeta se mueve en Trello al instante
 *  · Añades fila nueva sin ID    → se crea tarjeta nueva en Trello
 *  · Editas datos de una fila    → se actualiza la descripción de la tarjeta
 *  · Cada noche a las 2:00 AM    → sincronización completa de toda la hoja
 * ═══════════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────────────────
//  ⚙️  CONFIGURACIÓN — EDITA ESTOS VALORES
// ─────────────────────────────────────────────────────────────────────────

var CONFIG = {

  // Credenciales Trello → obtenerlas en trello.com/app-key
  TRELLO_API_KEY : 'PON_AQUÍ_TU_API_KEY',
  TRELLO_TOKEN   : 'PON_AQUÍ_TU_TOKEN',

  // IDs de las listas de tu tablero Trello
  // Cómo obtenerlos: ejecuta printListIds('ID_DE_TU_TABLERO') y mira el Log
  // El ID del tablero está en la URL: trello.com/b/BOARD_ID/nombre-tablero
  TRELLO_LISTS: {
    'Sin Pedir' : 'ID_LISTA_SIN_PEDIR',
    'Pendiente' : 'ID_LISTA_PENDIENTE',
    'Recibido'  : 'ID_LISTA_RECIBIDO',
    'Instalado' : 'ID_LISTA_INSTALADO',
  },

  // Nombre exacto de la hoja dentro del archivo Google Sheets
  SHEET_NAME: 'Airbags',   // cámbialo si tu hoja se llama diferente

  // Columnas (base 1: A=1, B=2, C=3...)
  COL_MATRICULA  : 1,   // A
  COL_CLIENTE    : 2,   // B
  COL_TELEFONO   : 3,   // C
  COL_MARCA      : 4,   // D
  COL_MODELO     : 5,   // E
  COL_VIN        : 6,   // F
  COL_ESTADO     : 7,   // G  ← trigger principal
  COL_FECHA_CITA : 8,   // H
  COL_NOTAS      : 9,   // I
  COL_TRELLO_ID  : 10,  // J  ← no editar manualmente
  COL_SYNC_DATE  : 11,  // K

  // Primera fila de datos (normalmente 2, saltando la cabecera)
  FIRST_DATA_ROW : 2,
};

// ─────────────────────────────────────────────────────────────────────────
//  🔔  TRIGGER PRINCIPAL — se dispara automáticamente al editar la hoja
// ─────────────────────────────────────────────────────────────────────────

function onEdit(e) {
  var sheet = e.source.getActiveSheet();

  // Solo actuar en la hoja configurada
  if (sheet.getName() !== CONFIG.SHEET_NAME) return;

  var row = e.range.getRow();
  var col = e.range.getColumn();

  // Ignorar la fila de cabecera
  if (row < CONFIG.FIRST_DATA_ROW) return;

  // Cambio en columna Estado (G) → mover tarjeta en Trello
  if (col === CONFIG.COL_ESTADO) {
    try {
      syncRowToTrello(sheet, row);
    } catch (err) {
      Logger.log('❌ Error syncRowToTrello fila ' + row + ': ' + err.message);
    }
    return;
  }

  // Cambio en cualquier columna de datos → actualizar descripción
  var dataCols = [
    CONFIG.COL_MATRICULA, CONFIG.COL_CLIENTE, CONFIG.COL_TELEFONO,
    CONFIG.COL_MARCA, CONFIG.COL_MODELO, CONFIG.COL_VIN,
    CONFIG.COL_FECHA_CITA, CONFIG.COL_NOTAS
  ];
  if (dataCols.indexOf(col) !== -1) {
    try {
      var trelloId = sheet.getRange(row, CONFIG.COL_TRELLO_ID).getValue();
      if (trelloId) {
        updateCardDescription(sheet, row, trelloId);
        sheet.getRange(row, CONFIG.COL_SYNC_DATE).setValue(new Date().toLocaleString('es-ES'));
      }
    } catch (err) {
      Logger.log('❌ Error actualizando descripción fila ' + row + ': ' + err.message);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
//  🔄  SINCRONIZAR UNA FILA → TRELLO
// ─────────────────────────────────────────────────────────────────────────

function syncRowToTrello(sheet, row) {
  var matricula = getCellValue(sheet, row, CONFIG.COL_MATRICULA);
  var cliente   = getCellValue(sheet, row, CONFIG.COL_CLIENTE);
  var estado    = getCellValue(sheet, row, CONFIG.COL_ESTADO) || 'Sin Pedir';
  var trelloId  = getCellValue(sheet, row, CONFIG.COL_TRELLO_ID);
  var listId    = CONFIG.TRELLO_LISTS[estado];

  if (!matricula) return;  // fila vacía

  if (!trelloId) {
    // ── Crear tarjeta nueva ──────────────────────────────────────────
    var targetList = listId || CONFIG.TRELLO_LISTS['Sin Pedir'];
    if (!targetList || targetList.indexOf('ID_') === 0) {
      Logger.log('⚠️ Lista no configurada para estado: ' + estado);
      return;
    }
    var card = createTrelloCard(sheet, row, targetList);
    if (card && card.id) {
      sheet.getRange(row, CONFIG.COL_TRELLO_ID).setValue(card.id);
      sheet.getRange(row, CONFIG.COL_SYNC_DATE).setValue(new Date().toLocaleString('es-ES'));
      Logger.log('✅ Tarjeta creada: ' + card.id + ' · ' + matricula);
    }
  } else {
    // ── Actualizar tarjeta existente (mover + descripción) ───────────
    var updates = {};
    if (listId && listId.indexOf('ID_') !== 0) {
      updates.idList = listId;
    }
    updates.desc = buildCardDescription(sheet, row);
    trelloRequest('PUT', '/cards/' + trelloId, updates);
    sheet.getRange(row, CONFIG.COL_SYNC_DATE).setValue(new Date().toLocaleString('es-ES'));
    Logger.log('✅ Tarjeta actualizada: ' + trelloId + ' → ' + estado);
  }
}

// ─────────────────────────────────────────────────────────────────────────
//  📦  SINCRONIZACIÓN MASIVA — ejecutar manualmente o de forma programada
// ─────────────────────────────────────────────────────────────────────────

function syncAll() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) { Logger.log('❌ Hoja "' + CONFIG.SHEET_NAME + '" no encontrada'); return; }

  var lastRow = sheet.getLastRow();
  var synced = 0, errors = 0;

  for (var row = CONFIG.FIRST_DATA_ROW; row <= lastRow; row++) {
    var matricula = getCellValue(sheet, row, CONFIG.COL_MATRICULA);
    if (!matricula) continue;
    try {
      syncRowToTrello(sheet, row);
      synced++;
      Utilities.sleep(250);  // respetar rate limit de Trello (máx 10 req/seg)
    } catch (err) {
      errors++;
      Logger.log('❌ Error fila ' + row + ': ' + err.message);
    }
  }
  Logger.log('─── Sync completo: ' + synced + ' filas · ' + errors + ' errores ───');
}

// ─────────────────────────────────────────────────────────────────────────
//  🌐  FUNCIONES DE API TRELLO
// ─────────────────────────────────────────────────────────────────────────

function trelloRequest(method, path, payload) {
  var url = 'https://api.trello.com/1' + path
    + '?key=' + CONFIG.TRELLO_API_KEY
    + '&token=' + CONFIG.TRELLO_TOKEN;

  var options = {
    method           : method,
    contentType      : 'application/json',
    muteHttpExceptions: true,
  };
  if (payload) options.payload = JSON.stringify(payload);

  var resp = UrlFetchApp.fetch(url, options);
  var code = resp.getResponseCode();

  if (code < 200 || code >= 300) {
    throw new Error('Trello API ' + code + ': ' + resp.getContentText().substring(0, 200));
  }
  return JSON.parse(resp.getContentText());
}

function createTrelloCard(sheet, row, idList) {
  var matricula = getCellValue(sheet, row, CONFIG.COL_MATRICULA);
  var cliente   = getCellValue(sheet, row, CONFIG.COL_CLIENTE);
  var marca     = getCellValue(sheet, row, CONFIG.COL_MARCA);
  var modelo    = getCellValue(sheet, row, CONFIG.COL_MODELO);

  var title = '🛡️ Airbag · ' + matricula + ' · ' + cliente;
  if (marca)  title += ' (' + marca;
  if (modelo) title += ' ' + modelo + ')';

  return trelloRequest('POST', '/cards', {
    name   : title,
    desc   : buildCardDescription(sheet, row),
    idList : idList,
    pos    : 'bottom'
  });
}

function updateCardDescription(sheet, row, cardId) {
  trelloRequest('PUT', '/cards/' + cardId, {
    desc: buildCardDescription(sheet, row)
  });
}

function buildCardDescription(sheet, row) {
  var v = {
    matricula  : getCellValue(sheet, row, CONFIG.COL_MATRICULA),
    cliente    : getCellValue(sheet, row, CONFIG.COL_CLIENTE),
    telefono   : getCellValue(sheet, row, CONFIG.COL_TELEFONO),
    marca      : getCellValue(sheet, row, CONFIG.COL_MARCA),
    modelo     : getCellValue(sheet, row, CONFIG.COL_MODELO),
    vin        : getCellValue(sheet, row, CONFIG.COL_VIN),
    estado     : getCellValue(sheet, row, CONFIG.COL_ESTADO),
    fecha_cita : getCellValue(sheet, row, CONFIG.COL_FECHA_CITA),
    notas      : getCellValue(sheet, row, CONFIG.COL_NOTAS),
  };
  var lines = [
    '## 🛡️ Campaña Airbags Stellantis',
    '',
    '🚗 Matrícula: **' + (v.matricula  || '—') + '**',
    '👤 Cliente: **'   + (v.cliente    || '—') + '**',
    v.telefono   ? '📞 Teléfono: '              + v.telefono   : '',
    v.marca      ? '🏷 Marca/Modelo: '          + v.marca + (v.modelo ? ' ' + v.modelo : '') : '',
    v.vin        ? '🔑 VIN/Bastidor: `'         + v.vin + '`'  : '',
    '📋 Estado: **'    + (v.estado     || '—') + '**',
    v.fecha_cita ? '📅 Fecha cita: '            + v.fecha_cita : '📅 Fecha cita: Sin asignar',
    '',
    v.notas      ? '📝 ' + v.notas : '',
    '',
    '---',
    '*Sync Google Sheets · ' + new Date().toLocaleString('es-ES') + '*'
  ];
  return lines.filter(function(l){ return l !== ''; }).join('\n').replace(/\n{3,}/g, '\n\n');
}

// ─────────────────────────────────────────────────────────────────────────
//  🛠  UTILIDADES
// ─────────────────────────────────────────────────────────────────────────

function getCellValue(sheet, row, col) {
  return String(sheet.getRange(row, col).getValue() || '').trim();
}

// ── Muestra los IDs de todas las listas de un tablero en el Log
//    Uso: printListIds('BOARD_ID')
//    El Board ID está en la URL: trello.com/b/BOARD_ID/nombre
function printListIds(boardId) {
  var lists = trelloRequest('GET', '/boards/' + boardId + '/lists', null);
  lists.forEach(function(l) {
    Logger.log(l.name + '  →  ' + l.id);
  });
  Logger.log('Copia estos IDs en la sección TRELLO_LISTS del CONFIG');
}

// ── Instala los triggers automáticos — ejecutar UNA SOLA VEZ
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Eliminar triggers anteriores para evitar duplicados
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (['onEdit', 'syncAll'].indexOf(trigger.getHandlerFunction()) !== -1) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Trigger de edición (responde al instante cuando cambias un Estado)
  ScriptApp.newTrigger('onEdit')
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  // Trigger nocturno — sync completo cada noche a las 2:00
  ScriptApp.newTrigger('syncAll')
    .timeBased()
    .everyDays(1)
    .atHour(2)
    .create();

  Logger.log('✅ Triggers instalados: onEdit (instantáneo) + syncAll (cada noche a las 2:00)');
}

// ── Crea cabeceras, formato y desplegable de estados — ejecutar UNA SOLA VEZ
function createHeaders() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(CONFIG.SHEET_NAME);

  // Cabeceras
  var headers = [
    'Matrícula','Cliente','Teléfono','Marca','Modelo',
    'VIN/Bastidor','Estado','Fecha Cita','Notas',
    'Trello Card ID','Última Sincronización'
  ];
  var hRange = sheet.getRange(1, 1, 1, headers.length);
  hRange.setValues([headers]);
  hRange.setFontWeight('bold');
  hRange.setBackground('#0c1a35');
  hRange.setFontColor('#ffffff');
  hRange.setFontFamily('Arial');
  hRange.setFontSize(11);

  // Anchos de columna
  var widths = [110, 160, 120, 100, 100, 160, 110, 110, 220, 210, 160];
  widths.forEach(function(w, i) { sheet.setColumnWidth(i + 1, w); });

  // Desplegable en columna Estado (G) desde fila 2 hasta 1000
  var estadoRange = sheet.getRange(CONFIG.FIRST_DATA_ROW, CONFIG.COL_ESTADO, 1000, 1);
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Sin Pedir','Pendiente','Recibido','Instalado'], true)
    .setAllowInvalid(false)
    .setHelpText('Selecciona el estado del pedido')
    .build();
  estadoRange.setDataValidation(rule);

  // Formato de fecha en columna H
  sheet.getRange(CONFIG.FIRST_DATA_ROW, CONFIG.COL_FECHA_CITA, 1000, 1)
    .setNumberFormat('dd/mm/yyyy');

  // Columna Trello ID → fondo gris, solo lectura visual
  var trelloCol = sheet.getRange(1, CONFIG.COL_TRELLO_ID, 1000, 2);
  trelloCol.setBackground('#f3f4f6');
  trelloCol.setFontColor('#9ca3af');
  trelloCol.setFontSize(9);

  // Inmovilizar fila de cabecera
  sheet.setFrozenRows(1);

  Logger.log('✅ Hoja "' + CONFIG.SHEET_NAME + '" configurada correctamente');
  Logger.log('Siguiente paso: ejecuta setup() para activar los triggers automáticos');
}
