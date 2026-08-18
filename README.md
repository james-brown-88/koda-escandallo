# KODA · Escandallo Predictivo v1

Prototipo funcional del **4º paso** de la cadena operativa del chef privado:

`Lalesca/Booking → MEG → Narrativa Comercial → ESCANDALLO → Señal/Pago → Factura`

## Stack

- React 18 + Vite 5
- Tailwind CSS 3 (design system "Elite Expedition")
- Recharts (gráficos)
- Lucide React (iconos)

## Cómo arrancar en local

```bash
cd escandallo-app
npm install
npm run dev
```

Se abrirá automáticamente en http://localhost:5173

Para build de producción (previo a Vercel):

```bash
npm run build
npm run preview
```

## Estructura

- `src/Escandallo_v1.jsx` — el artefacto completo (4 vistas)
- `src/main.jsx` — entrypoint React
- `src/index.css` — Tailwind + reset + grano de ruido overlay
- `tailwind.config.js` — colores del design system

## Las 4 vistas

1. **Dashboard** — KPI cards (coste ing, coste total, precio venta, margen), mini-chart histórico del menú, ajuste rápido del precio de venta, alertas, sugerencia de precio.
2. **Desglose** — Tabla editable por pase. Chef corrige `€/kg` en tiempo real, ve delta vs. Mercasa, aplica mermas por familia. Botón cámara por línea (placeholder OCR albarán).
3. **Proyección** — Gráfico de líneas Recharts con 12m de precios Mercabarna de los ingredientes protagonistas. Detecta picos estacionales y sugiere alternativas ("aplicar lubina en vez de merluza").
4. **Histórico** — BarChart apilado con evolución del margen del chef. Comparativa 6 últimos servicios, con insight de drivers de subida.

## Datos simulados

- Menú "Mediterráneo Contemporáneo" · 6 pases · 8 pax · Barcelona · 15 sept 2026
- Precio venta 95€/pax
- Precios reales de mercado español (Mercabarna referencia)
- Histórico Mercasa: 12 meses simulados de 5 ingredientes
- Histórico chef: 6 escandallos anteriores

## Puntos de integración (comentados en código)

- `TODO(meg-integration)` → fetch del menú desde el MEG
- `TODO(scraper)` → fetch a `mercasa_precios` real
- `TODO(albaran-vision)` → OCR + visión LLM para albaranes
- `TODO(holded)` → POST a Holded API para facturación Verifactu
- `TODO(supabase)` → schema `escandallo` + `escandallo_lineas` + `mercasa_precios`

## Colores del design system

| Token | Hex |
|---|---|
| `bg-deep` | #0E0B08 |
| `bg-surface` | #15110D |
| `bg-elevated` | #1C1712 |
| `accent` | #C8915A (oro cálido) |
| `accent-hi` | #E0A876 |
| `ember` | #B5482D (alertas) |
| `moss` | #5C7355 (ok) |
| `ink-100` | #F5EFE6 |
