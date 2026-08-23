# KODA · Workflow n8n · Scraper Mercasa → Airtable

Workflow diario que scrapea precios de mercados mayoristas y los vuelca en la
base Airtable `KODA_Mercado` (ver [airtable-schema.md](./airtable-schema.md)).

## Arquitectura

```
┌─────────┐   ┌──────────────┐   ┌─────────┐   ┌──────────┐   ┌──────────┐
│  Cron   │→ │ HTTP Request │→ │  Parser │→ │  Match   │→ │ Airtable │
│ diario  │   │ (Mercabarna) │   │ (HTML)  │   │ ingred.  │   │  Upsert  │
│  06:00  │   │              │   │ o (CSV) │   │ (fuzzy)  │   │          │
└─────────┘   └──────────────┘   └─────────┘   └──────────┘   └──────────┘
                     │                                              │
                     ↓ (loop por cada mercado activo)               ↓
              ┌──────────────┐                              ┌──────────────┐
              │  Retry x3 +  │                              │  Log Slack   │
              │  Error queue │                              │  (opcional)  │
              └──────────────┘                              └──────────────┘
```

## Estructura del workflow (nodos)

### 1. `Cron` · trigger diario 06:00
- Cron expression: `0 6 * * *`
- Timezone: `Europe/Madrid`

### 2. `Airtable · Get mercados activos`
- Action: Search
- Base: `KODA_Mercado`
- Table: `mercados`
- Filter formula: `{activo} = TRUE()`
- Output: array de mercados con `nombre` y `url_scraping`

### 3. `Split In Batches` · por mercado
- Batch Size: 1 (secuencial para no saturar los sitios)

### 4. `HTTP Request` · descarga la página del mercado
- Method: GET
- URL: `={{ $json.url_scraping }}`
- Retry on fail: 3, wait 30s
- Headers:
  ```
  User-Agent: KODA-Scraper/1.0 (jaime@koda.chef)
  Accept: text/html,application/xhtml+xml
  ```

### 5. `Code (JavaScript)` · parser específico por mercado

Cada mercado publica en un formato distinto. Este nodo delega al parser adecuado:

```javascript
// n8n · Code node — parser router
const mercado = $('Split In Batches').item.json.nombre
const html = $input.first().json.body

const parsers = {
  mercabarna:    parseMercabarna,
  mercamadrid:   parseMercamadrid,
  mercavalencia: parseMercavalencia,
  mercabilbao:   parseMercabilbao,
  mercasevilla:  parseMercasevilla,
}
if (!parsers[mercado]) throw new Error(`Sin parser para ${mercado}`)
return parsers[mercado](html).map(row => ({ json: { ...row, mercado_slug: mercado } }))

// ── Parser Mercabarna ────────────────────────────────────
// Mercabarna publica un HTML con tablas por categoría.
function parseMercabarna(html) {
  const cheerio = require('cheerio')
  const $ = cheerio.load(html)
  const rows = []
  $('table.precios tr').each((_, tr) => {
    const cols = $(tr).find('td').map((_, td) => $(td).text().trim()).get()
    if (cols.length < 4 || !cols[1]) return
    rows.push({
      nombre_scraper: cols[1],
      precio_min: parseFloat(cols[2].replace(',', '.')) || null,
      precio_max: parseFloat(cols[3].replace(',', '.')) || null,
      precio_kg: cols[4] ? parseFloat(cols[4].replace(',', '.')) : null,
      unidad: cols[5] || 'kg',
      origen: cols[6] || null,
      calibre: cols[7] || null,
      fecha: new Date().toISOString().split('T')[0]
    })
  })
  return rows
}

// Parsers para los otros mercados: mismo patrón, ajustar selectores.
```

### 6. `Airtable · Search ingredientes` · fuzzy match

Cada precio scrapeado tiene un `nombre_scraper` que hay que mapear al ingrediente
canónico. Airtable expone la columna `sinonimos_scraper` (`Gamba blanca; GAMBA BLANCA HUELVA`)
justo para esto.

- Action: Search records
- Table: `ingredientes`
- Filter formula:
  ```
  OR(
    LOWER({nombre}) = LOWER("{{ $json.nombre_scraper }}"),
    FIND(LOWER("{{ $json.nombre_scraper }}"), LOWER({sinonimos_scraper})) > 0
  )
  ```
- Si `output.length === 0`: enviar a **queue de nuevos ingredientes** (nodo `Airtable · Insert ingrediente pendiente`) para revisión manual y salir del loop de esta fila.

### 7. `Code` · construir registro `precios`

```javascript
const scraper = $input.first().json          // línea del scraper
const ingredienteMatch = $('Airtable · Search ingredientes').first().json
const mercadoRecord = $('Split In Batches').item.json

return [{
  json: {
    ingrediente:         [ingredienteMatch.id],
    mercado:             [mercadoRecord.id],
    fecha:               scraper.fecha,
    precio_kg:           scraper.precio_kg ?? ((scraper.precio_min + scraper.precio_max) / 2),
    precio_min:          scraper.precio_min,
    precio_max:          scraper.precio_max,
    unidad:              scraper.unidad,
    calibre:             scraper.calibre,
    origen:              scraper.origen,
    procedencia_scraper: `n8n_${$workflow.id}_${new Date().toISOString()}`
  }
}]
```

### 8. `Airtable · Upsert precio` · evita duplicados

- Action: Upsert record
- Table: `precios`
- Match On field: `hash_registro`
- Fields: los del paso anterior

### 9. `Airtable · Update mercado` · marcar timestamp
- Action: Update
- Table: `mercados`
- Record ID: `={{ $('Split In Batches').item.json.id }}`
- Field: `ultima_actualizacion = {{ $now }}`

### 10. `IF` · si hubo errores → notificar
- Condition: `{{ $json.errores.length > 0 }}`
- True → nodo `Slack` (o email) con resumen de fallos

---

## Variables de entorno n8n

```
AIRTABLE_PAT=patXXXXXXXXXXXXXX
AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX
SLACK_WEBHOOK=https://hooks.slack.com/…   (opcional)
```

Se guardan en n8n → Credentials.

---

## Import rápido del workflow

He preparado un **JSON exportado listo para importar** en n8n en
[`n8n-scraper-workflow.json`](./n8n-scraper-workflow.json).

**Cómo importarlo:**

1. En tu instancia n8n → **Workflows** → **Import from File**
2. Sube `n8n-scraper-workflow.json`
3. Configura las credentials de Airtable (PAT + Base ID)
4. Ajusta las URLs de los mercados si han cambiado
5. Activa el workflow

---

## Estimación de coste y volumen

| Recurso | Volumen esperado | Coste/mes |
|---|---|---|
| n8n Cloud (starter) | 5.000 execuciones/mes | $20 |
| n8n self-hosted | Ilimitado | $5 VPS |
| Airtable Team | 50k registros | 10 € |
| Total | — | **~30 €/mes** |

Con 5 mercados × 40 ingredientes × 365 días = **73.000 registros/año**, cabes en
Team plan durante el primer año largo. Después conviene archivar `precios` con
más de 24 meses de antigüedad a una tabla `precios_historico_frio`.

---

## Alternativas al scraping (por si algún mercado bloquea)

- **Mercasa API oficial:** algunas Mercas ofrecen datos abiertos vía CSV
  descargable diario. Preferible cuando existe (nodo `HTTP Request` → `CSV Parse`
  en vez de HTML parse).
- **Feed de proveedor directo:** si el chef trabaja con un mayorista concreto,
  puedes pedirle un feed diario (Excel por email) y parsear el adjunto vía
  `Email Trigger` → `Extract from Excel`.
- **Fallback manual:** botón en la UI del chef "actualizar precio de este ingrediente"
  → guarda directo en Airtable saltándose el scraper.
