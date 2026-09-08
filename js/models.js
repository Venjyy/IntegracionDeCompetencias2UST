/* ===========================================================
   ClockIn — Modelo de dominio
   Clases extraídas del caso (Avance #1 y #2):
     - Usuario            → login, datos base
     - Administrador      → extiende Usuario (CA-01, GU-01/02/03)
     - RegistroAsistencia → una marca de entrada/salida (CA-01)
     - Reporte            → generación de RE-01, RE-02, RE-03
     - Sistema            → orquesta todo (controlador de dominio)

   Este archivo es UMD-lite: se carga como <script> normal en el
   navegador (index.html) y también con require() desde Node para
   las pruebas unitarias (tests/models.test.js), sin duplicar código.
   =========================================================== */

// ---------- Clase: Usuario ----------
class Usuario {
  constructor(id, nombre, email, password, rol = "empleado") {
    this.id = id;
    this.nombre = nombre;
    this.email = email;
    this.password = password;
    this.rol = rol; // "empleado" | "administrador"
  }

  esAdministrador() {
    return this.rol === "administrador";
  }
}

// ---------- Clase: Administrador ----------
class Administrador extends Usuario {
  constructor(id, nombre, email, password) {
    super(id, nombre, email, password, "administrador");
  }

  // GU-01
  async crearUsuario(sistema, { nombre, email, password, rol }) {
    return sistema.crearUsuario({ nombre, email, password, rol });
  }

  // GU-02
  async modificarUsuario(sistema, id, cambios) {
    return sistema.modificarUsuario(id, cambios);
  }

  // GU-03
  async eliminarUsuario(sistema, id) {
    return sistema.eliminarUsuario(id);
  }
}

// ---------- Clase: RegistroAsistencia ----------
class RegistroAsistencia {
  constructor(usuarioId, fecha) {
    this.usuarioId = usuarioId;
    this.fecha = fecha;       // "YYYY-MM-DD"
    this.horaEntrada = null;  // "HH:MM:SS"
    this.horaSalida = null;
  }

  marcarEntrada(hora) {
    this.horaEntrada = hora;
  }

  marcarSalida(hora) {
    this.horaSalida = hora;
  }
}

// ---------- Clase: Reporte ----------
// RE-01, RE-02, RE-03: construidos a partir de los registros del Sistema.
class Reporte {
  static LIMITE_ATRASO = "09:30:00";
  static LIMITE_SALIDA_ANTICIPADA = "17:30:00";

  static atrasos(registros, usuarios) {
    return registros
      .filter(r => r.horaEntrada && r.horaEntrada > Reporte.LIMITE_ATRASO)
      .map(r => ({
        usuario: Reporte._nombre(usuarios, r.usuarioId),
        fecha: r.fecha,
        hora: r.horaEntrada,
        minutos: Reporte._diffMinutos(Reporte.LIMITE_ATRASO, r.horaEntrada)
      }));
  }

  static salidasAnticipadas(registros, usuarios) {
    return registros
      .filter(r => r.horaSalida && r.horaSalida < Reporte.LIMITE_SALIDA_ANTICIPADA)
      .map(r => ({
        usuario: Reporte._nombre(usuarios, r.usuarioId),
        fecha: r.fecha,
        hora: r.horaSalida,
        minutos: Reporte._diffMinutos(r.horaSalida, Reporte.LIMITE_SALIDA_ANTICIPADA)
      }));
  }

  // Días (últimos N) sin ningún registro de entrada ni salida, por empleado.
  static inasistencias(registros, usuarios, dias = 7) {
    const empleados = usuarios.filter(u => !u.esAdministrador());
    const fechas = Reporte._ultimasFechas(dias);
    const filas = [];

    for (const emp of empleados) {
      for (const fecha of fechas) {
        const tieneRegistro = registros.some(
          r => r.usuarioId === emp.id && r.fecha === fecha && (r.horaEntrada || r.horaSalida)
        );
        if (!tieneRegistro) {
          filas.push({ usuario: emp.nombre, fecha });
        }
      }
    }
    return filas;
  }

  static _nombre(usuarios, id) {
    const u = usuarios.find(u => u.id === id);
    return u ? u.nombre : "—";
  }

  static _diffMinutos(horaA, horaB) {
    const [ha, ma, sa] = horaA.split(":").map(Number);
    const [hb, mb, sb] = horaB.split(":").map(Number);
    const segA = ha * 3600 + ma * 60 + sa;
    const segB = hb * 3600 + mb * 60 + sb;
    return Math.max(0, Math.round((segB - segA) / 60));
  }

  static _ultimasFechas(dias) {
    const out = [];
    const hoy = new Date();
    for (let i = 1; i <= dias; i++) {
      const d = new Date(hoy);
      d.setDate(d.getDate() - i);
      out.push(d.toISOString().slice(0, 10));
    }
    return out;
  }
}

// ---------- Clase: Sistema ----------
class Sistema {
  constructor({ apiUrl = "http://localhost:3000/api" } = {}) {
    this.apiUrl = apiUrl;
    this.usuarioActual = null;
  }

  async _request(path, options = {}) {
    const response = await fetch(`${this.apiUrl}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options
    });
    const body = response.status === 204 ? null : await response.json();
    if (!response.ok) throw new Error(body && body.error ? body.error : "No se pudo completar la operación.");
    return body;
  }

  _usuario(data) {
    if (!data) return null;
    return data.rol === "administrador"
      ? new Administrador(data.id, data.nombre, data.email, data.password)
      : new Usuario(data.id, data.nombre, data.email, data.password, data.rol);
  }

  // ----- Autenticación -----
  async login(email, password) {
    try {
      const user = await this._request("/login", { method: "POST", body: JSON.stringify({ email, password }) });
      this.usuarioActual = this._usuario(user);
      return this.usuarioActual;
    } catch (error) {
      if (error.message === "Correo o contraseña incorrectos.") return null;
      throw error;
    }
  }

  logout() {
    this.usuarioActual = null;
  }

  // ----- CA-01: marcaje -----
  async registroDeHoy(usuarioId) {
    const data = await this._request(`/usuarios/${usuarioId}/registro-hoy`);
    return data ? Object.assign(new RegistroAsistencia(data.usuarioId, data.fecha), {
      horaEntrada: data.horaEntrada,
      horaSalida: data.horaSalida
    }) : null;
  }

  async marcar(usuarioId) {
    return this._request("/marcar", { method: "POST", body: JSON.stringify({ usuarioId }) });
  }

  async historialDe(usuarioId, limite = 8) {
    const rows = await this._request(`/usuarios/${usuarioId}/registros?limite=${limite}`);
    return rows.map(data => Object.assign(new RegistroAsistencia(data.usuarioId, data.fecha), {
      horaEntrada: data.horaEntrada,
      horaSalida: data.horaSalida
    }));
  }

  // ----- GU-01 / GU-02 / GU-03 -----
  async listarUsuarios() {
    const rows = await this._request("/usuarios");
    return rows.map(data => this._usuario(data));
  }

  async crearUsuario(datos) {
    return this._usuario(await this._request("/usuarios", { method: "POST", body: JSON.stringify(datos) }));
  }

  async modificarUsuario(id, cambios) {
    return this._usuario(await this._request(`/usuarios/${id}`, { method: "PATCH", body: JSON.stringify(cambios) }));
  }

  async eliminarUsuario(id) {
    await this._request(`/usuarios/${id}`, { method: "DELETE" });
  }

  // ----- RE-01 / RE-02 / RE-03 -----
  async reporteAtrasos() {
    return this._request("/reportes/atrasos");
  }
  async reporteSalidasAnticipadas() {
    return this._request("/reportes/salidas-anticipadas");
  }
  async reporteInasistencias() {
    return this._request("/reportes/inasistencias?dias=7");
  }
}

// ---------- Exportación (Node / CommonJS) ----------
// En el navegador estas clases simplemente quedan como globales de
// esta <script>, disponibles para script.js que se carga después.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { Usuario, Administrador, RegistroAsistencia, Reporte, Sistema };
}
