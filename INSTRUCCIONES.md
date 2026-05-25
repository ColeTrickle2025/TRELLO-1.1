# 🛡️ Stellantis Recambios — Power-Up Trello + Google Sheets
## Guía de instalación completa

---

## ¿Qué hace este sistema?

| Función | Descripción |
|---|---|
| 📋 **Nueva Solicitud** | Botón en Trello → elige plantilla → formulario → crea tarjeta |
| 🛡️ **Plantilla Airbag** | Matrícula, VIN, tipo de airbag, prioridad... |
| 🔄 **Plantilla Neumáticos** | Medida, tipo, cantidad, llanta... |
| 📦 **Pedido General** | Referencia, cantidad, proveedor, urgencia... |
| 🔵 **Ver Pedido** | En cada tarjeta, resumen visual con todos los datos |
| 📊 **Sync automático** | Cambias Estado en Google Sheets → tarjeta se mueve en Trello |

---

## BLOQUE 1 — Power-Up de Trello

### Paso 1 · Subir archivos a GitHub Pages (gratis, ~5 min)

El Power-Up necesita estar en una URL pública HTTPS. GitHub Pages lo da gratis.

1. Ve a **github.com** → crea cuenta gratuita si no tienes
2. **"New repository"** → nombre: `stellantis-powerup` → **Create**
3. Arrastra estos 3 archivos al repositorio:
   - `index.html`
   - `modal.html`
   - `card-section.html`
4. Clic en **"Commit changes"**
5. **Settings → Pages → Source** → selecciona `main` → **Save**
6. Espera ~2 min → tu URL queda: `https://TU_USUARIO.github.io/stellantis-powerup/`

---

### Paso 2 · Registrar el Power-Up en Trello (gratis)

1. Ve a **https://trello.com/power-ups/admin**
2. **"Create new Power-Up"**
3. Rellena:
   - **Name**: Stellantis Recambios
   - **Workspace**: tu workspace
   - **Iframe connector URL**: `https://TU_USUARIO.github.io/stellantis-powerup/index.html`
4. Activa estas **Capabilities**:
   - ✅ `board-buttons`
   - ✅ `card-buttons`
   - ✅ `card-back-section`
   - ✅ `show-settings`
5. Guarda

---

### Paso 3 · Añadir el Power-Up al tablero

1. Abre tu tablero de Trello
2. Menú derecho → **"Power-Ups"**
3. Busca **"Stellantis Recambios"** (en Custom / tu workspace)
4. **Añadir**

---

### Paso 4 · Configurar credenciales Trello

1. En el tablero → Power-Up → ⚙️ **Configuración**
2. Ve a **https://trello.com/app-key**
   - Copia tu **API Key**
   - Clic en **"Generar Token"** → copia el token
3. Pégalos en la pantalla de configuración → **Guardar**

✅ **Power-Up listo.** Ya puedes usar **"📋 Nueva Solicitud"** en el tablero.

---

## BLOQUE 2 — Sincronización Google Sheets ↔ Trello

### Paso 5 · Preparar Google Sheets

1. Ve a **sheets.google.com** → crea una hoja nueva
2. Desde el menú: **Extensiones → Apps Script**
3. Borra el código de ejemplo que aparece
4. Abre el archivo `sync-sheets.gs` y copia **todo el contenido**
5. Pégalo en el editor → **Ctrl+S** para guardar → ponle nombre al proyecto: `Stellantis Sync`

---

### Paso 6 · Editar la configuración del script

Busca la sección `⚙️ CONFIGURACIÓN` arriba del todo y edita:

```javascript
TRELLO_API_KEY : 'pega_aquí_tu_api_key',
TRELLO_TOKEN   : 'pega_aquí_tu_token',
SHEET_NAME     : 'Airbags',   // o el nombre que pongas a tu hoja
```

Para los IDs de las listas, de momento déjalos y ve al paso siguiente.

---

### Paso 7 · Obtener los IDs de las listas de Trello

1. En la URL de tu tablero Trello: `trello.com/b/`**BOARD_ID**`/nombre`
   Copia ese **BOARD_ID** (son 8 caracteres, ej: `aBcD1234`)

2. En el editor de Apps Script, busca la función `printListIds` al final del archivo

3. En la parte inferior del editor, haz clic en el campo de función → escribe `printListIds` → pero primero necesitas llamarla con el ID. Añade temporalmente esta línea al final:
   ```javascript
   printListIds('TU_BOARD_ID_AQUÍ');
   ```
4. Selecciona `printListIds` en el desplegable de funciones → clic en ▶ **Ejecutar**
5. Ve a **Ver → Registros de ejecución** → verás algo como:
   ```
   Sin Pedir  →  6abc123def456789
   Pendiente  →  7bcd234efg567890
   Recibido   →  8cde345fhi678901
   Instalado  →  9def456gij789012
   ```
6. Copia esos IDs en la sección `TRELLO_LISTS` del CONFIG
7. Borra la línea temporal que añadiste

---

### Paso 8 · Preparar la hoja con cabeceras

1. En el editor de Apps Script, selecciona la función **`createHeaders`** en el desplegable
2. Clic en ▶ **Ejecutar**
3. Autoriza los permisos que pide Google (es normal, necesita acceso a tu Sheet)

Esto crea automáticamente:
- Las cabeceras con formato azul oscuro
- El desplegable de estados en la columna G (Sin Pedir / Pendiente / Recibido / Instalado)
- El formato de fecha en columna H
- La fila de cabecera inmovilizada

---

### Paso 9 · Activar los triggers automáticos

1. En el editor, selecciona la función **`setup`** en el desplegable
2. Clic en ▶ **Ejecutar**
3. Vuelve a autorizar si lo pide

Esto instala dos automatismos:
- **onEdit**: cuando cambias el Estado en columna G → la tarjeta se mueve en Trello al instante
- **syncAll**: cada noche a las 2:00 AM hace una sincronización completa de toda la hoja

---

### Cómo queda el flujo completo

```
Recepcionista en el taller
        │
        ▼
┌─────────────────────────────────────┐
│  Clic "📋 Nueva Solicitud" en Trello│
│  Elige plantilla → rellena formulario│
└─────────────────────────────────────┘
        │  Tarjeta creada en Trello con todos los datos
        ▼
┌─────────────────────────────────────┐
│  Recambista ve la tarjeta           │
│  Pide la pieza                      │
└─────────────────────────────────────┘
        │  Cambia Estado en Google Sheets (col G) → "Pendiente"
        ▼
┌─────────────────────────────────────┐
│  Apps Script detecta el cambio      │
│  Llama a la API de Trello           │
│  Tarjeta se mueve a lista "Pendiente"│
└─────────────────────────────────────┘
        │  Llega la pieza → Estado = "Recibido"
        ▼
┌─────────────────────────────────────┐
│  Se instala → Estado = "Instalado"  │
│  Tarjeta se archiva en Trello       │
└─────────────────────────────────────┘
```

---

## Preguntas frecuentes

**¿Cuánto cuesta todo esto?**
Todo es 100% gratuito: GitHub Pages, Trello Power-Up, Google Sheets y Apps Script.

**¿Los triggers funcionan solos o hay que ejecutarlos cada vez?**
Una vez instalados con `setup()` funcionan solos para siempre. No hay que hacer nada más.

**¿Se puede hacer al revés? (Trello → Google Sheets)**
Sí, se puede añadir. Requeriría configurar un Webhook de Trello o un trigger de tiempo que lea el tablero. Dímelo si lo necesitas.

**¿Puedo tener varias hojas? (una para Airbags, otra para Neumáticos)**
Sí. Duplica el script, cambia `SHEET_NAME` en cada copia y usa diferentes tableros o listas de Trello.

**¿Puedo importar mi historial actual desde el Excel al Google Sheets?**
Sí, simplemente copia y pega los datos. Si ya tienes Trello Card IDs en otra columna, ponlos en la columna J. Si no los tienes, deja J vacía y el script creará las tarjetas nuevas automáticamente la próxima vez que cambies algún Estado.
