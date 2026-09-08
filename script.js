/* ===========================================================
   ClockIn — Sistema de Registro de Asistencia (MVP)
   La lógica de dominio vive en js/models.js y se carga antes de
   este script para compartirla con el navegador y con Jest.
   =========================================================== */

/* ===========================================================
   Controlador de interfaz (DOM)
   =========================================================== */
const sistema = new Sistema();
let usuariosVista = [];

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

function showView(id) {
  $$(".view").forEach(v => v.classList.remove("view--active"));
  $(`#${id}`).classList.add("view--active");
}

function formatoFecha(fecha) {
  return fecha ? String(fecha).slice(0, 10) : "—";
}

// ---------- Login ----------
$("#form-login").addEventListener("submit", async e => {
  e.preventDefault();
  const email = $("#login-email").value.trim();
  const password = $("#login-password").value;
  const user = await sistema.login(email, password);
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
async function renderMarcaje() {
  const user = sistema.usuarioActual;
  const registro = await sistema.registroDeHoy(user.id);
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

  await renderHistorialPersonal(user.id);
}

async function renderHistorialPersonal(usuarioId) {
  const tbody = $("#tabla-historial-personal tbody");
  const historial = await sistema.historialDe(usuarioId);
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
        <td>${formatoFecha(r.fecha)}</td>
        <td>${r.horaEntrada || "—"}</td>
        <td>${r.horaSalida || "—"}</td>
        <td>${estado}</td>
      </tr>`;
  }
}

$("#btn-punch").addEventListener("click", async () => {
  const resultado = await sistema.marcar(sistema.usuarioActual.id);
  const feedback = $("#punch-feedback");
  feedback.hidden = false;

  if (resultado.tipo === "entrada") feedback.textContent = `Entrada registrada a las ${resultado.hora}.`;
  else if (resultado.tipo === "salida") feedback.textContent = `Salida registrada a las ${resultado.hora}.`;
  else feedback.textContent = "Ya registraste tu jornada de hoy.";

  await renderMarcaje();
});

// ---------- Vista: Admin ----------
function mostrarPanelAdmin(tabId) {
  $$(".admin-tab").forEach(tab => tab.classList.toggle("admin-tab--active", tab.dataset.tab === tabId));
  $$(".panel").forEach(panel => panel.classList.toggle("panel--active", panel.id === `panel-${tabId}`));
}

$$(".admin-tab").forEach(tab => tab.addEventListener("click", () => mostrarPanelAdmin(tab.dataset.tab)));
$$(`[data-report-link]`).forEach(button => {
  button.addEventListener("click", () => mostrarPanelAdmin(button.dataset.reportLink));
});
$("#btn-actualizar-reportes").addEventListener("click", renderReportes);

async function renderAdmin() {
  await renderTablaUsuarios();
  await renderReportes();
}

async function renderTablaUsuarios() {
  const tbody = $("#tabla-usuarios");
  usuariosVista = await sistema.listarUsuarios();
  tbody.innerHTML = "";
  for (const u of usuariosVista) {
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

  $$(`[data-edit]`).forEach(b => b.addEventListener("click", () => openModalUsuario(Number(b.dataset.edit))));
  $$(`[data-del]`).forEach(b => b.addEventListener("click", async () => {
    const u = usuariosVista.find(u => u.id === Number(b.dataset.del));
    if (confirm(`¿Eliminar a ${u.nombre}? Esta acción no se puede deshacer.`)) {
      await sistema.eliminarUsuario(u.id);
      await renderTablaUsuarios();
      await renderReportes();
    }
  }));
}

async function renderReportes() {
  const [atrasos, anticipadas, inasistencias] = await Promise.all([
    sistema.reporteAtrasos(), sistema.reporteSalidasAnticipadas(), sistema.reporteInasistencias()
  ]);
  fillTable("#tabla-atrasos", atrasos,
    r => `<td>${r.usuario}</td><td>${formatoFecha(r.fecha)}</td><td>${r.hora}</td><td><span class="tag tag--bad">${r.minutos} min</span></td>`,
    4, "Sin atrasos registrados.");

  fillTable("#tabla-anticipadas", anticipadas,
    r => `<td>${r.usuario}</td><td>${formatoFecha(r.fecha)}</td><td>${r.hora}</td><td><span class="tag tag--bad">${r.minutos} min</span></td>`,
    4, "Sin salidas anticipadas registradas.");

  fillTable("#tabla-inasistencias", inasistencias,
    r => `<td>${r.usuario}</td><td>${formatoFecha(r.fecha)}</td>`,
    2, "Sin inasistencias en los últimos 7 días.");

  $("#resumen-atrasos").textContent = `${atrasos.length} resultado${atrasos.length === 1 ? "" : "s"}`;
  $("#resumen-anticipadas").textContent = `${anticipadas.length} resultado${anticipadas.length === 1 ? "" : "s"}`;
  $("#resumen-inasistencias").textContent = `${inasistencias.length} resultado${inasistencias.length === 1 ? "" : "s"}`;
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
    const u = usuariosVista.find(u => u.id === id);
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

$("#form-usuario").addEventListener("submit", async e => {
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
      await sistema.modificarUsuario(Number(id), datos);
      mensajeExito = "Usuario actualizado correctamente.";
    } else {
      await sistema.crearUsuario(datos);
      mensajeExito = "Usuario creado correctamente.";
    }
    closeModalUsuario();
    await renderTablaUsuarios();
    await renderReportes();
    alert(mensajeExito);
  } catch (err) {
    alert(err.message);
  }
});
