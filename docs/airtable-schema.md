# KODA · Base de datos Mercasa en Airtable

Esquema propuesto para la base que alimenta la **Biblioteca de Mercado** de la
vista *Proyección*. La rellena un workflow de n8n (ver [n8n-scraper-workflow.md](./n8n-scraper-workflow.md))
que corre a diario y hace scraping de precios mayoristas.

---

## 1. Estructura de tablas

La base se llama **`KODA_Mercado`** y contiene 4 tablas relacionadas:

```
mercados ──┐
           ├──> ingredientes ──> precios ──> precios_diarios
familias ──┘
```

### Tabla 1 · `mercados`

Catálogo de mercados mayoristas que se scrapean.

| Campo | Tipo Airtable | Descripción | Ejemplo |
|---|---|---|---|
| `id_mercado` | Autonumber / PK | ID único | 1 |
| `nombre` | Single line text | Nombre del mercado | `mercabarna` |
| `ciudad` | Single line text | Ciudad | `Barcelona` |
| `url_scraping` | URL | Página fuente | `https://www.mercabarna.es/precios/…` |
| `activo` | Checkbox | Si se scrapea o no | ✓ |
| `ultima_actualizacion` | Date + time | Última corrida OK | 2026-08-18 06:00 |

**Filas iniciales:** `mercabarna`, `mercamadrid`, `mercabilbao`, `mercavalencia`, `mercasevilla`.

---

### Tabla 2 · `familias`

Categorías de ingrediente + porcentaje de merma default (usado por el escandallo).

| Campo | Tipo Airtable | Descripción | Ejemplo |
|---|---|---|---|
| `id_familia` | Autonumber / PK | ID único | 1 |
| `codigo` | Single line text (unique) | Slug interno | `pescado-limpio` |
| `nombre_es` | Single line text | Nombre visible | `Pescado limpio` |
| `merma_default` | Percent (0-100) | % merma preset | 10 |
| `emoji` | Single line text | Icono UI | 🐟 |
| `orden` | Number | Orden en la UI | 1 |

**Filas iniciales:** pescado-entero, pescado-limpio, marisco-cascara, marisco-limpio,
carne-hueso, carne-limpia, verdura, fruta, aceite, lacteo, huevo, hierba, procesado, premium.

---

### Tabla 3 · `ingredientes`

Catálogo maestro de ingredientes. Un ingrediente puede tener precios en varios mercados.

| Campo | Tipo Airtable | Descripción | Ejemplo |
|---|---|---|---|
| `id_ingrediente` | Autonumber / PK | ID único | 42 |
| `nombre` | Single line text | Nombre canónico | `Gamba blanca` |
| `nombre_slug` | Formula → LOWER(SUBSTITUTE({nombre}," ","-")) | Slug URL-safe | `gamba-blanca` |
| `familia` | Link to `familias` | Categoría | → `marisco-cascara` |
| `unidad_base` | Single select (`kg`, `L`, `ud`, `docena`) | Unidad de referencia | `kg` |
| `precio_actual` | Formula → últimoPrecio | Precio más reciente (rollup) | 20.00 |
| `precio_medio_12m` | Rollup(AVG) sobre `precios` | Media anual | 19.50 |
| `variacion_vs_media` | Formula → (actual - media)/media | Desviación | +0.026 |
| `tags` | Multiple select | Etiquetas | `temporada`, `premium` |
| `aliases` | Long text | Nombres alternativos (search) | `gamba, langostino blanco` |
| `sinonimos_scraper` | Long text | Strings que el scraper debe reconocer | `Gamba blanca; GAMBA BLANCA HUELVA` |
| `activo` | Checkbox | Si aparece en la UI | ✓ |

---

### Tabla 4 · `precios`

Un registro por combinación **ingrediente × mercado × fecha**. La tabla que crece.

| Campo | Tipo Airtable | Descripción | Ejemplo |
|---|---|---|---|
| `id_precio` | Autonumber / PK | ID único | 15234 |
| `ingrediente` | Link to `ingredientes` | FK | → Gamba blanca |
| `mercado` | Link to `mercados` | FK | → mercabarna |
| `fecha` | Date | Fecha del precio | 2026-08-18 |
| `precio_kg` | Currency (€) | Precio €/kg (o unidad base) | 20.00 |
| `precio_min` | Currency (€) | Precio mínimo del día | 18.50 |
| `precio_max` | Currency (€) | Precio máximo del día | 22.00 |
| `unidad` | Single select | Unidad reportada | `kg` |
| `calibre` | Single line text | Talla si aplica | `40/60` |
| `origen` | Single line text | Origen del producto | `Huelva` |
| `procedencia_scraper` | Single line text | URL o job_id que insertó | `n8n_job_20260818_060023` |
| `hash_registro` | Formula (evita duplicados) | Hash ingrediente+mercado+fecha | — |

**Índice único recomendado:** `hash_registro` (vía view + filter en n8n antes de insertar).

---

## 2. Vistas útiles de Airtable

- **`ingredientes / activos_por_familia`** — agrupada por familia, filtro `activo = true`.
  Es la que consume la UI vía Airtable API.
- **`precios / ultimo_por_ingrediente`** — 1 fila por ingrediente con su precio más reciente.
  Vista con `Group by: ingrediente + Sort: fecha DESC + Limit: 1`.
- **`precios / historico_12m`** — filtro `fecha >= TODAY() - 365`. Consumo del gráfico.
- **`precios / picos_semana`** — filtro `variacion_vs_media > 15%`. Alertas de la UI.

---

## 3. Formulas útiles ya definidas

```
// familias.merma_default → convertir a decimal en el frontend
merma_decimal = merma_default / 100

// ingredientes.precio_medio_12m (rollup sobre precios)
Rollup: AVERAGE(values) donde precios.fecha >= TODAY() - 365

// ingredientes.variacion_vs_media
IF({precio_medio_12m} > 0,
   ({precio_actual} - {precio_medio_12m}) / {precio_medio_12m},
   0)

// precios.hash_registro (evita duplicados al upsert)
CONCATENATE({ingrediente}, "-", {mercado}, "-", DATETIME_FORMAT({fecha}, "YYYY-MM-DD"))
```

---

## 4. API para el frontend

Airtable expone REST API por base. Ejemplos:

```bash
# Todos los ingredientes activos (para poblar la biblioteca)
curl "https://api.airtable.com/v0/appXXXXXXX/ingredientes?view=activos_por_familia" \
  -H "Authorization: Bearer $AIRTABLE_PAT"

# Histórico 12m de un ingrediente concreto (para el gráfico)
curl "https://api.airtable.com/v0/appXXXXXXX/precios?filterByFormula=AND({ingrediente}='Gamba blanca',IS_AFTER({fecha},DATEADD(TODAY(),-365,'days')))" \
  -H "Authorization: Bearer $AIRTABLE_PAT"
```

**Cuota Airtable Free:** 1200 registros/base, 5 req/seg. Para el MVP con 30-50
ingredientes × 365 días × 5 mercados llegas rápido al límite → **plan Team (10€/mes)
sube a 50k registros**, suficiente para el primer año de datos.

---

## 5. Setup manual paso a paso

1. Crear cuenta en [airtable.com](https://airtable.com) (o usar la del team)
2. Crear nueva base vacía llamada `KODA_Mercado`
3. Crear las 4 tablas con los campos de este documento
4. Precargar `mercados` con las 5 filas iniciales
5. Precargar `familias` con las 14 filas iniciales
6. Generar un Personal Access Token (Airtable → Developer Hub → PAT)
   - Scopes necesarios: `data.records:read`, `data.records:write`, `schema.bases:read`
   - Access: solo a la base `KODA_Mercado`
7. Guardar el PAT + Base ID en variables de entorno del backend (nunca en el frontend)

**Alternativa más rápida:** puedo generar un [template de base](https://airtable.com/create/base)
listo para importar si me pasas acceso a tu workspace de Airtable (necesitas
autorizar el conector Airtable en Claude — instrucciones en el README del proyecto).
