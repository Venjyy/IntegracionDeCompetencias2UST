/**
 * ClockIn — Pruebas unitarias
 *
 * Cubren los requerimientos pedidos en la actividad:
 *   Gestión de usuarios  -> GU-01 (crear), GU-02 (modificar), GU-03 (eliminar)
 *   Control de asistencia -> CA-01 (registrar entrada, registrar salida)
 *
 * Cada bloque `test(...)` corresponde 1 a 1 con una fila de la tabla
 * de "Planificación y Ejecución de Casos de Prueba" (Documento .docx).
 */

const { Usuario, Administrador, RegistroAsistencia, Sistema } = require("../js/models");

// Se crea un Sistema nuevo (sin datos de ejemplo) antes de cada prueba,
// para que los casos no se contaminen entre sí.
let sistema;
function respuesta(body, ok = true, status = 200) {
  return Promise.resolve({ ok, status, json: () => Promise.resolve(body) });
}
beforeEach(() => {
  global.fetch = jest.fn();
  sistema = new Sistema({ apiUrl: "http://test/api" });
});

describe("Gestión de usuarios", () => {
  test("GU-01 — crearUsuario devuelve el usuario creado", async () => {
    fetch.mockReturnValueOnce(respuesta({ id: 8, nombre: "Ana Torres", email: "atorres@empresa.cl", password: "clave123", rol: "empleado" }, true, 201));
    const nuevo = await sistema.crearUsuario({ nombre: "Ana Torres", email: "atorres@empresa.cl", password: "clave123", rol: "empleado" });
    expect(nuevo).toBeInstanceOf(Usuario);
    expect(nuevo.email).toBe("atorres@empresa.cl");
  });

  test("GU-01b — crearUsuario rechaza correo duplicado", async () => {
    fetch.mockReturnValueOnce(respuesta({ error: "Ya existe un usuario con ese correo." }, false, 409));
    await expect(sistema.crearUsuario({ nombre: "Otro", email: "dup@empresa.cl", password: "456", rol: "empleado" })).rejects.toThrow("Ya existe un usuario con ese correo.");
  });

  test("GU-02 — modificarUsuario devuelve los datos actualizados", async () => {
    fetch.mockReturnValueOnce(respuesta({ id: 8, nombre: "Pedro Lima Rojas", email: "plima@empresa.cl", password: "abc123", rol: "empleado" }));
    const actualizado = await sistema.modificarUsuario(8, { nombre: "Pedro Lima Rojas" });
    expect(actualizado.nombre).toBe("Pedro Lima Rojas");
  });

  test("GU-02b — modificarUsuario falla si el id no existe", async () => {
    fetch.mockReturnValueOnce(respuesta({ error: "Usuario no encontrado." }, false, 404));
    await expect(sistema.modificarUsuario(999, { nombre: "Nadie" })).rejects.toThrow("Usuario no encontrado.");
  });

  test("GU-03 — eliminarUsuario solicita borrado lógico", async () => {
    fetch.mockReturnValueOnce(respuesta(null, true, 204));
    await expect(sistema.eliminarUsuario(8)).resolves.toBeUndefined();
  });

  test("GU-03b — eliminarUsuario falla si el id no existe", async () => {
    fetch.mockReturnValueOnce(respuesta({ error: "Usuario no encontrado." }, false, 404));
    await expect(sistema.eliminarUsuario(999)).rejects.toThrow("Usuario no encontrado.");
  });
});

describe("Control de asistencia", () => {
  test("CA-01a — marcar registra entrada", async () => {
    fetch.mockReturnValueOnce(respuesta({ tipo: "entrada", hora: "09:00:00" }));
    await expect(sistema.marcar(8)).resolves.toEqual({ tipo: "entrada", hora: "09:00:00" });
  });
  test("CA-01b — marcar registra salida", async () => {
    fetch.mockReturnValueOnce(respuesta({ tipo: "salida", hora: "17:00:00" }));
    await expect(sistema.marcar(8)).resolves.toHaveProperty("tipo", "salida");
  });
  test("CA-01c — marcar conserva una jornada completa", async () => {
    fetch.mockReturnValueOnce(respuesta({ tipo: "completo", hora: null }));
    await expect(sistema.marcar(8)).resolves.toEqual({ tipo: "completo", hora: null });
  });
});

describe("Reportes", () => {
  test("RE-01 — reporteAtrasos procesa sus filas", async () => {
    const filas = [{ usuario: "Juan Pérez", fecha: "2026-09-07", hora: "09:47:00", minutos: 17 }];
    fetch.mockReturnValueOnce(respuesta(filas));
    await expect(sistema.reporteAtrasos()).resolves.toEqual(filas);
  });
  test("RE-02 — reporteSalidasAnticipadas procesa sus filas", async () => {
    fetch.mockReturnValueOnce(respuesta([{ usuario: "María Soto", fecha: "2026-09-05", hora: "16:40:00", minutos: 50 }]));
    await expect(sistema.reporteSalidasAnticipadas()).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ minutos: 50 })]));
  });
  test("RE-03 — reporteInasistencias conserva usuario y fecha", async () => {
    const filas = [{ usuario: "Carlos Rivas", fecha: "2026-09-07" }];
    fetch.mockReturnValueOnce(respuesta(filas));
    await expect(sistema.reporteInasistencias()).resolves.toEqual(filas);
  });
});

describe("Modelo RegistroAsistencia (unidad aislada)", () => {
  test("marcarEntrada y marcarSalida asignan las horas correctamente", () => {
    const registro = new RegistroAsistencia(1, "2026-09-01");
    expect(registro.horaEntrada).toBeNull();

    registro.marcarEntrada("09:00:00");
    registro.marcarSalida("17:00:00");

    expect(registro.horaEntrada).toBe("09:00:00");
    expect(registro.horaSalida).toBe("17:00:00");
  });
});

describe("Administrador delega en Sistema (composición)", () => {
  test("Administrador.crearUsuario delega correctamente en sistema.crearUsuario", async () => {
    fetch.mockReturnValueOnce(respuesta({ id: 9, nombre: "Nuevo Empleado", email: "nuevo@empresa.cl", password: "1234", rol: "empleado" }, true, 201));
    const admin = new Administrador(1, "Admin", "admin@empresa.cl", "admin123");
    const creado = await admin.crearUsuario(sistema, {
      nombre: "Nuevo Empleado",
      email: "nuevo@empresa.cl",
      password: "1234",
      rol: "empleado"
    });

    expect(creado.nombre).toBe("Nuevo Empleado");
  });
});
