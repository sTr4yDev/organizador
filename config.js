/**
 * CONFIG.JS - Configuración de Conexión MySQL
 * 
 * ⚠️ IMPORTANTE: Cambia estos valores según tu instalación de MySQL
 */

module.exports = {
  // Host donde corre MySQL (normalmente localhost)
  host: 'localhost',
  
  // Usuario de MySQL (normalmente 'root')
  user: 'root',
  
  // ⚠️ CAMBIA ESTO: Tu contraseña de MySQL
  password: 'loquesea2013',
  
  // Nombre de la base de datos (ya debe estar creada en Workbench)
  database: 'organizador_tareas',
  
  // Puerto de MySQL (por defecto 3306)
  port: 3306,
  
  // Configuración del pool de conexiones
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  
  // Zona horaria (opcional)
  timezone: '-06:00' // Ajusta según tu zona (México = -06:00)
};