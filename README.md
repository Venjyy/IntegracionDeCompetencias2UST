# ClockIn — Sistema de Registro de Asistencia (MVP)

Prototipo funcional desarrollado para el **Avance N°1** de la actividad *Análisis y codificación de clases* (IEI-094, Semana 2).

## Caso

Empresa de 25 trabajadores que necesita un MVP de escritorio/web para registrar la asistencia de su personal: marcaje de entrada/salida, reportes de cumplimiento horario y administración de usuarios.

## Requerimientos cubiertos

| ID | Requerimiento | Dónde se implementa |
|---|---|---|
| CA-01 | Login y marcaje de entrada/salida | Vista *Marcaje*, clase `Sistema.marcar()` |
| RE-01 | Reporte de atrasos (entrada > 09:30) | Vista *Admin → Atrasos*, clase `Reporte.atrasos()` |
| RE-02 | Reporte de salidas anticipadas (salida < 17:30) | Vista *Admin → Salidas anticipadas*, clase `Reporte.salidasAnticipadas()` |
| RE-03 | Reporte de inasistencias | Vista *Admin → Inasistencias*, clase `Reporte.inasistencias()` |
| GU-01 | Crear usuario | Vista *Admin → Usuarios*, clase `Administrador.crearUsuario()` |
| GU-02 | Modificar usuario | Vista *Admin → Usuarios*, clase `Administrador.modificarUsuario()` |
| GU-03 | Eliminar usuario | Vista *Admin → Usuarios*, clase `Administrador.eliminarUsuario()` |

## Clases extraídas del caso

- **`Usuario`** — datos base de una cuenta (nombre, correo, contraseña, rol).
- **`Administrador`** *(extiende `Usuario`)* — agrega las operaciones CRUD sobre usuarios (GU-01/02/03).
- **`RegistroAsistencia`** — una marca diaria de entrada/salida de un usuario.
- **`Reporte`** — clase de utilidades (métodos estáticos) que genera los reportes RE-01, RE-02 y RE-03 a partir de los registros del sistema.
- **`Sistema`** — controlador central: maneja autenticación, marcaje, CRUD de usuarios y disparo de reportes.

## Estructura del proyecto

```
mvp-asistencia/
├── index.html   # Estructura: login, marcaje, panel admin
├── style.css    # Estilos (paleta y tipografía propias del proyecto)
├── script.js    # Clases del dominio + lógica de interfaz
└── README.md
```

## Cómo ejecutarlo

No requiere instalación ni backend. Basta con abrir `index.html` en cualquier navegador moderno (Chrome, Edge, Firefox).

## Cuentas de prueba

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@empresa.cl` | `admin123` |
| Empleado | `jperez@empresa.cl` | `1234` |

Hay además dos empleados adicionales precargados (`msoto@empresa.cl`, `crivas@empresa.cl`, contraseña `1234`) con historial de ejemplo para que los tres reportes muestren datos desde el primer momento.

## Persistencia de datos

Para este avance, los datos (usuarios y registros) se mantienen **en memoria** (arrays de JavaScript) y se reinician cada vez que se recarga la página. Esto es intencional: el objetivo del Avance N°1 es validar el modelo de clases y su codificación, no la infraestructura de datos.

La clase `Sistema` expone métodos claros y acotados (`crearUsuario`, `marcar`, `reporteAtrasos`, etc.), pensados para que, en una siguiente etapa, puedan respaldarse con una base de datos real (por ejemplo, **MongoDB** vía un backend en Node.js/Express) sin tener que rediseñar la lógica de negocio ya construida aquí.

## Próximos pasos (fuera del alcance de este avance)

- Backend con API REST (Node.js/Express) conectado a MongoDB.
- Hash de contraseñas (actualmente están en texto plano, válido solo para el prototipo).
- Validación de sesión persistente (tokens) en lugar de estado en memoria del navegador.
- Exportación de reportes a PDF/Excel.
