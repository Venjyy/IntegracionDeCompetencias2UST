require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const path = require("path");

const app = express();
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5
});

app.use(express.json());
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const usuarioSelect = `
  SELECT u.id_usuario AS id, u.nombre, u.email, u.password_hash AS password,
         r.nombre_rol AS rol
  FROM usuarios u JOIN roles r ON r.id_rol = u.id_rol
  WHERE u.activo = TRUE`;

app.post("/api/login", async (req, res, next) => {
  try {
    const [rows] = await pool.query(`${usuarioSelect} AND u.email = ? AND u.password_hash = ?`, [req.body.email, req.body.password]);
    if (!rows[0]) return res.status(401).json({ error: "Correo o contraseña incorrectos." });
    res.json(rows[0]);
  } catch (error) { next(error); }
});

app.get("/api/usuarios", async (req, res, next) => {
  try { const [rows] = await pool.query(usuarioSelect); res.json(rows); } catch (error) { next(error); }
});

app.post("/api/usuarios", async (req, res, next) => {
  try {
    const { nombre, email, password, rol = "empleado" } = req.body;
    const [result] = await pool.query(
      "INSERT INTO usuarios (nombre, email, password_hash, id_rol) SELECT ?, ?, ?, id_rol FROM roles WHERE nombre_rol = ?",
      [nombre, email, password, rol]
    );
    const [rows] = await pool.query(`${usuarioSelect} AND u.id_usuario = ?`, [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Ya existe un usuario con ese correo." });
    next(error);
  }
});

app.patch("/api/usuarios/:id", async (req, res, next) => {
  try {
    const fields = { nombre: "nombre", email: "email", password: "password_hash", rol: "id_rol" };
    const sets = [];
    const values = [];
    for (const [key, column] of Object.entries(fields)) {
      if (req.body[key] !== undefined && key !== "rol") { sets.push(`${column} = ?`); values.push(req.body[key]); }
    }
    if (req.body.rol !== undefined) {
      const [roles] = await pool.query("SELECT id_rol FROM roles WHERE nombre_rol = ?", [req.body.rol]);
      if (!roles[0]) return res.status(400).json({ error: "Rol no válido." });
      sets.push("id_rol = ?"); values.push(roles[0].id_rol);
    }
    if (!sets.length) return res.status(400).json({ error: "No hay cambios para aplicar." });
    values.push(req.params.id);
    const [result] = await pool.query(`UPDATE usuarios SET ${sets.join(", ")} WHERE id_usuario = ? AND activo = TRUE`, values);
    if (!result.affectedRows) return res.status(404).json({ error: "Usuario no encontrado." });
    const [rows] = await pool.query(`${usuarioSelect} AND u.id_usuario = ?`, [req.params.id]);
    res.json(rows[0]);
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Ya existe un usuario con ese correo." });
    next(error);
  }
});

app.delete("/api/usuarios/:id", async (req, res, next) => {
  try {
    const [result] = await pool.query("UPDATE usuarios SET activo = FALSE WHERE id_usuario = ? AND activo = TRUE", [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: "Usuario no encontrado." });
    res.status(204).end();
  } catch (error) { next(error); }
});

app.get("/api/usuarios/:id/registros", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      "SELECT id_usuario AS usuarioId, fecha, hora_entrada AS horaEntrada, hora_salida AS horaSalida FROM registros_asistencia WHERE id_usuario = ? ORDER BY fecha DESC LIMIT ?",
      [req.params.id, Number(req.query.limite || 8)]
    );
    res.json(rows);
  } catch (error) { next(error); }
});

app.get("/api/usuarios/:id/registro-hoy", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      "SELECT id_usuario AS usuarioId, fecha, hora_entrada AS horaEntrada, hora_salida AS horaSalida FROM registros_asistencia WHERE id_usuario = ? AND fecha = CURDATE()",
      [req.params.id]
    );
    res.json(rows[0] || null);
  } catch (error) { next(error); }
});

app.post("/api/marcar", async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      "SELECT id_registro, hora_entrada AS horaEntrada, hora_salida AS horaSalida FROM registros_asistencia WHERE id_usuario = ? AND fecha = CURDATE() FOR UPDATE",
      [req.body.usuarioId]
    );
    const hora = new Date().toTimeString().slice(0, 8);
    let tipo;
    if (!rows[0]) {
      await connection.query("INSERT INTO registros_asistencia (id_usuario, fecha, hora_entrada) VALUES (?, CURDATE(), ?)", [req.body.usuarioId, hora]);
      tipo = "entrada";
    } else if (!rows[0].horaEntrada) {
      await connection.query("UPDATE registros_asistencia SET hora_entrada = ? WHERE id_registro = ?", [hora, rows[0].id_registro]);
      tipo = "entrada";
    } else if (!rows[0].horaSalida) {
      await connection.query("UPDATE registros_asistencia SET hora_salida = ? WHERE id_registro = ?", [hora, rows[0].id_registro]);
      tipo = "salida";
    } else tipo = "completo";
    await connection.commit();
    res.json({ tipo, hora: tipo === "completo" ? null : hora });
  } catch (error) { await connection.rollback(); next(error); }
  finally { connection.release(); }
});

app.get("/api/reportes/atrasos", async (req, res, next) => {
  try { const [rows] = await pool.query("SELECT nombre AS usuario, fecha, hora_entrada AS hora, minutos_atraso AS minutos FROM vw_reporte_atrasos"); res.json(rows); } catch (error) { next(error); }
});

app.get("/api/reportes/salidas-anticipadas", async (req, res, next) => {
  try { const [rows] = await pool.query("SELECT nombre AS usuario, fecha, hora_salida AS hora, minutos_anticipo AS minutos FROM vw_reporte_salidas_anticipadas"); res.json(rows); } catch (error) { next(error); }
});

app.get("/api/reportes/inasistencias", async (req, res, next) => {
  try {
    const dias = Number(req.query.dias || 7);
    const [rows] = await pool.query(`
      WITH RECURSIVE fechas AS (
        SELECT DATE_SUB(CURDATE(), INTERVAL ? DAY) AS fecha
        UNION ALL SELECT DATE_ADD(fecha, INTERVAL 1 DAY) FROM fechas WHERE fecha < DATE_SUB(CURDATE(), INTERVAL 1 DAY)
      )
      SELECT u.nombre AS usuario, f.fecha
      FROM usuarios u JOIN roles r ON r.id_rol = u.id_rol AND r.nombre_rol = 'empleado'
      CROSS JOIN fechas f
      WHERE u.activo = TRUE AND NOT EXISTS (
        SELECT 1 FROM registros_asistencia ra WHERE ra.id_usuario = u.id_usuario AND ra.fecha = f.fecha
          AND (ra.hora_entrada IS NOT NULL OR ra.hora_salida IS NOT NULL)
      ) ORDER BY f.fecha, u.nombre`, [dias]);
    res.json(rows);
  } catch (error) { next(error); }
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: "Error interno del servidor." });
});

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => console.log(`ClockIn backend escuchando en http://localhost:${port}`));
}

module.exports = { app, pool };