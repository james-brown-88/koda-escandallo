/**
 * KODA · Escandallo Predictivo v1
 * ---------------------------------------------------------------------------
 * 4º paso del flujo del chef:
 *   Lalesca/Booking → MEG → Narrativa Comercial → ESCANDALLO → Señal/Pago → Factura
 *
 * Inputs (hoy hardcoded; ver TODO(supabase)):
 *   - Menú generado por el MEG (Motor de Estructuración Gastronómica)
 *   - Perfil del chef (zona, histórico)
 *   - Precios Mercasa (tabla mercasa_precios, scraper)
 *
 * Outputs (hoy simulados; ver TODO(holded), TODO(stripe)):
 *   - Coste por comensal, margen, precio de venta sugerido
 *   - Payload para factura Holded
 *   - Payload para narrativa comercial
 *   - Datos para ficha de cierre + Souvenir Digital
 *
 * Design system "Elite Expedition": dark warm, premium, minimalist.
 * ---------------------------------------------------------------------------
 */

import React, { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceDot, CartesianGrid, BarChart, Bar, Legend
} from 'recharts'
import {
  Camera, Sparkles, TrendingUp, TrendingDown, AlertTriangle,
  ChefHat, Receipt, ArrowRight, RefreshCw, Info, Circle,
  Star, Search, X, Plus, Trash2, Zap
} from 'lucide-react'

/* ─────────────────────────────────────────────────────────────────────────
 * 1. MERMAS PRESET · por familia de ingrediente
 * (usadas como default cuando el MEG no las especifica)
 * ────────────────────────────────────────────────────────────────────────*/
const MERMA_PRESETS = {
  'pescado-entero': 0.50,
  'pescado-limpio': 0.10,
  'marisco-cascara': 0.45,
  'marisco-limpio': 0.05,
  'carne-hueso': 0.25,
  'carne-limpia': 0.05,
  verdura: 0.15,
  fruta: 0.12,
  aceite: 0.02,
  lacteo: 0.02,
  huevo: 0.02,
  hierba: 0.20,
  procesado: 0.03
}

/* ─────────────────────────────────────────────────────────────────────────
 * 2. INPUT SIMULADO · el JSON tal cual llegaría del MEG
 * TODO(meg-integration): reemplazar por fetch a /api/menus/:id
 * ────────────────────────────────────────────────────────────────────────*/
const MENU_MEG = {
  tipo: 'menu',
  nivel: 'Creación',
  nombre: 'Mediterráneo Contemporáneo',
  comensales: 8,
  fecha_servicio: '2026-09-15',
  zona: 'Barcelona',
  precio_venta_chef: 95, // €/pax que el chef quiere cobrar
  // Cliente destinatario (para la propuesta)
  cliente: { nombre: 'Marta & Álex', direccion: 'Poblenou, Barcelona', hora: '21:00', duracion_h: 4 },
  pases: [
    {
      // Snack de apertura — porciones pequeñas, bite-sized
      nombre: 'Gilda deconstruida con boquerón en vinagre',
      tipo: 'snack',
      copy: 'Dos bocados de bienvenida sobre teja crujiente. Piparra, gordal y boquerón del cantábrico marinado al momento.',
      ingredientes: [
        { nombre: 'Boquerón fresco', cantidad: 60,  unidad: 'g', familia: 'pescado-limpio', precio_chef: 5.5, precio_mercasa: 5.0 },
        { nombre: 'Aceituna gordal', cantidad: 25,  unidad: 'g', familia: 'procesado',       precio_chef: 14,  precio_mercasa: 12 },
        { nombre: 'Guindilla piparra', cantidad: 15, unidad: 'g', familia: 'procesado',      precio_chef: 22,  precio_mercasa: 20 },
        { nombre: 'AOVE Picual',      cantidad: 8,  unidad: 'ml', familia: 'aceite',         precio_chef: 7.5, precio_mercasa: 6.8 }
      ]
    },
    {
      // Entrante frío — ración de tartar profesional
      nombre: 'Tartar de gamba blanca, emulsión de cabezas y AOVE picual',
      tipo: 'entrante frío',
      copy: 'Gamba blanca de Huelva cortada a cuchillo, aliñada con la propia emulsión de sus cabezas y aceite de arbequina.',
      ingredientes: [
        { nombre: 'Gamba blanca',       cantidad: 120, unidad: 'g', familia: 'marisco-cascara', precio_chef: 22,  precio_mercasa: 19 },
        { nombre: 'AOVE Picual',        cantidad: 20,  unidad: 'ml', familia: 'aceite',          precio_chef: 7.5, precio_mercasa: 6.8 },
        { nombre: 'Lima',               cantidad: 20,  unidad: 'g', familia: 'fruta',            precio_chef: 3.5, precio_mercasa: 3.0 },
        { nombre: 'Chalota',            cantidad: 15,  unidad: 'g', familia: 'verdura',          precio_chef: 4.5, precio_mercasa: 3.8 }
      ]
    },
    {
      // Entrante caliente — la alcachofa suelta agua/hoja, el peso final en plato es menor
      nombre: 'Alcachofa confitada con jamón ibérico y yema curada',
      tipo: 'entrante caliente',
      copy: 'Corazones de alcachofa confitados a 65°C sobre yema curada 24h, rematados con lascas de ibérico de bellota.',
      ingredientes: [
        { nombre: 'Alcachofa',            cantidad: 220, unidad: 'g', familia: 'verdura',        precio_chef: 3.2, precio_mercasa: 2.9 },
        { nombre: 'Jamón ibérico loncha', cantidad: 30,  unidad: 'g', familia: 'procesado',      precio_chef: 58,  precio_mercasa: 52 },
        { nombre: 'Huevo campero',        cantidad: 1,   unidad: 'ud', familia: 'huevo',         precio_chef: 0.42, precio_mercasa: 0.35 },
        { nombre: 'AOVE Arbequina',       cantidad: 25,  unidad: 'ml', familia: 'aceite',        precio_chef: 8.5, precio_mercasa: 7.8 }
      ]
    },
    {
      // Pescado principal — 180g lomo limpio es la referencia de fine dining
      nombre: 'Lomo de merluza al pilpil con espárrago verde',
      tipo: 'pescado',
      copy: 'Merluza de anzuelo del cantábrico, pilpil emulsionado con su gelatina y espárrago verde a la brasa.',
      ingredientes: [
        { nombre: 'Merluza lomo',    cantidad: 180, unidad: 'g', familia: 'pescado-limpio', precio_chef: 15,  precio_mercasa: 13.5 },
        { nombre: 'Espárrago verde', cantidad: 100, unidad: 'g', familia: 'verdura',        precio_chef: 5.5, precio_mercasa: 4.8 },
        { nombre: 'Ajo',             cantidad: 8,   unidad: 'g', familia: 'verdura',        precio_chef: 6,   precio_mercasa: 5 },
        { nombre: 'AOVE Picual',     cantidad: 25,  unidad: 'ml', familia: 'aceite',        precio_chef: 7.5, precio_mercasa: 6.8 }
      ]
    },
    {
      // Carne principal — 170g secreto es porción generosa pero coherente en menú largo
      nombre: 'Secreto ibérico a baja temperatura con boniato y romesco',
      tipo: 'carne',
      copy: 'Secreto de cerdo ibérico cocinado 6h a 62°C, terminado a la brasa. Boniato asado y romesco de la abuela.',
      ingredientes: [
        { nombre: 'Secreto ibérico', cantidad: 170, unidad: 'g', familia: 'carne-limpia', precio_chef: 16, precio_mercasa: 14.5 },
        { nombre: 'Boniato',         cantidad: 130, unidad: 'g', familia: 'verdura',      precio_chef: 2.2, precio_mercasa: 1.8 },
        { nombre: 'Tomate seco',     cantidad: 20,  unidad: 'g', familia: 'procesado',    precio_chef: 18, precio_mercasa: 15 },
        { nombre: 'Almendra',        cantidad: 20,  unidad: 'g', familia: 'procesado',    precio_chef: 10, precio_mercasa: 8.5 },
        { nombre: 'Ñora',            cantidad: 6,   unidad: 'g', familia: 'procesado',    precio_chef: 28, precio_mercasa: 25 }
      ]
    },
    {
      nombre: 'Crema catalana con sorbete de mandarina y crujiente de almendra',
      tipo: 'postre',
      copy: 'Nuestra crema catalana con azúcar quemado a la vista, junto a un sorbete cítrico y un praliné crujiente.',
      ingredientes: [
        { nombre: 'Leche entera',    cantidad: 150, unidad: 'ml', familia: 'lacteo',    precio_chef: 1.4, precio_mercasa: 1.15 },
        { nombre: 'Yema huevo',      cantidad: 2,   unidad: 'ud', familia: 'huevo',     precio_chef: 0.42, precio_mercasa: 0.35 },
        { nombre: 'Azúcar',          cantidad: 50,  unidad: 'g',  familia: 'procesado', precio_chef: 1.2, precio_mercasa: 1.0 },
        { nombre: 'Mandarina',       cantidad: 100, unidad: 'g',  familia: 'fruta',     precio_chef: 2.8, precio_mercasa: 2.4 }, // sep = fuera temporada
        { nombre: 'Almendra',        cantidad: 25,  unidad: 'g',  familia: 'procesado', precio_chef: 10,  precio_mercasa: 8.5 }
      ]
    }
  ]
}

/* ─────────────────────────────────────────────────────────────────────────
 * 2b. TARIFA DEL CHEF · coste hora + estimación por complejidad de menú
 * TODO(perfil-chef): venir del perfil del chef en Supabase
 * ────────────────────────────────────────────────────────────────────────*/
const TARIFA_CHEF = {
  precio_hora: 35,            // €/h que el chef se paga a sí mismo
  horas_prep_base: 4,          // horas de mise en place base
  horas_por_pase: 0.8,         // + horas por complejidad del menú
  horas_servicio_base: 3       // servicio en casa del cliente
}

/* ─────────────────────────────────────────────────────────────────────────
 * 3. MERCADO · datos comunes del scraper (compartidos por todos los chefs)
 * TODO(scraper): reemplazar por fetch a /api/mercasa/precios?meses=12
 * Cada ingrediente: 12 meses de precio €/kg (oct del año anterior → sep actual)
 * ────────────────────────────────────────────────────────────────────────*/
const meses = ['oct','nov','dic','ene','feb','mar','abr','may','jun','jul','ago','sep']

const MERCADO = [
  // ─── PESCADO ────────────────────────────────────────────────
  { nombre: 'Merluza lomo',       familia: 'pescado',  mercado: 'mercabarna',  hist: [12, 13, 14, 15, 14, 13, 12, 11, 11, 12, 13, 13.5] },
  { nombre: 'Dorada',              familia: 'pescado',  mercado: 'mercabarna',  hist: [10, 11, 12, 13, 12, 10, 9,  8.5, 9,  10, 11, 11.5] },
  { nombre: 'Lubina',              familia: 'pescado',  mercado: 'mercabarna',  hist: [11, 12, 13, 14, 13, 11, 10, 9.5, 10, 11, 12, 12.5] },
  { nombre: 'Bacalao desalado',    familia: 'pescado',  mercado: 'mercabarna',  hist: [16, 17, 18, 19, 17, 16, 15, 15, 15, 16, 16, 16.5] },
  { nombre: 'Rape',                familia: 'pescado',  mercado: 'mercabarna',  hist: [18, 19, 21, 22, 20, 18, 17, 16, 16, 17, 18, 18.5] },
  { nombre: 'Salmón',              familia: 'pescado',  mercado: 'mercabarna',  hist: [14, 14, 15, 15, 14, 14, 14, 14, 14, 14, 14, 14] },
  { nombre: 'Boquerón fresco',     familia: 'pescado',  mercado: 'mercabarna',  hist: [4.5, 4.8, 5.2, 5.5, 5.2, 4.8, 4.5, 4.2, 4.5, 5.0, 5.2, 5.0] },

  // ─── MARISCO ───────────────────────────────────────────────
  { nombre: 'Gamba blanca',        familia: 'marisco',  mercado: 'mercabarna',  hist: [18, 19, 22, 24, 23, 21, 19, 18, 17, 18, 19, 20] },
  { nombre: 'Gamba roja',          familia: 'marisco',  mercado: 'mercabarna',  hist: [42, 48, 60, 68, 62, 52, 45, 40, 38, 40, 44, 46] },
  { nombre: 'Cigala',              familia: 'marisco',  mercado: 'mercabarna',  hist: [38, 42, 58, 72, 55, 42, 36, 32, 30, 32, 35, 38] },
  { nombre: 'Mejillón',            familia: 'marisco',  mercado: 'mercabarna',  hist: [3.5, 3.8, 4.0, 4.2, 4.0, 3.5, 3.2, 3.0, 3.0, 3.2, 3.5, 3.8] },
  { nombre: 'Pulpo',               familia: 'marisco',  mercado: 'mercabarna',  hist: [14, 15, 16, 17, 16, 15, 14, 13, 12, 13, 14, 14.5] },
  { nombre: 'Almeja fina',         familia: 'marisco',  mercado: 'mercabarna',  hist: [22, 25, 30, 34, 28, 24, 22, 20, 20, 22, 24, 25] },
  { nombre: 'Vieira',              familia: 'marisco',  mercado: 'mercabarna',  hist: [26, 28, 32, 36, 32, 28, 26, 24, 24, 26, 28, 28] },

  // ─── CARNE ──────────────────────────────────────────────────
  { nombre: 'Secreto ibérico',     familia: 'carne',    mercado: 'mercabarna',  hist: [14, 14, 15, 15, 14, 14, 14, 14, 15, 15, 14, 14.5] },
  { nombre: 'Presa ibérica',       familia: 'carne',    mercado: 'mercabarna',  hist: [17, 17, 18, 18, 17, 17, 17, 17, 18, 18, 17, 17.5] },
  { nombre: 'Entrecot vaca vieja', familia: 'carne',    mercado: 'mercabarna',  hist: [26, 26, 27, 28, 27, 26, 26, 26, 26, 27, 27, 27] },
  { nombre: 'Cordero lechal',      familia: 'carne',    mercado: 'mercabarna',  hist: [18, 20, 24, 22, 18, 17, 16, 16, 16, 17, 18, 18] },
  { nombre: 'Pollo campero',       familia: 'carne',    mercado: 'mercabarna',  hist: [7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7] },

  // ─── VERDURA ────────────────────────────────────────────────
  { nombre: 'Alcachofa',           familia: 'verdura',  mercado: 'mercabarna',  hist: [3.2, 3.5, 3.8, 4.0, 3.5, 2.8, 2.5, 2.4, 2.6, 2.8, 2.9, 2.9] },
  { nombre: 'Espárrago verde',     familia: 'verdura',  mercado: 'mercabarna',  hist: [7.0, 6.5, 6.0, 5.5, 5.0, 4.5, 4.2, 4.5, 5.0, 5.5, 6.0, 6.5] },
  { nombre: 'Tomate raf',          familia: 'verdura',  mercado: 'mercabarna',  hist: [6, 7, 8, 9, 7, 5, 4, 3.5, 3.5, 4, 5, 5.5] },
  { nombre: 'Pimiento del piquillo', familia: 'verdura', mercado: 'mercabarna',  hist: [4, 4.5, 5, 5.5, 5, 4, 3.5, 3.2, 3, 3.2, 3.5, 4] },
  { nombre: 'Patata monalisa',     familia: 'verdura',  mercado: 'mercabarna',  hist: [1.2, 1.3, 1.4, 1.5, 1.4, 1.3, 1.2, 1.1, 1.1, 1.2, 1.2, 1.3] },
  { nombre: 'Calabacín',           familia: 'verdura',  mercado: 'mercabarna',  hist: [2.5, 2.8, 3.2, 3.5, 3.0, 2.5, 2.2, 1.8, 1.8, 2.0, 2.2, 2.5] },
  { nombre: 'Boniato',             familia: 'verdura',  mercado: 'mercabarna',  hist: [1.6, 1.7, 1.8, 1.9, 1.8, 1.7, 1.8, 1.9, 2.0, 2.0, 1.9, 1.8] },

  // ─── FRUTA ──────────────────────────────────────────────────
  { nombre: 'Mandarina',           familia: 'fruta',    mercado: 'mercabarna',  hist: [1.4, 1.2, 1.1, 1.0, 1.1, 1.3, 1.6, 1.9, 2.4, 2.6, 2.5, 2.4] },
  { nombre: 'Fresa',               familia: 'fruta',    mercado: 'mercabarna',  hist: [4.5, 5.0, 5.5, 5.0, 4.5, 3.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.0] },
  { nombre: 'Higo',                familia: 'fruta',    mercado: 'mercabarna',  hist: [4.5, 5.0, 5.5, 6.0, 5.5, 5.0, 4.5, 4.0, 3.0, 2.5, 2.5, 3.0] },
  { nombre: 'Uva moscatel',        familia: 'fruta',    mercado: 'mercabarna',  hist: [3.5, 3.8, 4.0, 4.5, 4.0, 3.5, 3.0, 2.5, 2.0, 2.2, 2.5, 3.0] },

  // ─── ACEITE / GRASAS ────────────────────────────────────────
  { nombre: 'AOVE Picual',         familia: 'aceite',   mercado: 'mercabarna',  hist: [6.5, 6.8, 7.0, 7.2, 7.0, 6.8, 6.5, 6.5, 6.5, 6.5, 6.8, 6.8] },
  { nombre: 'AOVE Arbequina',      familia: 'aceite',   mercado: 'mercabarna',  hist: [7.5, 7.8, 8.0, 8.2, 8.0, 7.8, 7.5, 7.5, 7.5, 7.5, 7.8, 7.8] },
  { nombre: 'Mantequilla',         familia: 'aceite',   mercado: 'mercabarna',  hist: [8.5, 8.5, 8.5, 9.0, 9.0, 8.8, 8.5, 8.5, 8.5, 8.5, 8.5, 8.5] },

  // ─── LÁCTEO ─────────────────────────────────────────────────
  { nombre: 'Nata 35%',            familia: 'lácteo',   mercado: 'mercabarna',  hist: [3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5] },
  { nombre: 'Queso curado oveja',  familia: 'lácteo',   mercado: 'mercabarna',  hist: [24, 24, 25, 25, 25, 24, 24, 24, 24, 24, 24, 24] },
  { nombre: 'Huevo campero (docena)', familia: 'lácteo', mercado: 'mercabarna', hist: [3.5, 3.5, 3.6, 3.8, 3.6, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5] },

  // ─── PRODUCTO PREMIUM ──────────────────────────────────────
  { nombre: 'Trufa negra',         familia: 'premium',  mercado: 'mercabarna',  hist: [450, 600, 900, 1200, 900, 600, 300, 180, 150, 180, 240, 320] },
  { nombre: 'Jamón ibérico bellota', familia: 'premium', mercado: 'mercabarna', hist: [58, 58, 60, 62, 60, 58, 56, 56, 56, 58, 58, 58] }
]

/* Watchlist inicial del chef · lo que sigue habitualmente (persistiría en Supabase) */
const WATCHLIST_INITIAL = ['Gamba roja', 'Trufa negra', 'AOVE Picual', 'Dorada', 'Cigala']

/* ─────────────────────────────────────────────────────────────────────────
 * 4. HISTÓRICO DE ESCANDALLOS DEL CHEF · comparativa v4
 * TODO(supabase): SELECT * FROM escandallo WHERE chef_id=$1 ORDER BY fecha
 * ────────────────────────────────────────────────────────────────────────*/
const HISTORICO_CHEF = [
  { fecha: '2026-05-12', menu: 'Cena Primavera',   pax: 6, coste_pax: 26.10, precio_pax: 85, margen_pct: 69.3 },
  { fecha: '2026-06-04', menu: 'Menú Ligero',       pax: 10, coste_pax: 24.80, precio_pax: 78, margen_pct: 68.2 },
  { fecha: '2026-06-22', menu: 'Mediterráneo Contemp.', pax: 8, coste_pax: 29.50, precio_pax: 90, margen_pct: 67.2 },
  { fecha: '2026-07-15', menu: 'Cena Terraza',      pax: 12, coste_pax: 30.20, precio_pax: 88, margen_pct: 65.7 },
  { fecha: '2026-08-08', menu: 'Verano BCN',        pax: 8, coste_pax: 31.90, precio_pax: 90, margen_pct: 64.6 },
  { fecha: '2026-09-15', menu: 'Mediterráneo Contemp.', pax: 8, coste_pax: 32.40, precio_pax: 95, margen_pct: 65.9, actual: true }
]

/* ─────────────────────────────────────────────────────────────────────────
 * 5. HELPERS
 * ────────────────────────────────────────────────────────────────────────*/
const fmtEuro = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n)
const fmtPct  = (n) => `${n.toFixed(1)}%`
const cantidadUnidad = { g: 1000, ml: 1000, ud: 1, kg: 1, l: 1 } // divisor para llevar precio a la unidad base

// Coste de una línea = cantidad_bruta (en g/ml/ud) × precio_chef (€/kg,€/L,€/ud) / divisor
function costeLinea(ing) {
  const div = cantidadUnidad[ing.unidad] || 1
  return (ing.cantidad / div) * ing.precio_chef
}

// Delta %: precio del chef vs. precio mercasa (positivo = chef paga más)
function deltaPct(ing) {
  if (!ing.precio_mercasa || ing.precio_mercasa === 0) return null
  return ((ing.precio_chef - ing.precio_mercasa) / ing.precio_mercasa) * 100
}

// Semáforo del food cost — chef privado (menos gastos fijos que restaurante)
// Verde >50% margen, ámbar 30-50%, rojo <30%
function margenColor(margenPct) {
  if (margenPct >= 50) return 'text-moss'
  if (margenPct >= 30) return 'text-gold'
  return 'text-ember'
}

/* ─────────────────────────────────────────────────────────────────────────
 * 6. COMPONENTES REUTILIZABLES
 * ────────────────────────────────────────────────────────────────────────*/
function KpiCard({ label, value, sub, colorClass = 'text-ink-100' }) {
  return (
    <div className="bg-bg-surface border border-bg-line rounded-2xl p-5 sm:p-6 relative overflow-hidden">
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full pointer-events-none"
           style={{ background: 'radial-gradient(circle,rgba(200,145,90,0.10) 0%,transparent 70%)' }} />
      <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-60 mb-2 relative z-10">{label}</div>
      <div className={`font-display text-3xl sm:text-4xl leading-none tracking-tight relative z-10 ${colorClass}`}>{value}</div>
      {sub && <div className="mt-3 text-[11.5px] text-ink-60 relative z-10">{sub}</div>}
    </div>
  )
}

function SourceBadge({ fuente }) {
  const map = {
    manual:     { txt: 'manual',    cls: 'bg-bg-elevated text-ink-80 border-bg-line' },
    albaran:    { txt: 'albarán',   cls: 'bg-accent-lo/20 text-accent-hi border-accent-lo/40' },
    historico:  { txt: 'histórico', cls: 'bg-moss/20 text-moss border-moss/40' },
    mercasa:    { txt: 'mercasa',   cls: 'bg-gold/15 text-gold border-gold/30' },
    estimado:   { txt: 'estimado',  cls: 'bg-ink-20 text-ink-60 border-ink-20' }
  }
  const s = map[fuente] || map.manual
  return (
    <span className={`inline-block font-mono text-[9px] tracking-[0.1em] uppercase px-1.5 py-0.5 rounded border ${s.cls}`}>
      {s.txt}
    </span>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 sm:px-4 sm:py-2.5 rounded-md font-mono text-[10.5px] tracking-[0.14em] uppercase transition-colors ${
        active
          ? 'bg-bg-elevated text-ink-100'
          : 'text-ink-60 hover:text-ink-80'
      }`}
    >
      {children}
    </button>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
 * 7. MAIN COMPONENT
 * ────────────────────────────────────────────────────────────────────────*/
export default function Escandallo() {
  const [view, setView] = useState('dashboard') // dashboard | desglose | estacional | historico | propuesta
  const [menu, setMenu] = useState(MENU_MEG)
  const [pctCostesComp, setPctCostesComp] = useState(8) // % transporte, material, cocina
  const [tarifa, setTarifa] = useState(TARIFA_CHEF)     // coste hora + horas estimadas

  /* ── Recalcula todo cada vez que cambia el menú ───────────────────── */
  const calc = useMemo(() => {
    const lineas = []
    let total = 0
    menu.pases.forEach((pase, pIdx) => {
      pase.ingredientes.forEach((ing, iIdx) => {
        const cLinea = costeLinea(ing) // coste por comensal para esta línea
        total += cLinea
        lineas.push({
          pase: pase.nombre,
          paseIdx: pIdx,
          ingIdx: iIdx,
          ing,
          // merma_custom (%) tiene prioridad sobre el preset por familia
          merma: ing.merma_custom != null ? ing.merma_custom / 100 : (MERMA_PRESETS[ing.familia] || 0.05),
          coste_linea_pax: cLinea,
          delta: deltaPct(ing)
        })
      })
    })
    // Coste de mano de obra: prep base + horas por pase + servicio base
    const horasEstimadas = tarifa.horas_prep_base
                         + (tarifa.horas_por_pase * menu.pases.length)
                         + tarifa.horas_servicio_base
    const costeManoObraEvento = horasEstimadas * tarifa.precio_hora
    const costeManoObraPax = costeManoObraEvento / menu.comensales

    const costeIngredientesPax = total
    const costesComplPax = costeIngredientesPax * (pctCostesComp / 100)
    const costeTotalPax = costeIngredientesPax + costesComplPax + costeManoObraPax
    const costeTotalEvento = costeTotalPax * menu.comensales
    const ingresosEvento = menu.precio_venta_chef * menu.comensales
    const margenAbs = menu.precio_venta_chef - costeTotalPax
    const margenPct = (margenAbs / menu.precio_venta_chef) * 100
    const foodCostPct = (costeIngredientesPax / menu.precio_venta_chef) * 100 // food cost = solo ing.
    const costeTotalPct = (costeTotalPax / menu.precio_venta_chef) * 100
    const precioSugerido = costeTotalPax / 0.65 // margen objetivo 35% (chef privado con mano de obra dentro)

    return {
      lineas,
      horasEstimadas,
      costeManoObraEvento,
      costeManoObraPax,
      costeIngredientesPax,
      costesComplPax,
      costeTotalPax,
      costeTotalEvento,
      ingresosEvento,
      margenAbs,
      margenPct,
      foodCostPct,
      costeTotalPct,
      precioSugerido
    }
  }, [menu, pctCostesComp, tarifa])

  /* ── Handlers edición inline de precios ────────────────────────────── */
  function updatePrecioChef(paseIdx, ingIdx, nuevoPrecio) {
    setMenu(prev => {
      const next = structuredClone(prev)
      next.pases[paseIdx].ingredientes[ingIdx].precio_chef = Math.max(0, parseFloat(nuevoPrecio) || 0)
      return next
    })
  }
  function updatePrecioVenta(nuevo) {
    setMenu(prev => ({ ...prev, precio_venta_chef: Math.max(0, parseFloat(nuevo) || 0) }))
  }

  /* ── Handlers edición de ingredientes ──────────────────────────────── */
  function updateIngrediente(paseIdx, ingIdx, field, value) {
    setMenu(prev => {
      const next = structuredClone(prev)
      const num = ['cantidad', 'precio_chef', 'precio_mercasa', 'merma_custom'].includes(field)
      next.pases[paseIdx].ingredientes[ingIdx][field] = num ? Math.max(0, parseFloat(value) || 0) : value
      return next
    })
  }
  function addIngrediente(paseIdx) {
    setMenu(prev => {
      const next = structuredClone(prev)
      next.pases[paseIdx].ingredientes.push({
        nombre: 'Nuevo ingrediente',
        cantidad: 100,
        unidad: 'g',
        familia: 'verdura',
        precio_chef: 5,
        precio_mercasa: 4.5
      })
      return next
    })
  }
  function deleteIngrediente(paseIdx, ingIdx) {
    setMenu(prev => {
      const next = structuredClone(prev)
      next.pases[paseIdx].ingredientes.splice(ingIdx, 1)
      return next
    })
  }

  /* ── Handlers edición de pases ─────────────────────────────────────── */
  function updatePase(paseIdx, field, value) {
    setMenu(prev => {
      const next = structuredClone(prev)
      next.pases[paseIdx][field] = value
      return next
    })
  }
  function addPase() {
    setMenu(prev => {
      const next = structuredClone(prev)
      next.pases.push({
        nombre: 'Nuevo pase',
        tipo: 'entrante',
        copy: '',
        ingredientes: []
      })
      return next
    })
  }
  function deletePase(paseIdx) {
    if (!confirm('¿Eliminar este pase y todos sus ingredientes?')) return
    setMenu(prev => {
      const next = structuredClone(prev)
      next.pases.splice(paseIdx, 1)
      return next
    })
  }

  /* ── Aplicar precio sugerido (recalcula precio venta para mantener margen 35%) */
  function aplicarPrecioSugerido() {
    updatePrecioVenta(Math.ceil(calc.precioSugerido))
  }

  /* ─────────────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen">
      <Header />
      <BreadcrumbTabs view={view} setView={setView} menu={menu} />
      <main className="px-4 sm:px-6 lg:px-8 pb-24 pt-4 sm:pt-6 max-w-[1400px] mx-auto">
        {view === 'dashboard'  && <ViewDashboard calc={calc} menu={menu} setMenu={setMenu} updatePrecioVenta={updatePrecioVenta} setView={setView} tarifa={tarifa} setTarifa={setTarifa} />}
        {view === 'desglose'   && <ViewDesglose  calc={calc} menu={menu} updateIngrediente={updateIngrediente} addIngrediente={addIngrediente} deleteIngrediente={deleteIngrediente} updatePase={updatePase} addPase={addPase} deletePase={deletePase} pctCostesComp={pctCostesComp} setPctCostesComp={setPctCostesComp} tarifa={tarifa} setTarifa={setTarifa} updatePrecioVenta={updatePrecioVenta} aplicarPrecioSugerido={aplicarPrecioSugerido} />}
        {view === 'estacional' && <ViewEstacional menu={menu} />}
        {view === 'historico'  && <ViewHistorico calc={calc} />}
        {view === 'propuesta'  && <ViewPropuesta calc={calc} menu={menu} setMenu={setMenu} updatePrecioVenta={updatePrecioVenta} />}
      </main>
      <Footer />
    </div>
  )
}

/* ═════════════════════════════════════════════════════════════════════════
 *  HEADER · consistente con el design system del artefacto original
 * ═════════════════════════════════════════════════════════════════════════ */
function Header() {
  return (
    <header className="flex items-center justify-between px-4 sm:px-8 py-4 border-b border-bg-line bg-bg-deep/90 backdrop-blur sticky top-0 z-40">
      <div className="flex items-center gap-6 sm:gap-10">
        <div className="inline-flex items-center gap-2 font-display font-medium italic text-xl tracking-tight">
          <span className="w-2 h-2 rounded-full bg-accent shadow-[0_0_12px_rgba(200,145,90,0.6)]" />
          koda
        </div>
        <nav className="hidden md:flex gap-1 font-mono text-[11px] tracking-[0.14em] uppercase text-ink-60">
          <span className="px-2.5 py-1.5">eventos</span>
          <span className="px-2.5 py-1.5">propuestas</span>
          <span className="px-2.5 py-1.5 text-ink-100 bg-bg-elevated rounded">escandallos</span>
          <span className="px-2.5 py-1.5">cobros</span>
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden sm:block font-mono text-[10px] text-ink-60 tracking-widest">⌘K</div>
        <div className="w-8 h-8 rounded-full bg-accent-lo flex items-center justify-center font-display text-ink-100">J</div>
      </div>
    </header>
  )
}

/* ═════════════════════════════════════════════════════════════════════════ */
function BreadcrumbTabs({ view, setView, menu }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 sm:px-8 pt-5 gap-4">
      <div className="flex items-center gap-2 sm:gap-3 font-mono text-[11px] text-ink-60 tracking-[0.1em] uppercase flex-wrap">
        <span>escandallos</span>
        <span className="text-ink-40">/</span>
        <span className="text-ink-100">EVT-2026-118 · {menu.nombre}</span>
        <span className="hidden sm:inline text-ink-40">·</span>
        <span className="hidden sm:inline">{new Date(menu.fecha_servicio).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
        <span className="px-2 py-0.5 rounded-full bg-accent/15 text-accent-hi border border-accent-lo/30 tracking-[0.1em]">borrador</span>
      </div>
      <div className="flex gap-1 p-1 bg-bg-surface border border-bg-line rounded-lg overflow-x-auto no-scrollbar">
        <TabButton active={view === 'dashboard'}  onClick={() => setView('dashboard')}>Dashboard</TabButton>
        <TabButton active={view === 'desglose'}   onClick={() => setView('desglose')}>Desglose</TabButton>
        <TabButton active={view === 'estacional'} onClick={() => setView('estacional')}>Proyección</TabButton>
        <TabButton active={view === 'historico'}  onClick={() => setView('historico')}>Histórico</TabButton>
        <TabButton active={view === 'propuesta'}  onClick={() => setView('propuesta')}>Propuesta</TabButton>
      </div>
    </div>
  )
}

/* ═════════════════════════════════════════════════════════════════════════
 *  VISTA 1 · DASHBOARD
 * ═════════════════════════════════════════════════════════════════════════ */
function ViewDashboard({ calc, menu, setMenu, updatePrecioVenta, setView, tarifa, setTarifa }) {
  // Chart mini: histórico del chef con este mismo menú
  const miniHistorico = HISTORICO_CHEF
    .filter(h => h.menu.toLowerCase().startsWith('mediterráneo'))
    .map(h => ({ fecha: h.fecha.slice(5), coste: h.coste_pax }))

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
      {/* ── COLUMNA IZQUIERDA ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-5 min-w-0">

        {/* Event card + hero margen */}
        <section className="grid md:grid-cols-[1.1fr_1fr] gap-px bg-bg-line border border-bg-line rounded-2xl overflow-hidden">
          <div className="bg-bg-surface p-6 sm:p-7">
            <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-60 mb-3">Menú</div>
            <h2 className="font-display text-2xl sm:text-3xl tracking-tight leading-tight mb-1">
              {menu.nombre.split(' ').slice(0,-1).join(' ')} <i className="text-accent italic">{menu.nombre.split(' ').slice(-1)}</i>
            </h2>
            <div className="text-[13px] text-ink-60 mb-5">
              {menu.pases.length} pases · nivel {menu.nivel} · {menu.zona} · {new Date(menu.fecha_servicio).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
            </div>
            <div className="grid grid-cols-4 gap-3">
              {[
                ['Pax', menu.comensales],
                ['Pases', menu.pases.length],
                ['Zona', menu.zona.slice(0,3)],
                ['Nivel', menu.nivel.slice(0,4)]
              ].map(([l, v]) => (
                <div key={l}>
                  <div className="font-mono text-[9.5px] tracking-[0.14em] uppercase text-ink-60 mb-1">{l}</div>
                  <div className="font-display text-lg sm:text-xl">{v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative overflow-hidden p-6 sm:p-7"
               style={{ background: 'linear-gradient(155deg,#1C1712 0%,#15110D 100%)' }}>
            <div className="absolute -top-12 -right-12 w-56 h-56 rounded-full pointer-events-none"
                 style={{ background: 'radial-gradient(circle,rgba(200,145,90,0.18) 0%,transparent 70%)' }} />
            <div className="relative">
              <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-accent mb-3">Margen por comensal</div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-display font-normal text-6xl sm:text-7xl leading-none tracking-tight text-accent-hi">
                  {Math.floor(calc.margenAbs)}
                  <span className="text-ink-60 text-4xl">,{(calc.margenAbs % 1).toFixed(2).slice(2)}</span>
                </span>
                <span className="font-mono text-sm text-ink-60 ml-1">€</span>
              </div>
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-bg-line">
                <div>
                  <div className="font-mono text-[9.5px] tracking-[0.14em] uppercase text-ink-60">Margen %</div>
                  <div className={`font-display text-2xl ${margenColor(calc.margenPct)}`}>{fmtPct(calc.margenPct)}</div>
                </div>
                <div className="w-px h-8 bg-bg-line" />
                <div>
                  <div className="font-mono text-[9.5px] tracking-[0.14em] uppercase text-ink-60">Total evento</div>
                  <div className="font-display text-2xl">{fmtEuro(calc.margenAbs * menu.comensales)}</div>
                </div>
                <div className="w-px h-8 bg-bg-line" />
                <div>
                  <div className="font-mono text-[9.5px] tracking-[0.14em] uppercase text-ink-60">Coste total</div>
                  <div className={`font-display text-2xl ${calc.costeTotalPct > 70 ? 'text-ember' : 'text-ink-100'}`}>{fmtPct(calc.costeTotalPct)}</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* KPI grid — 4 métricas clave por comensal */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Ingredientes" value={fmtEuro(calc.costeIngredientesPax)} sub={`+ ${fmtEuro(calc.costesComplPax)} complement.`} />
          <KpiCard label="Mano de obra" value={fmtEuro(calc.costeManoObraPax)} sub={`${calc.horasEstimadas.toFixed(1)}h × ${fmtEuro(tarifa.precio_hora)}/h`} />
          <KpiCard label="Coste total /pax" value={fmtEuro(calc.costeTotalPax)} sub={`${fmtPct(calc.costeTotalPct)} sobre precio`} colorClass="text-ember" />
          <KpiCard label="Margen /pax" value={fmtEuro(calc.margenAbs)} sub={fmtPct(calc.margenPct) + ' de margen'} colorClass={margenColor(calc.margenPct)} />
        </section>

        {/* Tarifa del chef · slider */}
        <section className="bg-bg-surface border border-bg-line rounded-2xl p-5 sm:p-6">
          <div className="flex justify-between items-baseline mb-3 flex-wrap gap-2">
            <div>
              <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-60 mb-1">Tu tarifa</div>
              <h3 className="font-display text-lg tracking-tight">Cuánto vale tu hora</h3>
            </div>
            <div className="text-right">
              <div className="font-display text-2xl text-accent-hi">{fmtEuro(tarifa.precio_hora)}<span className="text-sm text-ink-60">/h</span></div>
              <div className="text-[10.5px] font-mono text-ink-60">= {fmtEuro(calc.costeManoObraEvento)} este evento</div>
            </div>
          </div>
          <input
            type="range" min="20" max="80" step="1"
            value={tarifa.precio_hora}
            onChange={(e) => setTarifa(t => ({ ...t, precio_hora: parseInt(e.target.value) }))}
            className="w-full"
          />
          <div className="flex justify-between font-mono text-[9.5px] text-ink-40 mt-1"><span>20 €/h</span><span>80 €/h</span></div>
          <div className="mt-4 pt-4 border-t border-bg-line grid grid-cols-3 gap-4 text-[11.5px]">
            <div><span className="text-ink-60">Prep + servicio: </span><b className="text-ink-100 font-mono">{calc.horasEstimadas.toFixed(1)}h</b></div>
            <div><span className="text-ink-60">Coste total obra: </span><b className="text-ink-100 font-mono">{fmtEuro(calc.costeManoObraEvento)}</b></div>
            <div><span className="text-ink-60">Repartido /pax: </span><b className="text-ink-100 font-mono">{fmtEuro(calc.costeManoObraPax)}</b></div>
          </div>
        </section>

        {/* Mini evolución + ajuste precio venta */}
        <section className="grid md:grid-cols-[1.4fr_1fr] gap-4">
          <div className="bg-bg-surface border border-bg-line rounded-2xl p-5 sm:p-6">
            <div className="flex justify-between items-baseline mb-4">
              <div>
                <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-60 mb-1">Este menú</div>
                <h3 className="font-display text-lg tracking-tight">Coste histórico</h3>
              </div>
              <div className="font-mono text-[10.5px] text-ink-60">3 ejecuciones anteriores</div>
            </div>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={miniHistorico} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#2A211A" vertical={false} />
                  <XAxis dataKey="fecha" tick={{ fill: '#6B6157', fontSize: 10, fontFamily: 'JetBrains Mono' }} stroke="#2A211A" />
                  <YAxis tick={{ fill: '#6B6157', fontSize: 10 }} stroke="#2A211A" domain={['dataMin - 2', 'dataMax + 2']} />
                  <Tooltip contentStyle={{ background: '#1C1712', border: '1px solid #2A211A', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#9F9486' }} formatter={(v) => fmtEuro(v)} />
                  <Line type="monotone" dataKey="coste" stroke="#C8915A" strokeWidth={2} dot={{ fill: '#E0A876', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Ajuste rápido precio venta */}
          <div className="bg-bg-surface border border-bg-line rounded-2xl p-5 sm:p-6 flex flex-col">
            <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-60 mb-3">Precio venta / pax</div>
            <div className="flex items-baseline gap-2 mb-4">
              <input
                type="number"
                min="0"
                step="1"
                value={menu.precio_venta_chef}
                onChange={(e) => updatePrecioVenta(e.target.value)}
                className="w-24 bg-bg-elevated border border-bg-line rounded-md px-3 py-2 font-display text-2xl text-ink-100 focus:border-accent transition-colors"
              />
              <span className="font-mono text-sm text-ink-60">€</span>
            </div>
            <input
              type="range" min="30" max="200" step="1"
              value={menu.precio_venta_chef}
              onChange={(e) => updatePrecioVenta(e.target.value)}
              className="w-full"
            />
            <div className="mt-3 text-[11.5px] text-ink-60">
              KODA sugiere <b className="text-accent-hi">{fmtEuro(calc.precioSugerido)}</b> para 35% margen objetivo (con tu hora dentro).
            </div>
          </div>
        </section>

        {/* CTAs */}
        <section className="grid sm:grid-cols-2 gap-3">
          <button
            onClick={() => setView('propuesta')}
            className="group flex items-center justify-between px-5 py-4 bg-bg-elevated border border-bg-line rounded-lg hover:border-accent-lo transition-colors"
          >
            <div className="flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-accent" />
              <span className="font-mono text-[11px] tracking-[0.14em] uppercase">Generar propuesta comercial</span>
            </div>
            <ArrowRight className="w-4 h-4 text-accent group-hover:translate-x-1 transition-transform" />
          </button>
          <button
            onClick={() => alert('TODO(holded): POST /api/holded/invoices con payload:\n\n' + JSON.stringify({
              concepto: menu.nombre,
              importe: calc.ingresosEvento,
              iva: 10,
              detalle: calc.lineas.slice(0, 3).map(l => l.ing.nombre)
            }, null, 2))}
            className="group flex items-center justify-between px-5 py-4 bg-accent text-bg-deep rounded-lg hover:bg-accent-hi transition-colors font-semibold"
          >
            <div className="flex items-center gap-3">
              <Receipt className="w-4 h-4" />
              <span className="font-mono text-[11px] tracking-[0.14em] uppercase">Facturar servicio</span>
            </div>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </section>
      </div>

      {/* ── ASIDE DERECHA · alertas ─────────────────────────────────── */}
      <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
        {/* Health score */}
        <div className="bg-bg-surface border border-bg-line rounded-2xl p-5">
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-60 mb-3">Salud del margen</div>
          <div className="flex items-baseline gap-2 mb-3">
            <div className={`font-display text-4xl tracking-tight leading-none ${margenColor(calc.margenPct)}`}>
              {Math.round(calc.margenPct)}
            </div>
            <div className="font-mono text-xs text-ink-60">/100</div>
          </div>
          <div className="h-1.5 bg-bg-line rounded-full overflow-hidden mb-3">
            <div className="h-full transition-all duration-500"
                 style={{
                   width: `${Math.min(100, calc.margenPct)}%`,
                   background: 'linear-gradient(90deg,#5C7355 0%,#C8915A 100%)'
                 }} />
          </div>
          <div className="text-[12.5px] leading-relaxed text-ink-80">
            {calc.margenPct >= 50
              ? <>Precio dentro de tu media. Margen sano para chef privado.</>
              : calc.margenPct >= 30
                ? <><b className="text-gold">Margen ajustado.</b> Revisa ingredientes con delta alto.</>
                : <><b className="text-ember">Food cost por encima del 40%.</b> Necesitas subir precio o revisar coste.</>
            }
          </div>
        </div>

        {/* Alertas dinámicas */}
        <AlertsPanel calc={calc} />

        {/* Sugerencia KODA */}
        <div className="border border-accent-lo rounded-2xl p-5"
             style={{ background: 'linear-gradient(155deg,rgba(200,145,90,0.18) 0%,#15110D 100%)' }}>
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-accent mb-2">KODA sugiere</div>
          <div className="font-display text-lg leading-snug tracking-tight text-ink-100 mb-3">
            {calc.margenPct < 35
              ? <>Subir a <i className="italic text-accent-hi">{fmtEuro(calc.precioSugerido)}/pax</i> para llegar al <b>35% de margen</b> objetivo</>
              : calc.margenPct < 45
                ? <>Margen saludable. Podrías tensar a <i className="italic text-accent-hi">{fmtEuro(calc.precioSugerido + 5)}</i> sin friccionar</>
                : <>Margen excelente. Este menú puede ser tu <i className="italic text-accent-hi">producto estrella</i></>
            }
          </div>
          <button
            onClick={() => updatePrecioVenta(Math.round(calc.precioSugerido))}
            className="w-full py-3 bg-accent text-bg-deep rounded-md font-sans font-semibold text-[13px] hover:bg-accent-hi transition-colors"
          >
            Aplicar {fmtEuro(calc.precioSugerido)} /pax
          </button>
        </div>
      </aside>
    </div>
  )
}

/* Alertas: se disparan según las líneas con delta rojo */
function AlertsPanel({ calc }) {
  const alertas = calc.lineas
    .filter(l => l.delta && l.delta > 15)
    .slice(0, 3)
    .map(l => ({
      color: 'ember',
      titulo: `${l.ing.nombre} +${l.delta.toFixed(0)}%`,
      texto: `Pagas ${fmtEuro(l.ing.precio_chef)}/${l.ing.unidad === 'ud' ? 'ud' : 'kg'} vs. ${fmtEuro(l.ing.precio_mercasa)} referencia Mercabarna.`
    }))
  if (alertas.length === 0) alertas.push({
    color: 'moss',
    titulo: 'Precios alineados con Mercasa',
    texto: 'Ningún ingrediente supera el 15% sobre referencia mayorista.'
  })

  return (
    <div className="bg-bg-surface border border-bg-line rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-bg-line flex justify-between items-center">
        <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-60">Avisos</div>
        <span className="font-mono text-[10px] text-accent">● {alertas.length} activos</span>
      </div>
      <div>
        {alertas.map((a, i) => (
          <div key={i} className="px-5 py-4 border-b border-bg-line last:border-b-0 flex gap-3 items-start">
            <div className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${a.color === 'ember' ? 'bg-ember' : 'bg-moss'}`} />
            <div className="min-w-0">
              <div className="text-[13px] text-ink-100 font-medium mb-0.5">{a.titulo}</div>
              <div className="text-[11.5px] text-ink-60 leading-relaxed">{a.texto}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ═════════════════════════════════════════════════════════════════════════
 *  VISTA 2 · DESGLOSE POR INGREDIENTE (tabla editable)
 * ═════════════════════════════════════════════════════════════════════════ */
function ViewDesglose({ calc, menu, updateIngrediente, addIngrediente, deleteIngrediente, updatePase, addPase, deletePase, pctCostesComp, setPctCostesComp, tarifa, setTarifa, updatePrecioVenta, aplicarPrecioSugerido }) {
  const UNIDADES = ['g', 'ml', 'ud', 'kg', 'L']
  const FAMILIAS = Object.keys(MERMA_PRESETS)
  const TIPOS_PASE = ['snack', 'entrante frío', 'entrante caliente', 'pescado', 'carne', 'guarnición', 'postre', 'petit four']

  return (
    <div className="flex flex-col gap-5">
      {/* ═════ Live summary bar (sticky) — se actualiza en tiempo real ═════ */}
      <section className="bg-bg-surface border border-bg-line rounded-2xl p-4 sm:p-5 sticky top-[92px] z-30 backdrop-blur">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 items-center">
          <div>
            <div className="font-mono text-[9.5px] uppercase text-ink-60 tracking-widest mb-0.5">Coste /pax</div>
            <div className="font-display text-lg sm:text-xl text-ember">{fmtEuro(calc.costeTotalPax)}</div>
          </div>
          <div>
            <div className="font-mono text-[9.5px] uppercase text-ink-60 tracking-widest mb-0.5">Margen /pax</div>
            <div className={`font-display text-lg sm:text-xl ${margenColor(calc.margenPct)}`}>
              {fmtEuro(calc.margenAbs)} <span className="text-[11px] text-ink-60">({fmtPct(calc.margenPct)})</span>
            </div>
          </div>
          <div>
            <div className="font-mono text-[9.5px] uppercase text-ink-60 tracking-widest mb-0.5">Precio venta actual</div>
            <div className="flex items-baseline gap-1">
              <input
                type="number" min="0" step="1"
                value={menu.precio_venta_chef}
                onChange={(e) => updatePrecioVenta(e.target.value)}
                className="w-20 bg-bg-elevated border border-bg-line rounded px-2 py-0.5 font-display text-lg text-ink-100 focus:border-accent"
              />
              <span className="text-[11px] text-ink-60">€/pax</span>
            </div>
          </div>
          <div>
            <div className="font-mono text-[9.5px] uppercase text-ink-60 tracking-widest mb-0.5">Precio sugerido</div>
            <div className="font-display text-lg text-accent-hi">{fmtEuro(calc.precioSugerido)} <span className="text-[10px] text-ink-60">para 35%</span></div>
          </div>
          <button
            onClick={aplicarPrecioSugerido}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-accent text-bg-deep rounded-md font-mono text-[10.5px] tracking-widest uppercase font-semibold hover:bg-accent-hi transition-colors"
          >
            <Zap className="w-3 h-3" /> Aplicar
          </button>
        </div>
      </section>

      {/* Config: complementarios + mano de obra */}
      <section className="bg-bg-surface border border-bg-line rounded-2xl p-5 sm:p-6 grid md:grid-cols-2 gap-6">
        <div>
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-60 mb-2">Costes complementarios</div>
          <div className="flex items-center gap-4">
            <input type="range" min="0" max="20" step="1" value={pctCostesComp}
                   onChange={(e) => setPctCostesComp(parseInt(e.target.value))}
                   className="flex-1" />
            <div className="font-display text-xl w-20 text-right">{pctCostesComp}%</div>
          </div>
          <div className="mt-2 text-[11.5px] text-ink-60">Transporte, material desechable, cocina · {fmtEuro(calc.costesComplPax)} /pax</div>
        </div>
        <div>
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-60 mb-2">Tu tarifa hora</div>
          <div className="flex items-center gap-4">
            <input type="range" min="20" max="80" step="1" value={tarifa.precio_hora}
                   onChange={(e) => setTarifa(t => ({ ...t, precio_hora: parseInt(e.target.value) }))}
                   className="flex-1" />
            <div className="font-display text-xl w-20 text-right">{fmtEuro(tarifa.precio_hora)}</div>
          </div>
          <div className="mt-2 text-[11.5px] text-ink-60">{calc.horasEstimadas.toFixed(1)}h estimadas · {fmtEuro(calc.costeManoObraPax)} /pax</div>
        </div>
      </section>

      {/* Tabla editable por pase */}
      {menu.pases.map((pase, pIdx) => {
        const lineasPase = calc.lineas.filter(l => l.paseIdx === pIdx)
        const subtotal = lineasPase.reduce((s, l) => s + l.coste_linea_pax, 0)
        return (
          <section key={pIdx} className="bg-bg-surface border border-bg-line rounded-2xl overflow-hidden">
            {/* Cabecera del pase — editable */}
            <div className="px-5 sm:px-6 py-4 border-b border-bg-line flex justify-between items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-[180px]">
                <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-60 mb-1 flex items-center gap-2">
                  <span>Pase {pIdx + 1} ·</span>
                  <select
                    value={pase.tipo}
                    onChange={(e) => updatePase(pIdx, 'tipo', e.target.value)}
                    className="bg-transparent text-ink-60 hover:text-ink-100 cursor-pointer focus:outline-none focus:text-accent"
                  >
                    {TIPOS_PASE.map(t => <option key={t} value={t} className="bg-bg-elevated">{t}</option>)}
                  </select>
                </div>
                <input
                  type="text"
                  value={pase.nombre}
                  onChange={(e) => updatePase(pIdx, 'nombre', e.target.value)}
                  className="w-full font-display text-lg tracking-tight leading-tight bg-transparent focus:bg-bg-elevated rounded px-1 -mx-1 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-mono text-[10px] uppercase text-ink-60 tracking-widest">Subtotal /pax</div>
                  <div className="font-display text-xl text-accent-hi">{fmtEuro(subtotal)}</div>
                </div>
                <button
                  onClick={() => deletePase(pIdx)}
                  title="Eliminar pase"
                  className="text-ink-40 hover:text-ember transition-colors p-2 rounded hover:bg-ember/10"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tabla editable de ingredientes */}
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] min-w-[900px]">
                <thead>
                  <tr className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-60 text-left border-b border-bg-line/50">
                    <th className="px-4 py-3 font-normal">Ingrediente</th>
                    <th className="px-2 py-3 font-normal">Cantidad</th>
                    <th className="px-2 py-3 font-normal">Ud.</th>
                    <th className="px-2 py-3 font-normal">Merma</th>
                    <th className="px-2 py-3 font-normal">Neta</th>
                    <th className="px-2 py-3 font-normal text-right">€ chef</th>
                    <th className="px-2 py-3 font-normal text-right">€ Mercasa</th>
                    <th className="px-2 py-3 font-normal text-right">Δ</th>
                    <th className="px-2 py-3 font-normal text-right">Coste /pax</th>
                    <th className="px-2 py-3 font-normal">Fuente</th>
                    <th className="px-4 py-3 font-normal text-right w-16"></th>
                  </tr>
                </thead>
                <tbody className="text-ink-80">
                  {lineasPase.length === 0 && (
                    <tr>
                      <td colSpan="11" className="px-4 py-8 text-center text-[12px] text-ink-60">
                        Este pase no tiene ingredientes. Añade el primero abajo.
                      </td>
                    </tr>
                  )}
                  {lineasPase.map((l, i) => {
                    const cantNeta = l.ing.cantidad * (1 - l.merma)
                    const unidadPrecio = l.ing.unidad === 'ud' ? '/ud' : (l.ing.unidad === 'ml' || l.ing.unidad === 'L' ? '/L' : '/kg')
                    const mermaPct = l.merma * 100
                    return (
                      <tr key={i} className="border-t border-bg-line hover:bg-bg-elevated/40 transition-colors">
                        {/* Nombre + familia */}
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={l.ing.nombre}
                            onChange={(e) => updateIngrediente(l.paseIdx, l.ingIdx, 'nombre', e.target.value)}
                            className="w-full bg-transparent text-ink-100 focus:bg-bg-elevated rounded px-1 -mx-1 focus:outline-none focus:ring-1 focus:ring-accent-lo"
                          />
                          <select
                            value={l.ing.familia}
                            onChange={(e) => updateIngrediente(l.paseIdx, l.ingIdx, 'familia', e.target.value)}
                            className="text-[10.5px] text-ink-60 bg-transparent focus:bg-bg-elevated rounded px-1 -mx-1 mt-0.5 focus:outline-none cursor-pointer hover:text-ink-80"
                          >
                            {FAMILIAS.map(f => <option key={f} value={f} className="bg-bg-elevated">{f}</option>)}
                          </select>
                        </td>
                        {/* Cantidad */}
                        <td className="px-2 py-2.5">
                          <input
                            type="number" min="0" step="1"
                            value={l.ing.cantidad}
                            onChange={(e) => updateIngrediente(l.paseIdx, l.ingIdx, 'cantidad', e.target.value)}
                            className="w-16 bg-bg-elevated border border-bg-line rounded px-2 py-1 font-mono text-ink-100 focus:border-accent transition-colors"
                          />
                        </td>
                        {/* Unidad */}
                        <td className="px-2 py-2.5">
                          <select
                            value={l.ing.unidad}
                            onChange={(e) => updateIngrediente(l.paseIdx, l.ingIdx, 'unidad', e.target.value)}
                            className="bg-bg-elevated border border-bg-line rounded px-2 py-1 font-mono text-ink-100 focus:border-accent cursor-pointer"
                          >
                            {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </td>
                        {/* Merma (editable, override) */}
                        <td className="px-2 py-2.5">
                          <div className="flex items-center gap-0.5">
                            <input
                              type="number" min="0" max="100" step="1"
                              value={mermaPct.toFixed(0)}
                              onChange={(e) => updateIngrediente(l.paseIdx, l.ingIdx, 'merma_custom', e.target.value)}
                              title={l.ing.merma_custom != null ? 'Merma personalizada' : `Preset ${l.ing.familia}`}
                              className={`w-12 bg-bg-elevated border rounded px-1.5 py-1 font-mono text-right focus:border-accent transition-colors ${
                                l.ing.merma_custom != null ? 'border-accent-lo/60 text-accent' : 'border-bg-line text-ink-60'
                              }`}
                            />
                            <span className="text-[10px] text-ink-60">%</span>
                          </div>
                        </td>
                        {/* Cant. neta (readonly) */}
                        <td className="px-2 py-2.5 font-mono text-[11.5px] text-ink-60">{cantNeta.toFixed(0)} {l.ing.unidad}</td>
                        {/* Precio chef */}
                        <td className="px-2 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number" step="0.1" min="0"
                              value={l.ing.precio_chef}
                              onChange={(e) => updateIngrediente(l.paseIdx, l.ingIdx, 'precio_chef', e.target.value)}
                              className="w-16 bg-bg-elevated border border-bg-line rounded px-2 py-1 text-right font-mono text-ink-100 focus:border-accent transition-colors"
                            />
                            <span className="text-[10px] text-ink-60">{unidadPrecio}</span>
                          </div>
                        </td>
                        {/* Precio mercasa */}
                        <td className="px-2 py-2.5 text-right">
                          <input
                            type="number" step="0.1" min="0"
                            value={l.ing.precio_mercasa || 0}
                            onChange={(e) => updateIngrediente(l.paseIdx, l.ingIdx, 'precio_mercasa', e.target.value)}
                            className="w-16 bg-transparent border border-transparent hover:border-bg-line focus:border-accent focus:bg-bg-elevated rounded px-2 py-1 text-right font-mono text-ink-60 transition-colors"
                          />
                        </td>
                        {/* Delta */}
                        <td className="px-2 py-2.5 text-right">
                          {l.delta === null
                            ? <span className="text-ink-40 font-mono">—</span>
                            : (
                              <span className={`font-mono text-[11.5px] inline-flex items-center gap-1 ${
                                l.delta > 15 ? 'text-ember' : l.delta > 0 ? 'text-gold' : 'text-moss'
                              }`}>
                                {l.delta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {l.delta > 0 ? '+' : ''}{l.delta.toFixed(1)}%
                              </span>
                            )
                          }
                        </td>
                        {/* Coste línea (readonly) */}
                        <td className="px-2 py-2.5 text-right font-mono text-ink-100 font-semibold">{fmtEuro(l.coste_linea_pax)}</td>
                        <td className="px-2 py-2.5">
                          <SourceBadge fuente="manual" />
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              title="Subir foto de albarán (visión + LLM)"
                              onClick={() => alert('TODO(albaran-vision): abrir cámara para OCR del albarán y actualizar precio_chef')}
                              className="text-ink-40 hover:text-accent transition-colors p-1"
                            >
                              <Camera className="w-3.5 h-3.5" />
                            </button>
                            <button
                              title="Eliminar ingrediente"
                              onClick={() => deleteIngrediente(l.paseIdx, l.ingIdx)}
                              className="text-ink-40 hover:text-ember transition-colors p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Botón añadir ingrediente */}
            <div className="p-3 border-t border-bg-line">
              <button
                onClick={() => addIngrediente(pIdx)}
                className="w-full py-2.5 border border-dashed border-bg-line rounded-md text-ink-60 hover:text-accent hover:border-accent-lo hover:bg-accent-lo/5 transition-colors text-[11px] font-mono tracking-[0.14em] uppercase flex items-center justify-center gap-2"
              >
                <Plus className="w-3.5 h-3.5" /> Añadir ingrediente
              </button>
            </div>
          </section>
        )
      })}

      {/* Añadir nuevo pase */}
      <section>
        <button
          onClick={addPase}
          className="w-full py-4 border-2 border-dashed border-bg-line rounded-2xl text-ink-60 hover:text-accent hover:border-accent-lo hover:bg-accent-lo/5 transition-colors text-[11px] font-mono tracking-[0.14em] uppercase flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> Añadir pase al menú
        </button>
      </section>

      {/* Totales */}
      <section className="bg-bg-elevated border border-accent-lo/40 rounded-2xl p-5 sm:p-6 grid grid-cols-2 md:grid-cols-5 gap-4">
        <div>
          <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-60">Ingredientes /pax</div>
          <div className="font-display text-xl text-accent-hi">{fmtEuro(calc.costeIngredientesPax)}</div>
        </div>
        <div>
          <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-60">+ Complement. ({pctCostesComp}%)</div>
          <div className="font-display text-xl">{fmtEuro(calc.costesComplPax)}</div>
        </div>
        <div>
          <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-60">+ Mano de obra</div>
          <div className="font-display text-xl">{fmtEuro(calc.costeManoObraPax)}</div>
        </div>
        <div>
          <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-60">= Coste total /pax</div>
          <div className="font-display text-xl text-ember">{fmtEuro(calc.costeTotalPax)}</div>
        </div>
        <div>
          <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-60">Total evento ({menu.comensales} pax)</div>
          <div className="font-display text-xl">{fmtEuro(calc.costeTotalEvento)}</div>
        </div>
      </section>
    </div>
  )
}

/* ═════════════════════════════════════════════════════════════════════════
 *  VISTA 3 · PROYECCIÓN ESTACIONAL
 *  Biblioteca de mercado (scraper) + Mi lista (watchlist personal del chef)
 *  El chef selecciona 1..N ingredientes y ve su evolución 12 meses.
 * ═════════════════════════════════════════════════════════════════════════ */

const CHART_COLORS = ['#C8915A', '#E0A876', '#B5482D', '#5C7355', '#D4B071', '#8A6238', '#9F9486', '#F5EFE6']
const IDX_SERVICIO = 11 // sep · último del array meses

// Mini-sparkline inline SVG (12 puntos, sin ejes)
function Sparkline({ data, color = '#C8915A', width = 56, height = 18 }) {
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * height
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx={width} cy={height - ((data[data.length - 1] - min) / range) * height} r="1.8" fill={color} />
    </svg>
  )
}

function ViewEstacional({ menu }) {
  // Ingredientes que están en el menú actual — para el atajo "añadir menú"
  const nombresMenu = useMemo(() => {
    const set = new Set()
    menu.pases.forEach(p => p.ingredientes.forEach(i => set.add(i.nombre)))
    return [...set]
  }, [menu])

  // ── ESTADO ───────────────────────────────────────────────────────────
  // Watchlist personal (TODO: persistir en Supabase chef.watchlist)
  const [watchlist, setWatchlist] = useState(WATCHLIST_INITIAL)
  // Ingredientes seleccionados para el gráfico (arranco con los del menú actual)
  const [selected, setSelected] = useState(() =>
    MERCADO.filter(m => nombresMenu.includes(m.nombre)).map(m => m.nombre).slice(0, 4)
  )
  // Tab de la biblioteca: mercado (todo) | milista (watchlist)
  const [libTab, setLibTab] = useState('mercado')
  const [search, setSearch] = useState('')
  const [familia, setFamilia] = useState('todas')
  // Modo del gráfico: precio absoluto vs. variación % vs media anual
  const [chartMode, setChartMode] = useState('absoluto')

  // ── DERIVADOS ────────────────────────────────────────────────────────
  const familias = useMemo(() => ['todas', ...new Set(MERCADO.map(m => m.familia))], [])

  const filtered = useMemo(() => {
    return MERCADO.filter(m => {
      if (libTab === 'milista' && !watchlist.includes(m.nombre)) return false
      if (familia !== 'todas' && m.familia !== familia) return false
      if (search && !m.nombre.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [libTab, familia, search, watchlist])

  // Data del gráfico
  const chartData = useMemo(() => {
    return meses.map((mes, i) => {
      const row = { mes }
      selected.forEach(name => {
        const m = MERCADO.find(x => x.nombre === name)
        if (!m) return
        if (chartMode === 'absoluto') {
          row[name] = m.hist[i]
        } else {
          const media = m.hist.reduce((a, b) => a + b, 0) / m.hist.length
          row[name] = ((m.hist[i] - media) / media) * 100
        }
      })
      return row
    })
  }, [selected, chartMode])

  // Insights auto-generados a partir de la selección
  const insights = useMemo(() => {
    return selected.map(name => {
      const m = MERCADO.find(x => x.nombre === name)
      if (!m) return null
      const media = m.hist.reduce((a, b) => a + b, 0) / m.hist.length
      const actual = m.hist[IDX_SERVICIO]
      const min = Math.min(...m.hist)
      const max = Math.max(...m.hist)
      const idxMin = m.hist.indexOf(min)
      const delta = ((actual - media) / media) * 100
      return { name, familia: m.familia, actual, media, min, max, idxMin, delta }
    }).filter(Boolean)
  }, [selected])

  const picos = insights.filter(i => i.delta > 12)   // >12% sobre media = pico
  const valles = insights.filter(i => i.delta < -12) // <-12% = oportunidad

  // ── HANDLERS ─────────────────────────────────────────────────────────
  function toggleSelect(name) {
    setSelected(s => s.includes(name) ? s.filter(x => x !== name) : (s.length < 8 ? [...s, name] : s))
  }
  function toggleWatch(name) {
    setWatchlist(w => w.includes(name) ? w.filter(x => x !== name) : [...w, name])
  }
  function addAllMenu() {
    const nuevos = MERCADO.filter(m => nombresMenu.includes(m.nombre)).map(m => m.nombre)
    setSelected(s => [...new Set([...s, ...nuevos])].slice(0, 8))
  }
  function clearAll() { setSelected([]) }

  return (
    <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)] items-start">

      {/* ═════════════ IZQUIERDA · BIBLIOTECA ═════════════ */}
      <aside className="flex flex-col gap-3 lg:sticky lg:top-24">
        <div className="bg-bg-surface border border-bg-line rounded-2xl overflow-hidden flex flex-col max-h-[calc(100vh-140px)]">
          {/* Header */}
          <div className="px-5 pt-5 pb-3 border-b border-bg-line">
            <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-60 mb-3">Biblioteca de precios</div>

            {/* Tab mercado / mi lista */}
            <div className="flex gap-1 p-0.5 bg-bg-elevated rounded-md mb-3">
              <button
                onClick={() => setLibTab('mercado')}
                className={`flex-1 py-1.5 rounded font-mono text-[10.5px] tracking-[0.12em] uppercase transition-colors ${
                  libTab === 'mercado' ? 'bg-bg-line text-ink-100' : 'text-ink-60 hover:text-ink-80'
                }`}
              >Mercado <span className="text-ink-40 ml-1">({MERCADO.length})</span></button>
              <button
                onClick={() => setLibTab('milista')}
                className={`flex-1 py-1.5 rounded font-mono text-[10.5px] tracking-[0.12em] uppercase transition-colors flex items-center justify-center gap-1 ${
                  libTab === 'milista' ? 'bg-bg-line text-ink-100' : 'text-ink-60 hover:text-ink-80'
                }`}
              >
                <Star className="w-3 h-3 fill-current" />
                Mi lista <span className="text-ink-40">({watchlist.length})</span>
              </button>
            </div>

            {/* Buscador */}
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-40" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar ingrediente…"
                className="w-full bg-bg-elevated border border-bg-line rounded-md pl-8 pr-3 py-2 text-[13px] focus:border-accent transition-colors"
              />
            </div>

            {/* Filtro familia */}
            <div className="flex gap-1 flex-wrap">
              {familias.map(f => (
                <button
                  key={f}
                  onClick={() => setFamilia(f)}
                  className={`px-2 py-0.5 rounded font-mono text-[10px] tracking-[0.06em] uppercase transition-colors ${
                    familia === f ? 'bg-accent-lo text-ink-100' : 'bg-bg-elevated text-ink-60 hover:text-ink-80'
                  }`}
                >{f}</button>
              ))}
            </div>
          </div>

          {/* Lista scrollable */}
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 && (
              <div className="p-6 text-center text-[12px] text-ink-60">
                {libTab === 'milista'
                  ? 'Aún no sigues ningún ingrediente. Marca la estrella en cualquiera para añadirlo.'
                  : 'Sin resultados con estos filtros.'}
              </div>
            )}
            {filtered.map(m => {
              const isSelected = selected.includes(m.nombre)
              const isWatched = watchlist.includes(m.nombre)
              const isInMenu = nombresMenu.includes(m.nombre)
              const colorIdx = selected.indexOf(m.nombre)
              const lineColor = colorIdx >= 0 ? CHART_COLORS[colorIdx % CHART_COLORS.length] : '#6B6157'
              return (
                <div key={m.nombre}
                     onClick={() => toggleSelect(m.nombre)}
                     className={`px-4 py-2.5 border-b border-bg-line last:border-b-0 flex items-center gap-3 cursor-pointer transition-colors ${
                       isSelected ? 'bg-bg-elevated' : 'hover:bg-bg-elevated/50'
                     }`}>
                  {/* Indicador color (si está seleccionado) */}
                  <div className="w-1 self-stretch rounded-full" style={{ background: isSelected ? lineColor : 'transparent' }} />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <div className={`text-[12.5px] truncate ${isSelected ? 'text-ink-100' : 'text-ink-80'}`}>{m.nombre}</div>
                      {isInMenu && <span className="font-mono text-[8.5px] px-1 py-0.5 rounded bg-accent-lo/30 text-accent-hi tracking-widest">MENÚ</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="font-mono text-[10.5px] text-ink-60">{fmtEuro(m.hist[IDX_SERVICIO])}/kg</div>
                      <div className="font-mono text-[9px] text-ink-40 uppercase tracking-wider">{m.familia}</div>
                    </div>
                  </div>

                  {/* Sparkline */}
                  <Sparkline data={m.hist} color={lineColor} />

                  {/* Star toggle watchlist */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleWatch(m.nombre) }}
                    className={`p-1 -mr-1 transition-colors ${isWatched ? 'text-accent' : 'text-ink-40 hover:text-ink-60'}`}
                    title={isWatched ? 'Quitar de Mi lista' : 'Añadir a Mi lista'}
                  >
                    <Star className={`w-3.5 h-3.5 ${isWatched ? 'fill-current' : ''}`} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Atajos */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={addAllMenu}
            className="px-3 py-2.5 bg-bg-surface border border-bg-line rounded-md text-[11px] font-mono tracking-[0.08em] uppercase text-ink-80 hover:border-accent-lo hover:text-accent transition-colors flex items-center justify-center gap-1"
          >
            <Plus className="w-3 h-3" /> Menú actual
          </button>
          <button
            onClick={clearAll}
            disabled={!selected.length}
            className="px-3 py-2.5 bg-bg-surface border border-bg-line rounded-md text-[11px] font-mono tracking-[0.08em] uppercase text-ink-60 hover:text-ember transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1"
          >
            <X className="w-3 h-3" /> Limpiar
          </button>
        </div>
      </aside>

      {/* ═════════════ DERECHA · GRÁFICO + INSIGHTS ═════════════ */}
      <div className="flex flex-col gap-5 min-w-0">

        {/* Chart */}
        <section className="bg-bg-surface border border-bg-line rounded-2xl p-5 sm:p-6">
          <div className="flex justify-between items-baseline mb-4 flex-wrap gap-3">
            <div>
              <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-60 mb-1">Proyección estacional</div>
              <h3 className="font-display text-xl tracking-tight">
                {selected.length === 0
                  ? 'Selecciona ingredientes de la biblioteca'
                  : `${selected.length} ingrediente${selected.length > 1 ? 's' : ''} · 12 meses`
                }
              </h3>
            </div>

            {/* Toggle absoluto / variación */}
            <div className="flex gap-1 p-0.5 bg-bg-elevated rounded-md">
              <button
                onClick={() => setChartMode('absoluto')}
                className={`px-3 py-1.5 rounded font-mono text-[10px] tracking-[0.12em] uppercase transition-colors ${
                  chartMode === 'absoluto' ? 'bg-bg-line text-ink-100' : 'text-ink-60'
                }`}
              >€ / kg</button>
              <button
                onClick={() => setChartMode('variacion')}
                className={`px-3 py-1.5 rounded font-mono text-[10px] tracking-[0.12em] uppercase transition-colors ${
                  chartMode === 'variacion' ? 'bg-bg-line text-ink-100' : 'text-ink-60'
                }`}
              >% vs media</button>
            </div>
          </div>

          {selected.length === 0 ? (
            <div className="h-80 flex flex-col items-center justify-center text-center gap-3 border border-dashed border-bg-line rounded-lg">
              <Sparkles className="w-6 h-6 text-ink-40" />
              <div className="text-[13px] text-ink-60 max-w-[280px]">
                Marca uno o varios ingredientes en la biblioteca para ver su evolución de precio de los últimos 12 meses.
              </div>
              <button
                onClick={addAllMenu}
                className="mt-1 px-4 py-2 bg-accent-lo/20 border border-accent-lo rounded text-[11px] font-mono tracking-widest uppercase text-accent hover:bg-accent-lo/30"
              >
                Añadir los del menú actual
              </button>
            </div>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 12, right: 24, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#2A211A" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fill: '#9F9486', fontSize: 11, fontFamily: 'JetBrains Mono' }} stroke="#2A211A" />
                  <YAxis
                    tick={{ fill: '#9F9486', fontSize: 11 }}
                    stroke="#2A211A"
                    tickFormatter={(v) => chartMode === 'absoluto' ? `${v}€` : `${v > 0 ? '+' : ''}${v.toFixed(0)}%`}
                  />
                  <Tooltip
                    contentStyle={{ background: '#1C1712', border: '1px solid #2A211A', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#E0A876', fontFamily: 'JetBrains Mono' }}
                    formatter={(v, n) => [chartMode === 'absoluto' ? `${Number(v).toFixed(2)} €/kg` : `${v > 0 ? '+' : ''}${Number(v).toFixed(1)}%`, n]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} iconType="circle" />
                  {chartMode === 'variacion' && (
                    <Line dataKey={() => 0} stroke="#6B6157" strokeDasharray="3 3" dot={false} legendType="none" />
                  )}
                  {selected.map((name, i) => (
                    <Line key={name}
                          type="monotone"
                          dataKey={name}
                          stroke={CHART_COLORS[i % CHART_COLORS.length]}
                          strokeWidth={2}
                          dot={{ r: 2.5 }}
                          activeDot={{ r: 5 }} />
                  ))}
                  {/* Marca del mes del servicio */}
                  {chartMode === 'absoluto' && selected.map((name, i) => {
                    const m = MERCADO.find(x => x.nombre === name)
                    if (!m) return null
                    return (
                      <ReferenceDot key={`dot-${name}`}
                                    x={meses[IDX_SERVICIO]}
                                    y={m.hist[IDX_SERVICIO]}
                                    r={5}
                                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                                    stroke="#F5EFE6"
                                    strokeWidth={2} />
                    )
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {selected.length > 0 && (
            <div className="mt-4 flex items-center gap-2 text-[11.5px] font-mono text-ink-60">
              <Circle className="w-2.5 h-2.5 fill-ink-100 text-ink-100" />
              Círculo blanco = mes del servicio (<b className="text-ink-100">septiembre</b>)
              <span className="text-ink-40">·</span>
              Máx. 8 ingredientes simultáneos
            </div>
          )}
        </section>

        {/* Insights: picos + valles */}
        {(picos.length > 0 || valles.length > 0) && (
          <section className="grid md:grid-cols-2 gap-4">
            {picos.length > 0 && (
              <div className="bg-bg-surface border border-ember/40 rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-bg-line flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-ember" />
                  <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ember">En pico este mes</div>
                </div>
                {picos.map(p => (
                  <div key={p.name} className="px-5 py-3 border-b border-bg-line last:border-b-0">
                    <div className="flex justify-between items-baseline">
                      <div className="text-[13px] text-ink-100">{p.name}</div>
                      <div className="font-mono text-[12px] text-ember">+{p.delta.toFixed(0)}%</div>
                    </div>
                    <div className="text-[11px] text-ink-60 mt-0.5">
                      {fmtEuro(p.actual)}/kg · media {fmtEuro(p.media)} · valle en <b className="text-ink-80">{meses[p.idxMin]}</b>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {valles.length > 0 && (
              <div className="bg-bg-surface border border-moss/40 rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-bg-line flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-moss" />
                  <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-moss">Oportunidad · buen precio</div>
                </div>
                {valles.map(p => (
                  <div key={p.name} className="px-5 py-3 border-b border-bg-line last:border-b-0">
                    <div className="flex justify-between items-baseline">
                      <div className="text-[13px] text-ink-100">{p.name}</div>
                      <div className="font-mono text-[12px] text-moss">{p.delta.toFixed(0)}%</div>
                    </div>
                    <div className="text-[11px] text-ink-60 mt-0.5">
                      {fmtEuro(p.actual)}/kg · media {fmtEuro(p.media)} · buen momento para meter en carta
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Tarjetas resumen por seleccionado */}
        {insights.length > 0 && (
          <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {insights.map((ins, i) => (
              <div key={ins.name} className="bg-bg-surface border border-bg-line rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <div className="text-[12px] text-ink-100 truncate">{ins.name}</div>
                </div>
                <div className="font-display text-xl text-ink-100 mb-0.5">
                  {fmtEuro(ins.actual)}<span className="text-xs text-ink-60">/kg</span>
                </div>
                <div className="font-mono text-[10px] text-ink-60">
                  min {fmtEuro(ins.min)} · max {fmtEuro(ins.max)}
                </div>
                <div className={`font-mono text-[10.5px] mt-1 ${
                  ins.delta > 5 ? 'text-ember' : ins.delta < -5 ? 'text-moss' : 'text-ink-60'
                }`}>
                  {ins.delta > 0 ? '+' : ''}{ins.delta.toFixed(1)}% vs media anual
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Aviso orientativo */}
        <div className="flex items-start gap-2.5 pt-3 border-t border-bg-line">
          <AlertTriangle className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
          <div className="text-[11.5px] text-ink-60 leading-relaxed">
            <b className="text-ink-80">Precios orientativos.</b> Los datos mostrados son estimaciones basadas en el mercado mayorista de referencia y pueden variar según el proveedor, la temporada, la calidad y la disponibilidad del producto. Consulta siempre el precio final con tu distribuidor antes de cerrar el escandallo.
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═════════════════════════════════════════════════════════════════════════
 *  VISTA 4 · COMPARATIVA HISTÓRICA DEL CHEF
 * ═════════════════════════════════════════════════════════════════════════ */
function ViewHistorico({ calc }) {
  const chartData = HISTORICO_CHEF.map(h => ({
    fecha: h.fecha.slice(5),
    coste_pax: h.coste_pax,
    precio_pax: h.precio_pax,
    margen: h.precio_pax - h.coste_pax,
    actual: h.actual
  }))

  // Delta últimos 3 vs. 3 anteriores
  const anteriores = HISTORICO_CHEF.slice(0, 3)
  const recientes = HISTORICO_CHEF.slice(3)
  const costeAnt = anteriores.reduce((s, h) => s + h.coste_pax, 0) / anteriores.length
  const costeRec = recientes.reduce((s, h) => s + h.coste_pax, 0) / recientes.length
  const deltaCoste = ((costeRec - costeAnt) / costeAnt) * 100

  return (
    <div className="flex flex-col gap-5">
      <section className="bg-bg-surface border border-bg-line rounded-2xl p-5 sm:p-6">
        <div className="mb-4">
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-60 mb-1">Histórico del chef</div>
          <h3 className="font-display text-xl tracking-tight">Evolución de costes y precios</h3>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#2A211A" vertical={false} />
              <XAxis dataKey="fecha" tick={{ fill: '#9F9486', fontSize: 11, fontFamily: 'JetBrains Mono' }} stroke="#2A211A" />
              <YAxis tick={{ fill: '#9F9486', fontSize: 11 }} stroke="#2A211A" tickFormatter={(v) => `${v}€`} />
              <Tooltip
                contentStyle={{ background: '#1C1712', border: '1px solid #2A211A', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#E0A876' }}
                formatter={(v) => fmtEuro(v)}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} iconType="square" />
              <Bar dataKey="coste_pax"  stackId="a" fill="#B5482D" name="Coste /pax" />
              <Bar dataKey="margen"     stackId="a" fill="#C8915A" name="Margen /pax" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Insight card */}
      <section className="bg-bg-surface border border-bg-line rounded-2xl p-5 sm:p-6">
        <div className="grid md:grid-cols-[auto_1fr] gap-4 items-start">
          <div className="p-3 rounded-xl bg-ember/15">
            <TrendingUp className="w-6 h-6 text-ember" />
          </div>
          <div>
            <div className="font-display text-lg mb-1">Tu coste medio por comensal ha subido un <span className="text-ember">+{deltaCoste.toFixed(1)}%</span> en los últimos 3 meses</div>
            <div className="text-[13px] text-ink-60 leading-relaxed">
              Principales drivers detectados: <b className="text-ink-80">gamba blanca (+12%)</b>, <b className="text-ink-80">AOVE (+9%)</b>. Si mantienes precio de venta, tu margen bajará ~4pp para final de año.
            </div>
          </div>
        </div>
      </section>

      {/* Tabla histórica */}
      <section className="bg-bg-surface border border-bg-line rounded-2xl overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-bg-line">
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-60 mb-1">Escandallos pasados</div>
          <h3 className="font-display text-lg">Últimos 6 servicios</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[560px]">
            <thead>
              <tr className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-60 text-left">
                <th className="px-4 py-3 font-normal">Fecha</th>
                <th className="px-2 py-3 font-normal">Menú</th>
                <th className="px-2 py-3 font-normal text-right">Pax</th>
                <th className="px-2 py-3 font-normal text-right">Coste /pax</th>
                <th className="px-2 py-3 font-normal text-right">Precio /pax</th>
                <th className="px-4 py-3 font-normal text-right">Margen</th>
              </tr>
            </thead>
            <tbody className="text-ink-80">
              {HISTORICO_CHEF.map((h, i) => (
                <tr key={i} className={`border-t border-bg-line ${h.actual ? 'bg-accent/5' : ''}`}>
                  <td className="px-4 py-3 font-mono">{h.fecha}</td>
                  <td className="px-2 py-3">
                    {h.menu} {h.actual && <span className="ml-2 font-mono text-[9px] px-1.5 py-0.5 rounded bg-accent/20 text-accent tracking-widest">ACTUAL</span>}
                  </td>
                  <td className="px-2 py-3 text-right font-mono">{h.pax}</td>
                  <td className="px-2 py-3 text-right font-mono text-ember">{fmtEuro(h.coste_pax)}</td>
                  <td className="px-2 py-3 text-right font-mono">{fmtEuro(h.precio_pax)}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    <span className={margenColor(h.margen_pct)}>{fmtPct(h.margen_pct)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

/* ═════════════════════════════════════════════════════════════════════════
 *  VISTA 5 · PROPUESTA (edición chef + preview cliente)
 *  El chef ajusta copy y precio, y ve en directo lo que verá el cliente
 *  cuando abra el enlace koda.chef/p/xxx
 * ═════════════════════════════════════════════════════════════════════════ */
function ViewPropuesta({ calc, menu, setMenu, updatePrecioVenta }) {
  const [mode, setMode] = useState('edicion') // edicion | cliente
  const [extras, setExtras] = useState({ maridaje: false, camarero: true, tarta: false })
  const [copyTitulo, setCopyTitulo] = useState('Una noche para Marta')
  const [copySubtitulo, setCopySubtitulo] = useState('Cocina de mercado en tu terraza. Yo cocino, tú brindas.')

  const totalExtras =
    (extras.maridaje ? 22 * menu.comensales : 0) +
    (extras.camarero ? 90 : 0) +
    (extras.tarta ? 60 : 0)

  const totalPropuesta = menu.precio_venta_chef * menu.comensales + totalExtras
  const shareUrl = `koda.chef/p/${menu.nombre.toLowerCase().slice(0,3)}-${menu.comensales}`

  return (
    <div className="flex flex-col gap-5">
      {/* Toggle chef / cliente */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 p-1 bg-bg-surface border border-bg-line rounded-lg">
          <button
            onClick={() => setMode('edicion')}
            className={`px-4 py-2 rounded-md font-mono text-[11px] tracking-[0.14em] uppercase transition-colors ${
              mode === 'edicion' ? 'bg-bg-elevated text-ink-100' : 'text-ink-60'
            }`}
          >Edición · chef</button>
          <button
            onClick={() => setMode('cliente')}
            className={`px-4 py-2 rounded-md font-mono text-[11px] tracking-[0.14em] uppercase transition-colors ${
              mode === 'cliente' ? 'bg-bg-elevated text-ink-100' : 'text-ink-60'
            }`}
          >Vista · cliente</button>
        </div>
        <div className="flex items-center gap-3 text-[11.5px] font-mono text-ink-60">
          <span className="hidden sm:inline">Enlace del cliente:</span>
          <span className="bg-bg-elevated border border-bg-line px-3 py-1.5 rounded-md text-accent">{shareUrl}</span>
          <button
            onClick={() => alert('TODO(share): copiar al portapapeles + preparar envío por WhatsApp/email\n\n' + shareUrl)}
            className="px-3 py-1.5 bg-accent text-bg-deep rounded-md font-sans font-semibold text-[11px] tracking-[0.06em]"
          >Enviar</button>
        </div>
      </div>

      {mode === 'edicion' ? (
        <PropuestaEdicion
          menu={menu} calc={calc}
          copyTitulo={copyTitulo} setCopyTitulo={setCopyTitulo}
          copySubtitulo={copySubtitulo} setCopySubtitulo={setCopySubtitulo}
          extras={extras} setExtras={setExtras}
          totalExtras={totalExtras} totalPropuesta={totalPropuesta}
          updatePrecioVenta={updatePrecioVenta}
          setMenu={setMenu}
        />
      ) : (
        <PropuestaCliente
          menu={menu}
          copyTitulo={copyTitulo}
          copySubtitulo={copySubtitulo}
          extras={extras}
          totalPropuesta={totalPropuesta}
        />
      )}
    </div>
  )
}

/* ── Sub-vista: edición (chef) ────────────────────────────────────────── */
function PropuestaEdicion({ menu, calc, copyTitulo, setCopyTitulo, copySubtitulo, setCopySubtitulo, extras, setExtras, totalExtras, totalPropuesta, updatePrecioVenta, setMenu }) {
  function updatePaseCopy(pIdx, newCopy) {
    setMenu(prev => {
      const next = structuredClone(prev)
      next.pases[pIdx].copy = newCopy
      return next
    })
  }
  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
      {/* Center: preview A4 editable */}
      <div className="bg-ink-100 text-[#2a211a] rounded-xl shadow-2xl overflow-hidden">
        <div className="p-8 sm:p-12 lg:p-16">
          {/* Header */}
          <div className="flex justify-between items-start pb-6 border-b border-[#2a211a]/15">
            <div>
              <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[#2a211a]/55 mb-3">Propuesta gastronómica · EVT-2026-118</div>
              <input
                type="text"
                value={copyTitulo}
                onChange={(e) => setCopyTitulo(e.target.value)}
                className="w-full bg-transparent font-display text-3xl sm:text-4xl tracking-tight leading-tight text-[#1a1208] focus:outline-none focus:bg-[#f5efe6] rounded px-1 -mx-1"
              />
            </div>
            <div className="font-display italic text-xl text-accent-lo shrink-0 ml-4">koda</div>
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-6 border-b border-[#2a211a]/15">
            {[
              ['Fecha', new Date(menu.fecha_servicio).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })],
              ['Lugar', menu.cliente?.direccion || menu.zona],
              ['Comensales', `${menu.comensales} personas`],
              ['Servicio', `${menu.cliente?.hora || '21:00'} · ${menu.cliente?.duracion_h || 4}h`]
            ].map(([l, v]) => (
              <div key={l}>
                <div className="font-mono text-[9.5px] tracking-[0.16em] uppercase text-[#2a211a]/50 mb-1">{l}</div>
                <div className="font-display text-sm sm:text-base">{v}</div>
              </div>
            ))}
          </div>

          {/* Subtítulo editable */}
          <div className="pt-6">
            <textarea
              value={copySubtitulo}
              onChange={(e) => setCopySubtitulo(e.target.value)}
              rows={2}
              className="w-full bg-transparent text-base italic text-[#2a211a]/75 focus:outline-none focus:bg-[#f5efe6] rounded px-1 -mx-1 resize-none"
            />
          </div>

          {/* Menú — cada pase con copy editable */}
          <div className="py-8">
            <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-accent-lo mb-2">Menú</div>
            <h2 className="font-display text-2xl sm:text-3xl tracking-tight mb-8">{menu.nombre}</h2>
            <div className="flex flex-col divide-y divide-[#2a211a]/10">
              {menu.pases.map((p, i) => (
                <div key={i} className="grid grid-cols-[80px_1fr] gap-4 sm:gap-6 py-5">
                  <div className="font-mono text-[9.5px] tracking-[0.14em] uppercase text-[#2a211a]/55 pt-1">Pase {i + 1}</div>
                  <div>
                    <div className="font-display text-base sm:text-lg tracking-tight leading-tight mb-1">{p.nombre}</div>
                    <textarea
                      value={p.copy || ''}
                      onChange={(e) => updatePaseCopy(i, e.target.value)}
                      rows={2}
                      placeholder="Añade una descripción evocadora para el cliente..."
                      className="w-full bg-transparent text-[13px] text-[#2a211a]/65 focus:outline-none focus:bg-[#f5efe6] rounded px-1 -mx-1 resize-none leading-relaxed"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Extras seleccionados */}
          {totalExtras > 0 && (
            <div className="py-6 border-t border-[#2a211a]/15">
              <div className="font-mono text-[10px] tracking-[0.16em] uppercase text-[#2a211a]/55 mb-3">Extras incluidos</div>
              <div className="flex flex-wrap gap-2">
                {extras.maridaje && <span className="px-3 py-1.5 bg-[#f0e8d9] rounded-full text-[12px]">Maridaje 3 vinos</span>}
                {extras.camarero && <span className="px-3 py-1.5 bg-[#f0e8d9] rounded-full text-[12px]">Camarero de sala 4h</span>}
                {extras.tarta && <span className="px-3 py-1.5 bg-[#f0e8d9] rounded-full text-[12px]">Tarta cumpleaños</span>}
              </div>
            </div>
          )}

          {/* Precio block */}
          <div className="mt-6 p-6 sm:p-8 bg-[#f0e8d9] rounded-xl grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-center">
            <div>
              <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[#2a211a]/55 mb-2">Inversión</div>
              <div className="font-display text-lg sm:text-xl">Menú completo · producto, elaboración y servicio</div>
              <div className="text-[13px] text-[#2a211a]/65 mt-1">IVA incluido · Reserva con 30% anticipo</div>
            </div>
            <div className="text-left sm:text-right">
              <div className="font-display text-4xl sm:text-5xl tracking-tight leading-none text-[#1a1208]">
                {menu.precio_venta_chef}
                <span className="text-xl text-[#2a211a]/55"> €/pax</span>
              </div>
              <div className="font-mono text-[11px] text-[#2a211a]/55 mt-2">{menu.comensales} pax · <b className="text-[#1a1208]">{fmtEuro(totalPropuesta)}</b></div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-dashed border-[#2a211a]/20 flex justify-between font-mono text-[10.5px] text-[#2a211a]/55">
            <span>Propuesta válida 15 días · Firma digital al aceptar</span>
            <span>1/1</span>
          </div>
        </div>
      </div>

      {/* Right sidebar: inspector */}
      <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
        {/* Precio inspector */}
        <div className="bg-bg-surface border border-bg-line rounded-2xl p-5">
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-60 mb-3">Precio · Inspector</div>
          <div className="flex items-baseline gap-2 mb-3">
            <input
              type="number" min="0" step="1"
              value={menu.precio_venta_chef}
              onChange={(e) => updatePrecioVenta(e.target.value)}
              className="w-24 bg-bg-elevated border border-bg-line rounded-md px-3 py-2 font-display text-2xl text-ink-100 focus:border-accent"
            />
            <span className="font-mono text-sm text-ink-60">€/pax</span>
          </div>
          <div className="text-[12px] space-y-1.5 mt-3">
            <div className="flex justify-between"><span className="text-ink-60">Menú × {menu.comensales}</span><span className="font-mono">{fmtEuro(menu.precio_venta_chef * menu.comensales)}</span></div>
            <div className="flex justify-between"><span className="text-ink-60">Extras</span><span className="font-mono">{fmtEuro(totalExtras)}</span></div>
            <div className="flex justify-between pt-2 border-t border-bg-line"><span className="text-ink-60">Coste predicho</span><span className="font-mono text-ember">{fmtEuro(calc.costeTotalEvento)}</span></div>
            <div className="flex justify-between pt-2 border-t border-dashed border-bg-line">
              <span className="font-mono text-[10px] uppercase tracking-widest text-accent">Margen</span>
              <span className="font-display text-lg text-accent-hi">{fmtEuro(totalPropuesta - calc.costeTotalEvento)}</span>
            </div>
          </div>
        </div>

        {/* Extras */}
        <div className="bg-bg-surface border border-bg-line rounded-2xl p-5">
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-60 mb-3">Extras sugeridos</div>
          {[
            { key: 'maridaje', label: 'Maridaje 3 vinos', sub: `+22 €/pax · +${fmtEuro(22 * menu.comensales)}` },
            { key: 'camarero', label: 'Camarero de sala', sub: '+90 € · 4h' },
            { key: 'tarta',    label: 'Tarta cumpleaños', sub: '+60 € · 10 raciones' }
          ].map(x => (
            <label key={x.key} className="flex gap-3 items-start py-2.5 border-b border-bg-line last:border-b-0 cursor-pointer">
              <input
                type="checkbox"
                checked={extras[x.key]}
                onChange={(e) => setExtras(v => ({ ...v, [x.key]: e.target.checked }))}
                className="mt-1 accent-accent"
              />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] text-ink-100">{x.label}</div>
                <div className="text-[11.5px] text-ink-60 mt-0.5">{x.sub}</div>
              </div>
            </label>
          ))}
        </div>

        {/* Copy assist */}
        <div className="border border-accent-lo rounded-2xl p-5"
             style={{ background: 'linear-gradient(155deg,rgba(200,145,90,0.18) 0%,#15110D 100%)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-accent">Copy assist</div>
          </div>
          <div className="text-[12.5px] text-ink-80 leading-relaxed mb-3">
            Las descripciones editables se copian directamente a la vista cliente. Un buen copy sube la conversión un ~30%.
          </div>
          <button className="w-full py-2.5 bg-accent text-bg-deep rounded-md font-semibold text-[12px]">
            Regenerar con IA
          </button>
        </div>
      </aside>
    </div>
  )
}

/* ── Sub-vista: preview cliente ───────────────────────────────────────── */
function PropuestaCliente({ menu, copyTitulo, copySubtitulo, extras, totalPropuesta }) {
  const romanos = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii']
  return (
    <div className="max-w-4xl mx-auto w-full">
      <div className="text-center mb-4 font-mono text-[10px] tracking-[0.18em] uppercase text-ink-60">
        esto es lo que ve el cliente al abrir el enlace
      </div>
      <div className="bg-ink-100 text-[#2a211a] rounded-2xl shadow-2xl overflow-hidden">

        {/* HERO */}
        <div className="p-10 sm:p-16 lg:p-20 relative overflow-hidden"
             style={{ background: 'linear-gradient(155deg,#f5efe6 0%,#e8dcc8 100%)' }}>
          <div className="absolute -top-16 -right-16 w-96 h-96 rounded-full pointer-events-none"
               style={{ background: 'radial-gradient(circle,rgba(200,145,90,0.25) 0%,transparent 65%)' }} />
          <div className="flex justify-between items-start mb-10 sm:mb-16 relative">
            <div className="font-display italic text-2xl text-accent-lo">
              <span className="inline-block w-2 h-2 rounded-full bg-accent mr-1.5 -translate-y-0.5"></span>koda
            </div>
            <div className="text-right font-mono text-[10.5px] tracking-[0.14em] uppercase text-[#2a211a]/60 leading-relaxed">
              Para <b className="text-[#1a1208]">{menu.cliente?.nombre || 'ti'}</b><br />
              {new Date(menu.fecha_servicio).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
          </div>
          <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-accent-lo mb-4 relative">Propuesta para vuestra noche</div>
          <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl tracking-tight leading-[0.95] text-[#1a1208] mb-5 relative">
            {copyTitulo}
          </h1>
          <p className="text-base sm:text-lg leading-relaxed text-[#2a211a]/75 max-w-xl relative">
            {copySubtitulo}
          </p>
        </div>

        {/* CHEF */}
        <div className="px-10 sm:px-20 py-10 sm:py-14 border-b border-[#2a211a]/10 grid grid-cols-[auto_1fr] gap-6 sm:gap-8 items-center">
          <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-full flex items-center justify-center font-display text-3xl sm:text-4xl text-ink-100"
               style={{ background: 'linear-gradient(155deg,#8A6238,#5a3d20)' }}>J</div>
          <div>
            <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[#2a211a]/55 mb-2">Vuestro chef</div>
            <div className="font-display text-xl sm:text-2xl tracking-tight mb-1">Javi Sánchez</div>
            <div className="text-[13px] sm:text-[14px] text-[#2a211a]/70 leading-relaxed">12 años de cocina, 4 en catering privado. Producto de mercado, técnica de casa. 187 eventos, 4,9 ★.</div>
          </div>
        </div>

        {/* MENU */}
        <div className="px-10 sm:px-20 py-14 sm:py-16">
          <div className="text-center mb-10">
            <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-accent-lo mb-2">El menú</div>
            <h2 className="font-display text-3xl sm:text-5xl tracking-tight leading-none text-[#1a1208]">{menu.nombre}</h2>
          </div>
          <div className="flex flex-col">
            {menu.pases.map((p, i) => (
              <div key={i} className="grid grid-cols-[60px_1fr] sm:grid-cols-[80px_1fr] gap-4 sm:gap-8 py-6 border-t border-[#2a211a]/12">
                <div className="font-display italic text-2xl sm:text-3xl text-accent-lo leading-none pt-1">{romanos[i]}</div>
                <div>
                  <div className="font-mono text-[9.5px] tracking-[0.16em] uppercase text-[#2a211a]/50 mb-1.5">{p.tipo}</div>
                  <div className="font-display text-lg sm:text-2xl tracking-tight leading-snug mb-1.5">{p.nombre}</div>
                  <div className="text-[13px] sm:text-[14px] text-[#2a211a]/65 leading-relaxed">{p.copy}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Extras */}
        {(extras.maridaje || extras.camarero || extras.tarta) && (
          <div className="px-10 sm:px-20 py-10 border-t border-[#2a211a]/10">
            <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-accent-lo mb-4 text-center">Incluye también</div>
            <div className="flex flex-wrap gap-3 justify-center">
              {extras.maridaje && <div className="px-4 py-2 bg-[#f0e8d9] rounded-full text-[13px]">✦ Maridaje 3 vinos</div>}
              {extras.camarero && <div className="px-4 py-2 bg-[#f0e8d9] rounded-full text-[13px]">✦ Camarero de sala</div>}
              {extras.tarta    && <div className="px-4 py-2 bg-[#f0e8d9] rounded-full text-[13px]">✦ Tarta de cumpleaños</div>}
            </div>
          </div>
        )}

        {/* PRECIO + CTA */}
        <div className="px-10 sm:px-20 py-14 sm:py-16 text-center"
             style={{ background: 'linear-gradient(155deg,#1a1208 0%,#2a211a 100%)' }}>
          <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-accent-hi mb-4">Vuestra inversión</div>
          <div className="font-display text-5xl sm:text-7xl tracking-tight text-ink-100 leading-none mb-2">
            {menu.precio_venta_chef}<span className="text-3xl text-ink-60"> €/pax</span>
          </div>
          <div className="font-mono text-[13px] text-ink-60 mb-8">
            {menu.comensales} personas · total <b className="text-ink-100">{fmtEuro(totalPropuesta)}</b> · IVA incluido
          </div>
          <button className="px-8 py-4 bg-accent text-bg-deep rounded-lg font-semibold text-[14px] tracking-[0.04em] hover:bg-accent-hi transition-colors">
            Reservar con 30% de anticipo
          </button>
          <div className="mt-4 font-mono text-[10.5px] text-ink-60">O responde este enlace con tus dudas · Chef responde en 24h</div>
        </div>

        {/* Footer */}
        <div className="px-10 sm:px-20 py-6 flex justify-between font-mono text-[10px] tracking-[0.1em] uppercase text-[#2a211a]/50 border-t border-[#2a211a]/10">
          <span>Propuesta válida 15 días</span>
          <span>koda.chef</span>
        </div>
      </div>
    </div>
  )
}

/* ═════════════════════════════════════════════════════════════════════════ */
function Footer() {
  return (
    <footer className="text-center py-6 text-[10.5px] font-mono text-ink-40 tracking-widest border-t border-bg-line mt-8">
      KODA · escandallo predictivo v1 · demo · <ChefHat className="inline w-3 h-3 -mt-0.5" /> hecho para chefs privados
    </footer>
  )
}
