# 🧮 Calculadora de costes de impresión 3D

App web **súper ligera** para calcular el coste real de tus impresiones 3D.
Todo el cálculo (y el parseo del gcode) ocurre **en el navegador**: sin backend,
sin base de datos. Construida con **[Astro](https://astro.build)**, que **compila
a HTML/CSS/JS estático** — el servidor solo sirve ficheros. Pensada para funcionar
en una **Raspberry Pi** sin apenas consumir recursos (imagen final `nginx:alpine-slim`,
~12 MB; ~6-8 MB de RAM). El build con Node ocurre dentro del Docker y **se descarta**:
la imagen que corre en la Pi no lleva Node ni dependencias.

## Características

- **Datos básicos**: peso de filamento, tiempo de impresión, coste de material y energía.
- **Opciones avanzadas** (opcionales): amortización de la máquina, mano de obra
  (preparación + postprocesado), consumibles, tasa de fallos, margen de beneficio e IVA.
- **Subida de gcode**: extrae peso y tiempo automáticamente. Soporta
  **PrusaSlicer, SuperSlicer, OrcaSlicer, Bambu Studio y Cura**.
- **Precio de la luz de hoy**: botón que trae el **PVPC medio del día** desde la
  API oficial de REE (ESIOS). Sin token. La llamada la hace tu navegador.
- **Perfiles guardables** de impresoras (potencia, precio, vida útil) y de materiales
  (tipo, precio, densidad, diámetro), para no reescribir los datos cada vez.
- **Exportar presupuesto**: copiar al portapapeles, descargar `.txt` o imprimir a PDF.
- **Desglose visual** con % por línea y gráfico de tarta, precio de venta y coste por pieza.
- Del gcode también saca (si están): nº de capas, altura de capa y aviso multicolor.
- **Bilingüe (ES/EN)** con detección automática del idioma del navegador y cambio manual.
- Tema claro/oscuro. Los valores se guardan en tu navegador (`localStorage`).

## Uso rápido (Docker)

```bash
docker compose up -d --build
```

Y abre `http://TU_SERVIDOR:8088` (cambia el puerto en `docker-compose.yml` si quieres).

### Sin compose

```bash
docker build -t costes3d .
docker run -d -p 8088:80 --restart unless-stopped --name costes3d costes3d
```

## Ligereza (Raspberry Pi)

Está afinada para consumir lo mínimo:

- **nginx con 1 solo worker** y sin log de accesos (`nginx.conf`) → ~6-8 MB de RAM.
- **Solo sirve archivos estáticos**: 0 % de CPU en reposo.
- **Topes en `docker-compose.yml`**: `mem_limit: 32m` y `cpus: 0.5`, así nunca puede
  robar recursos a tus otros servicios aunque quisiera.

Para comprobar el consumo real en tu Pi:

```bash
docker stats --no-stream costes3d
```

Y para validar la config de nginx:

```bash
docker exec costes3d nginx -t
```

> **Aviso Raspberry Pi**: en Raspberry Pi OS los límites de memoria de Docker suelen estar
> desactivados por defecto. Si `docker stats` muestra el `LIMIT` como la RAM total (no 32 MB),
> añade `cgroup_enable=memory cgroup_memory=1` al final de la única línea de
> `/boot/firmware/cmdline.txt` (o `/boot/cmdline.txt` en versiones antiguas) y reinicia.
> Aun sin ese ajuste la app funciona igual; solo no se aplicaría el tope (y consume tan poco
> que en la práctica da igual).

## Desarrollo local

Requiere Node 18+ (solo para desarrollar; en producción se sirve estático).

```bash
npm install       # instala Astro y dependencias de desarrollo
npm run dev        # servidor de desarrollo con recarga en caliente (http://localhost:4321)
npm run build      # compila a dist/ (lo que sirve nginx)
npm run preview    # sirve el dist/ ya compilado, como en producción
```

## Tests

La lógica pura (parseo de gcode, cálculos, PVPC) vive en `src/lib/`, separada del
DOM, y se prueba con el runner nativo de Node (sin dependencias de test):

```bash
npm test           # equivale a: node --test
```

## Estructura

```
src/
├── lib/               Lógica pura y testeable (sin DOM)
│   ├── parse.js       Helpers de parseo (HMS, listas, números ES)
│   ├── gcode.js       Parser de gcode + resolución de gramos
│   ├── pricing.js     Cálculo de costes y reparto en %
│   ├── budget.js      Presupuesto en texto plano (ES/EN)
│   ├── pvpc.js        Parseo del PVPC de REE
│   ├── i18n.js        Traducciones ES/EN
│   ├── materials.js   Tabla de materiales
│   └── index.js       Barrel (punto único de importación)
├── components/        Piezas de UI (.astro): tarjetas, cabecera, resultados
├── layouts/Base.astro Shell del documento (head, estilos, script)
├── pages/index.astro  Única página, compone los componentes
├── scripts/app.js     Capa de interfaz (DOM), importa de lib/
└── styles/global.css  Estilos (tema claro/oscuro)
tests/                 Tests con node:test (no se incluyen en la imagen)
astro.config.mjs       Config de Astro (salida estática)
nginx.conf             Config de nginx (caché de assets con hash)
Dockerfile             Build multi-stage: Node compila -> nginx sirve
docker-compose.yml
```

## Modelo de cálculo

```
Material      = peso(g) / 1000 · precio(€/kg)
Energía       = potencia(W) / 1000 · tiempo(h) · precio(€/kWh)
Amortización  = (precio_máquina / vida_útil_h) · tiempo(h)
Coste directo = Material + Energía + Amortización + Consumibles
Fallos        = Coste directo · tasa_fallos%
Mano de obra  = (preparación + postprocesado)(min) / 60 · coste_hora(€/h)

Coste total   = Coste directo + Fallos + Mano de obra
Margen        = Coste total · margen%
PVP           = (Coste total + Margen) · (1 + IVA%)
```
