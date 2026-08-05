# IslaVisual

Plataforma clínica privada para el cuerpo facultativo de oftalmología de un
hospital. Cada médico dispone de su propia carpeta clínica (consultable por
la totalidad del equipo, modificable exclusivamente por su médico titular),
con carpetas de pacientes en su interior, hoja de cargo y seguimiento
fotográfico de procedimientos quirúrgicos.

Desarrollado por **爪丨匚卄乇.studios**.

## Stack

- **Backend:** Node.js 22+ con Express (routing/multipart) y `node:sqlite`
  nativo para persistencia — el mismo patrón usado en Zona Beats / El
  Dayli-cio: mínimas dependencias externas, todo lo demás nativo
  (`node:crypto` para contraseñas y sesiones, `node:sqlite` en modo WAL).
- **Frontend:** SPA en JavaScript vanilla, sin frameworks pesados, con
  transición de "apertura de iris" entre pantallas y diseño pensado para
  verse profesional en un contexto clínico.
- **Fotos:** `multer` para subida de archivos (JPG/PNG/WEBP, máx 15MB c/u),
  servidas solo a facultativos autenticados (no son públicas).
- **Respaldos:** copia del `.db` cada 6 horas + respaldo manual desde el
  panel de administración, con restauración de un clic (igual que en Zona
  Beats).

## Instalación local

```bash
npm install
cp .env.example .env   # opcional en local
npm start
```

Abre `http://localhost:3000`. El **primer facultativo que se registre queda
como administrador automáticamente** (no hace falta configurar nada
aparte). Desde el panel de administración se pueden conferir o revocar
prerrogativas administrativas a otros médicos.

Para desarrollo con recarga automática: `npm run dev`.

## Estructura

```
src/
  server.js            -> arranque, middlewares, rutas estáticas
  db.js                 -> esquema SQLite (WAL mode para alta concurrencia)
  auth-utils.js         -> hashing de contraseñas (scrypt nativo)
  auth-middleware.js    -> sesiones por cookie, tabla `sessions`
  backup.js             -> respaldos automáticos/manuales y restauración
  routes/
    auth.js              -> registro / login / logout
    doctors.js            -> carpetas clínicas (listar, modificar solo el médico titular)
    patients.js           -> pacientes (listar/consignar/modificar/suprimir)
    photos.js              -> registro fotográfico (incorporar/modificar/suprimir)
    admin.js               -> facultativos y respaldos
public/
  index.html, css/, js/app.js  -> SPA completa
```

## Reglas de permisos (igual que en el hospital real)

- Cualquier facultativo autenticado puede **consultar** cualquier carpeta
  clínica y cualquier expediente/registro fotográfico en su interior.
- Solo el **médico titular** de una carpeta puede: modificar su
  denominación, incorporar/modificar/suprimir pacientes en su interior, e
  incorporar/modificar/suprimir el registro fotográfico de esos pacientes.
- El **criterio de ordenamiento de la lista de pacientes** (alfabético o
  cronológico) tiene un valor predeterminado que solo el médico titular
  puede fijar para su carpeta; cualquier otro facultativo que la consulte
  puede cambiar la vista a su preferencia sin afectar lo que ven los demás.
- El **panel de administración** (`/#/admin`) solo es visible para usuarios
  con `is_admin = 1` y permite consultar la totalidad del cuerpo
  facultativo registrado, conferir o revocar prerrogativas administrativas,
  suprimir cuentas y gestionar respaldos.

## Desplegar en Railway (con datos persistentes)

1. Sube este proyecto a un repositorio y conéctalo en Railway, o usa
   `railway up` desde esta carpeta.
2. En el proyecto de Railway, ve a **Settings → Volumes** y crea un volumen,
   por ejemplo montado en `/app/persist`.
3. En **Variables**, agrega:
   ```
   DATA_DIR=/app/persist/data
   UPLOADS_DIR=/app/persist/uploads/photos
   BACKUP_DIR=/app/persist/backups
   ```
4. Railway detecta `package.json` y corre `npm start` automáticamente. No
   hace falta Dockerfile.
5. Cada vez que hagas un deploy/actualización, la base de datos, las fotos
   y los respaldos **no se borran** porque viven en el volumen, no en el
   contenedor.

### Respaldos y recuperación

- Se genera un respaldo automático a los pocos segundos de arrancar el
  servidor y luego cada 6 horas (se conservan los últimos 30).
- Desde **Panel de administración → Respaldos** se puede generar uno
  manual en cualquier momento, descargarlo, o restaurarlo con un clic.
  Antes de restaurar, la aplicación consigna automáticamente una copia de
  seguridad del estado actual, por si fuese necesario revertir la
  restauración.

## Sobre la capacidad para 500+ facultativos simultáneos

- SQLite en modo **WAL** permite muchas lecturas concurrentes sin bloquear
  al que está escribiendo (la mayoría del tráfico en esta app es lectura:
  consultar carpetas, pacientes, fotos).
- El servidor Express no cae ante errores individuales: hay manejadores
  globales de `unhandledRejection` / `uncaughtException` y un middleware
  de errores centralizado, así que un fallo en una petición no tumba las
  demás conexiones activas.
- Las sesiones se limpian automáticamente cada hora y las fotos se sirven
  con cache-control razonable para no saturar el proceso.
- Si en el futuro el hospital crece mucho más allá de 500 usuarios
  concurrentes, el siguiente paso natural sería mover a Postgres, pero
  para este caso de uso (un equipo médico, tráfico en ráfagas durante el
  horario laboral) SQLite en WAL es más que suficiente y evita la
  complejidad y el costo de una base de datos gestionada aparte.

## Notas de seguridad

- Las contraseñas se guardan con `scrypt` (nativo de Node), nunca en texto
  plano.
- La cookie de sesión incluye el flag `Secure` automáticamente cuando la
  app corre bajo HTTPS (como en Railway).
- Las fotografías clínicas **no son públicas**: solo se sirven a
  facultativos con sesión activa (`/media/photos/:archivo` exige
  autenticación).
- Las sesiones expiran a los 30 días y se pueden cerrar manualmente.

## Auditoría de QA (bugs corregidos)

Antes de la entrega se realizó una revisión de errores visuales y
funcionales en móvil y escritorio. Resumen de lo encontrado y corregido:

- **Desbordamiento de la topbar en móvil:** con textos largos, la barra
  superior no cabía en pantallas angostas y producía scroll horizontal.
  Se comprimió el diseño y el nombre completo se oculta en pantallas muy
  pequeñas (queda el avatar con iniciales + tooltip).
- **Fechas de fotos incorrectas en la zona horaria de Cuba:** el
  formateador forzaba las fechas a UTC, lo que corría un día hacia atrás
  las fechas de fotos para cualquier facultativo en un huso horario detrás
  de UTC (Cuba es UTC-5). Se corrigió para parsear la fecha como fecha
  local.
- **Denominación personalizada de carpeta que se autoborraba:** el
  formulario de edición no distinguía el título ya resuelto del valor
  crudo guardado, así que guardar sin retocar ese campo lo vaciaba. Se
  expone el valor crudo por separado en la API.
- **Zoom táctil bloqueado:** el `viewport` impedía el pinch-to-zoom,
  crítico para examinar fotografías de cirugía en el celular.
- **Contraste insuficiente:** el dorado usado como color de texto (fechas,
  etiquetas) rendía ~3:1 sobre fondo claro, por debajo del mínimo WCAG AA
  (4.5:1). Se introdujo un tono de dorado más oscuro reservado para texto.
- **Áreas táctiles pequeñas y hover "pegado":** los botones de ícono
  medían 34px (por debajo del mínimo táctil recomendado de 44px), y los
  efectos de :hover en las tarjetas quedaban activados tras tocar en
  pantallas táctiles. Se ampliaron las áreas táctiles y se limitó :hover a
  dispositivos con puntero real.
- **`<select>` con apariencia nativa inconsistente:** se normalizó con una
  flecha propia para que luzca igual en iOS, Android y escritorio.
- **Accesibilidad de teclado:** las tarjetas de carpetas y pacientes no
  eran alcanzables con Tab ni tenían foco visible; ahora son activables
  por teclado (Enter/Espacio) con anillo de foco visible.
- **Tabla del panel de administración sin pista de scroll:** en móvil se
  puede desplazar horizontalmente pero no había ninguna indicación visual
  de ello; se añadió un texto de ayuda.
