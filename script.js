/* ===========================================================
   ClockIn — Sistema de Registro de Asistencia (MVP)
   Clases extraídas del caso (Avance #1):
     - Usuario            → login, datos base
     - Administrador      → extiende Usuario (CA-01, GU-01/02/03)
     - RegistroAsistencia → una marca de entrada/salida (CA-01)
     - Reporte            → generación de RE-01, RE-02, RE-03
     - Sistema            → orquesta todo (controlador de la app)

   Persistencia: en memoria (arrays) para este avance.
   Nota de escalamiento: el siguiente paso natural es exponer
   estas mismas clases vía una API (Node/Express) respaldada
   por MongoDB, sin cambiar la lógica de negocio de aquí.
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
  crearUsuario(sistema, { nombre, email, password, rol }) {
    return sistema.crearUsuario({ nombre, email, password, rol });
  }

  // GU-02
  modificarUsuario(sistema, id, cambios) {
    return sistema.modificarUsuario(id, cambios);
  }

  // GU-03
  eliminarUsuario(sistema, id) {
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
  constructor() {
    this.usuarios = [];
    this.registros = [];
    this.usuarioActual = null;
    this._nextUsuarioId = 1;
    this._seed();
  }

  _seed() {
    this.usuarios.push(new Administrador(this._nextId(), "Admin General", "admin@empresa.cl", "admin123"));
    this.usuarios.push(new Usuario(this._nextId(), "Juan Pérez", "jperez@empresa.cl", "1234"));
    this.usuarios.push(new Usuario(this._nextId(), "María Soto", "msoto@empresa.cl", "1234"));
    this.usuarios.push(new Usuario(this._nextId(), "Carlos Rivas", "crivas@empresa.cl", "1234"));

    // Historial de demostración para los reportes (RE-01, RE-02, RE-03)
    const fechaHace = n => {
      const d = new Date();
      d.setDate(d.getDate() - n);
      return d.toISOString().slice(0, 10);
    };
    const demo = [
      { usuarioId: 2, fecha: fechaHace(1), entrada: "09:12:00", salida: "17:35:00" },
      { usuarioId: 2, fecha: fechaHace(2), entrada: "09:47:00", salida: "17:20:00" },
      { usuarioId: 3, fecha: fechaHace(1), entrada: "08:58:00", salida: "17:05:00" },
      { usuarioId: 3, fecha: fechaHace(3), entrada: "10:05:00", salida: "16:40:00" },
      // Carlos Rivas (id 4) no tiene registros -> aparecerá en inasistencias
    ];
    for (const d of demo) {
      const r = new RegistroAsistencia(d.usuarioId, d.fecha);
      r.marcarEntrada(d.entrada);
      r.marcarSalida(d.salida);
      this.registros.push(r);
    }
  }

  _nextId() {
    return this._nextUsuarioId++;
  }

  // ----- Autenticación -----
  login(email, password) {
    const user = this.usuarios.find(u => u.email === email && u.password === password);
    if (!user) return null;
    this.usuarioActual = user;
    return user;
  }

  logout() {
    this.usuarioActual = null;
  }

  // ----- CA-01: marcaje -----
  registroDeHoy(usuarioId) {
    const fecha = new Date().toISOString().slice(0, 10);
    return this.registros.find(r => r.usuarioId === usuarioId && r.fecha === fecha) || null;
  }

  marcar(usuarioId) {
    const ahora = new Date();
    const fecha = ahora.toISOString().slice(0, 10);
    const hora = ahora.toTimeString().slice(0, 8);

    let registro = this.registroDeHoy(usuarioId);
    if (!registro) {
      registro = new RegistroAsistencia(usuarioId, fecha);
      this.registros.push(registro);
    }

    if (!registro.horaEntrada) {
      registro.marcarEntrada(hora);
      return { tipo: "entrada", hora };
    } else if (!registro.horaSalida) {
      registro.marcarSalida(hora);
      return { tipo: "salida", hora };
    }
    return { tipo: "completo", hora: null };
  }

  historialDe(usuarioId, limite = 8) {
    return this.registros
      .filter(r => r.usuarioId === usuarioId)
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .slice(0, limite);
  }

  // ----- GU-01 / GU-02 / GU-03 -----
  crearUsuario({ nombre, email, password, rol }) {
    if (this.usuarios.some(u => u.email === email)) {
      throw new Error("Ya existe un usuario con ese correo.");
    }
    const nuevo = rol === "administrador"
      ? new Administrador(this._nextId(), nombre, email, password)
      : new Usuario(this._nextId(), nombre, email, password, "empleado");
    this.usuarios.push(nuevo);
    return nuevo;
  }

  modificarUsuario(id, cambios) {
    const u = this.usuarios.find(u => u.id === id);
    if (!u) throw new Error("Usuario no encontrado.");
    Object.assign(u, cambios);
    return u;
  }

  eliminarUsuario(id) {
    const idx = this.usuarios.findIndex(u => u.id === id);
    if (idx === -1) throw new Error("Usuario no encontrado.");
    this.usuarios.splice(idx, 1);
  }

  // ----- RE-01 / RE-02 / RE-03 -----
  reporteAtrasos() {
    return Reporte.atrasos(this.registros, this.usuarios);
  }
  reporteSalidasAnticipadas() {
    return Reporte.salidasAnticipadas(this.registros, this.usuarios);
  }
  reporteInasistencias() {
    return Reporte.inasistencias(this.registros, this.usuarios, 7);
  }
}

/* ===========================================================
   Controlador de interfaz (DOM)
   =========================================================== */
const sistema = new Sistema();

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

function showView(id) {
  $$(".view").forEach(v => v.classList.remove("view--active"));
  $(`#${id}`).classList.add("view--active");
}

// ---------- Login ----------
$("#form-login").addEventListener("submit", e => {
  e.preventDefault();
  const email = $("#login-email").value.trim();
  const password = $("#login-password").value;
  const user = sistema.login(email, password);
  const errorEl = $("#login-error");

  if (!user) {
    errorEl.textContent = "Correo o contraseña incorrectos.";
    errorEl.hidden = false;
    return;
  }
  errorEl.hidden = true;
  $("#form-login").reset();

  if (user.esAdministrador()) {
    $("#admin-user-name").textContent = `${user.nombre} · Administrador`;
    renderAdmin();
    showView("view-admin");
  } else {
    $("#marcaje-user-name").textContent = user.nombre;
    renderMarcaje();
    showView("view-marcaje");
  }
});

$("#btn-logout-user").addEventListener("click", () => { sistema.logout(); showView("view-login"); });
$("#btn-logout-admin").addEventListener("click", () => { sistema.logout(); showView("view-login"); });

// ---------- Reloj en vivo ----------
function tickClock() {
  const now = new Date();
  const fecha = now.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
  $("#clock-date").textContent = fecha;
  $("#clock-time").textContent = now.toTimeString().slice(0, 8);
}
setInterval(tickClock, 1000);
tickClock();

// ---------- Vista: Marcaje (empleado) ----------
function renderMarcaje() {
  const user = sistema.usuarioActual;
  const registro = sistema.registroDeHoy(user.id);
  const statusEl = $("#clock-status");
  const statusText = $("#clock-status-text");
  const btn = $("#btn-punch");

  statusEl.classList.remove("is-in", "is-out");

  if (!registro || !registro.horaEntrada) {
    statusText.textContent = "Sin marcar hoy";
    btn.textContent = "Marcar entrada";
    btn.disabled = false;
  } else if (registro.horaEntrada && !registro.horaSalida) {
    statusEl.classList.add("is-in");
    statusText.textContent = `Entrada registrada a las ${registro.horaEntrada}`;
    btn.textContent = "Marcar salida";
    btn.disabled = false;
  } else {
    statusEl.classList.add("is-out");
    statusText.textContent = `Jornada completa (${registro.horaEntrada} – ${registro.horaSalida})`;
    btn.textContent = "Jornada finalizada";
    btn.disabled = true;
  }

  renderHistorialPersonal(user.id);
}

function renderHistorialPersonal(usuarioId) {
  const tbody = $("#tabla-historial-personal tbody");
  const historial = sistema.historialDe(usuarioId);
  tbody.innerHTML = "";

  if (historial.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="4">Todavía no tienes registros.</td></tr>`;
    return;
  }

  for (const r of historial) {
    const estado = !r.horaSalida
      ? `<span class="tag tag--warn">En curso</span>`
      : `<span class="tag tag--ok">Completo</span>`;
    tbody.innerHTML += `
      <tr>
        <td>${r.fecha}</td>
        <td>${r.horaEntrada || "—"}</td>
        <td>${r.horaSalida || "—"}</td>
        <td>${estado}</td>
      </tr>`;
  }
}

$("#btn-punch").addEventListener("click", () => {
  const resultado = sistema.marcar(sistema.usuarioActual.id);
  const feedback = $("#punch-feedback");
  feedback.hidden = false;

  if (resultado.tipo === "entrada") feedback.textContent = `Entrada registrada a las ${resultado.hora}.`;
  else if (resultado.tipo === "salida") feedback.textContent = `Salida registrada a las ${resultado.hora}.`;
  else feedback.textContent = "Ya registraste tu jornada de hoy.";

  renderMarcaje();
});

// ---------- Vista: Admin ----------
$$(".admin-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    $$(".admin-tab").forEach(t => t.classList.remove("admin-tab--active"));
    $$(".panel").forEach(p => p.classList.remove("panel--active"));
    tab.classList.add("admin-tab--active");
    $(`#panel-${tab.dataset.tab}`).classList.add("panel--active");
  });
});

function renderAdmin() {
  renderTablaUsuarios();
  renderReportes();
}

function renderTablaUsuarios() {
  const tbody = $("#tabla-usuarios");
  tbody.innerHTML = "";
  for (const u of sistema.usuarios) {
    const rolTag = u.esAdministrador()
      ? `<span class="tag tag--warn">Administrador</span>`
      : `<span class="tag">Empleado</span>`;
    tbody.innerHTML += `
      <tr>
        <td>${u.nombre}</td>
        <td>${u.email}</td>
        <td>${rolTag}</td>
        <td>
          <div class="row-actions">
            <button class="link-btn" data-edit="${u.id}">Editar</button>
            <button class="link-btn link-btn--danger" data-del="${u.id}">Eliminar</button>
          </div>
        </td>
      </tr>`;
  }

  $$("[data-edit]").forEach(b => b.addEventListener("click", () => openModalUsuario(Number(b.dataset.edit))));
  $$("[data-del]").forEach(b => b.addEventListener("click", () => {
    const u = sistema.usuarios.find(u => u.id === Number(b.dataset.del));
    if (confirm(`¿Eliminar a ${u.nombre}? Esta acción no se puede deshacer.`)) {
      sistema.eliminarUsuario(u.id);
      renderTablaUsuarios();
      renderReportes();
    }
  }));
}

function renderReportes() {
  fillTable("#tabla-atrasos", sistema.reporteAtrasos(),
    r => `<td>${r.usuario}</td><td>${r.fecha}</td><td>${r.hora}</td><td><span class="tag tag--bad">${r.minutos} min</span></td>`,
    4, "Sin atrasos registrados.");

  fillTable("#tabla-anticipadas", sistema.reporteSalidasAnticipadas(),
    r => `<td>${r.usuario}</td><td>${r.fecha}</td><td>${r.hora}</td><td><span class="tag tag--bad">${r.minutos} min</span></td>`,
    4, "Sin salidas anticipadas registradas.");

  fillTable("#tabla-inasistencias", sistema.reporteInasistencias(),
    r => `<td>${r.usuario}</td><td>${r.fecha}</td>`,
    2, "Sin inasistencias en los últimos 7 días.");
}

function fillTable(selector, filas, renderRow, colspan, emptyMsg) {
  const tbody = $(selector);
  tbody.innerHTML = "";
  if (filas.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="${colspan}">${emptyMsg}</td></tr>`;
    return;
  }
  for (const f of filas) {
    tbody.innerHTML += `<tr>${renderRow(f)}</tr>`;
  }
}

// ---------- Modal: crear / editar usuario ----------
const modal = $("#modal-usuario");

$("#btn-nuevo-usuario").addEventListener("click", () => openModalUsuario(null));
$("#btn-cancelar-usuario").addEventListener("click", closeModalUsuario);

function openModalUsuario(id) {
  const esEdicion = id !== null;
  $("#modal-usuario-title").textContent = esEdicion ? "Editar usuario" : "Nuevo usuario";
  $("#usuario-id").value = id || "";

  if (esEdicion) {
    const u = sistema.usuarios.find(u => u.id === id);
    $("#usuario-nombre").value = u.nombre;
    $("#usuario-email").value = u.email;
    $("#usuario-password").value = u.password;
    $("#usuario-rol").value = u.rol;
  } else {
    $("#form-usuario").reset();
  }
  modal.hidden = false;
}

function closeModalUsuario() {
  modal.hidden = true;
}

$("#form-usuario").addEventListener("submit", e => {
  e.preventDefault();
  const id = $("#usuario-id").value;
  const datos = {
    nombre: $("#usuario-nombre").value.trim(),
    email: $("#usuario-email").value.trim(),
    password: $("#usuario-password").value,
    rol: $("#usuario-rol").value
  };

  try {
    let mensajeExito = "";
    if (id) {
      sistema.modificarUsuario(Number(id), datos);
      mensajeExito = "Usuario actualizado correctamente.";
    } else {
      sistema.crearUsuario(datos);
      mensajeExito = "Usuario creado correctamente.";
    }
    closeModalUsuario();
    renderTablaUsuarios();
    renderReportes();
    alert(mensajeExito);
  } catch (err) {
    alert(err.message);
  }
});
