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
├── index.html          # Estructura: login, marcaje, panel admin
├── style.css           # Estilos (paleta y tipografía propias del proyecto)
├── script.js           # Controlador de interfaz (DOM)
├── js/
│   └── models.js        # Clases del dominio (Usuario, Administrador,
│                         # RegistroAsistencia, Reporte, Sistema)
├── tests/
│   └── models.test.js   # Pruebas unitarias (Jest) de GU-01/02/03 y CA-01
├── package.json
├── diagramas/            # Diagramas PlantUML (sistema, programa, DFD, actividades)
├── basedatos/            # Script SQL 3FN + diagrama ER PlantUML
└── README.md
```

Las clases de dominio viven en `js/models.js`, separadas del controlador de interfaz (`script.js`). Esto permite reutilizarlas tanto en el navegador (cargando `models.js` antes de `script.js` en `index.html`) como en Node.js para las pruebas unitarias, sin duplicar la lógica de negocio en dos lugares.

## Cómo levantar el proyecto desde cero

1. Crea una base de datos MySQL/MariaDB llamada `clockin` desde HeidiSQL.
2. Ejecuta [`basedatos/clockin_schema_mysql.sql`](basedatos/clockin_schema_mysql.sql) sobre esa base de datos.
3. Copia `.env.example` como `.env` y completa usuario, contraseña y nombre de la base de datos.
4. Instala las dependencias con `npm install`.
5. Levanta el backend con `npm run start`.
6. Abre `index.html` en el navegador. El backend queda disponible en `http://localhost:3000`.

El navegador se comunica con MySQL únicamente a través de `server.js`, que expone la API REST con Express y `mysql2`.

## Pruebas unitarias

Se usan pruebas unitarias con **Jest** sobre las clases de dominio, cubriendo:

- **Gestión de usuarios**: crear (GU-01), modificar (GU-02) y eliminar (GU-03) usuario — casos de éxito y de error (correo duplicado, id inexistente).
- **Control de asistencia**: registrar entrada y registrar salida (CA-01), incluyendo el caso borde de una tercera marca en el mismo día.

Para ejecutarlas (no requieren servidor ni base de datos porque `fetch` está mockeado):

```bash
npm install
npm test
```

Resultado esperado: **14/14 pruebas superadas**.

## Cuentas de prueba

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@empresa.cl` | `admin123` |
| Empleado | `jperez@empresa.cl` | `1234` |

Hay además dos empleados adicionales precargados (`msoto@empresa.cl`, `crivas@empresa.cl`, contraseña `1234`) con historial de ejemplo para que los tres reportes muestren datos desde el primer momento.

## Persistencia de datos

Los usuarios y registros se almacenan en MySQL/MariaDB. `Sistema` usa `fetch()` para consumir los endpoints de `server.js`; no mantiene arrays de usuarios o registros como fuente de verdad. GU-03 usa borrado lógico mediante `activo = FALSE` para conservar el historial.

Las contraseñas se mantienen en texto simple únicamente por tratarse de un prototipo universitario local; no se implementan JWT ni sesiones complejas en esta etapa.