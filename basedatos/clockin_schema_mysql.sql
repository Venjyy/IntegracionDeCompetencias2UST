-- ClockIn - Esquema MySQL/MariaDB para HeidiSQL
-- RE-01, RE-02 y RE-03 usan las vistas y la consulta parametrizada del backend.

DROP VIEW IF EXISTS vw_reporte_salidas_anticipadas;
DROP VIEW IF EXISTS vw_reporte_atrasos;
DROP TABLE IF EXISTS registros_asistencia;
DROP TABLE IF EXISTS parametros_asistencia;
DROP TABLE IF EXISTS usuarios;
DROP TABLE IF EXISTS roles;

CREATE TABLE roles (
    id_rol INT AUTO_INCREMENT PRIMARY KEY,
    nombre_rol VARCHAR(30) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE usuarios (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    id_rol INT NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_usuarios_rol FOREIGN KEY (id_rol) REFERENCES roles(id_rol),
    INDEX idx_usuarios_rol (id_rol)
) ENGINE=InnoDB;

CREATE TABLE parametros_asistencia (
    id_parametro INT AUTO_INCREMENT PRIMARY KEY,
    hora_limite_entrada TIME NOT NULL DEFAULT '09:30:00',
    hora_limite_salida TIME NOT NULL DEFAULT '17:30:00',
    vigente BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE registros_asistencia (
    id_registro INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    fecha DATE NOT NULL,
    hora_entrada TIME NULL,
    hora_salida TIME NULL,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_usuario_fecha UNIQUE (id_usuario, fecha),
    CONSTRAINT fk_registros_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
    CONSTRAINT ck_salida_posterior_entrada CHECK (
        hora_salida IS NULL OR hora_entrada IS NULL OR hora_salida > hora_entrada
    ),
    INDEX idx_registros_fecha (fecha)
) ENGINE=InnoDB;

INSERT INTO roles (nombre_rol) VALUES ('administrador'), ('empleado');
INSERT INTO parametros_asistencia (hora_limite_entrada, hora_limite_salida, vigente)
VALUES ('09:30:00', '17:30:00', TRUE);

-- Contraseñas en texto simple solo para este prototipo universitario.
INSERT INTO usuarios (nombre, email, password_hash, id_rol) VALUES
    ('Admin General', 'admin@empresa.cl', 'admin123', (SELECT id_rol FROM roles WHERE nombre_rol = 'administrador')),
    ('Juan Pérez', 'jperez@empresa.cl', '1234', (SELECT id_rol FROM roles WHERE nombre_rol = 'empleado')),
    ('María Soto', 'msoto@empresa.cl', '1234', (SELECT id_rol FROM roles WHERE nombre_rol = 'empleado')),
    ('Carlos Rivas', 'crivas@empresa.cl', '1234', (SELECT id_rol FROM roles WHERE nombre_rol = 'empleado'));

INSERT INTO registros_asistencia (id_usuario, fecha, hora_entrada, hora_salida) VALUES
    (2, CURDATE() - INTERVAL 1 DAY, '09:12:00', '17:35:00'),
    (2, CURDATE() - INTERVAL 2 DAY, '09:47:00', '17:20:00'),
    (3, CURDATE() - INTERVAL 1 DAY, '08:58:00', '17:05:00'),
    (3, CURDATE() - INTERVAL 3 DAY, '10:05:00', '16:40:00');

CREATE OR REPLACE VIEW vw_reporte_atrasos AS
SELECT u.id_usuario, u.nombre, ra.fecha, ra.hora_entrada,
       ROUND(TIME_TO_SEC(TIMEDIFF(ra.hora_entrada, p.hora_limite_entrada)) / 60) AS minutos_atraso
FROM registros_asistencia ra
JOIN usuarios u ON u.id_usuario = ra.id_usuario
CROSS JOIN parametros_asistencia p
WHERE p.vigente = TRUE AND u.activo = TRUE
  AND ra.hora_entrada IS NOT NULL AND ra.hora_entrada > p.hora_limite_entrada
ORDER BY ra.fecha DESC, minutos_atraso DESC;

CREATE OR REPLACE VIEW vw_reporte_salidas_anticipadas AS
SELECT u.id_usuario, u.nombre, ra.fecha, ra.hora_salida,
       ROUND(TIME_TO_SEC(TIMEDIFF(p.hora_limite_salida, ra.hora_salida)) / 60) AS minutos_anticipo
FROM registros_asistencia ra
JOIN usuarios u ON u.id_usuario = ra.id_usuario
CROSS JOIN parametros_asistencia p
WHERE p.vigente = TRUE AND u.activo = TRUE
  AND ra.hora_salida IS NOT NULL AND ra.hora_salida < p.hora_limite_salida
ORDER BY ra.fecha DESC, minutos_anticipo DESC;