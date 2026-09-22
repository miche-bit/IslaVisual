# IslaVisual

Plataforma clínica privada para el cuerpo facultativo de oftalmología de un
hospital. Cada médico dispone de su propia carpeta clínica (consultable por
la totalidad del equipo, modificable exclusivamente por su médico titular),
con carpetas de pacientes en su interior, hoja de cargo y seguimiento
fotográfico de procedimientos quirúrgicos.

Desarrollado por **爪丨匚卄乇.studios**.


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
- La **Biblioteca Clínica** (`/#/biblioteca`) es consultable por la
  totalidad del cuerpo facultativo autenticado; la incorporación,
  modificación y supresión de material (imágenes, video, documentos) es
  prerrogativa exclusiva del cuerpo administrativo. Admite archivos de
  hasta 150MB.

