/**
 * TEST-CONNECTION.JS - Prueba de conexión MySQL
 */

const mysql = require('mysql2');

const config = {
  host: 'localhost',
  user: 'root',
  password: 'loquesea2013', // Tu contraseña actual
  database: 'organizador_tareas',
  port: 3306
};

console.log('🔍 Probando conexión a MySQL...');
console.log('📊 Configuración:', {
  host: config.host,
  user: config.user,
  database: config.database,
  port: config.port
});

const connection = mysql.createConnection(config);

connection.connect((err) => {
  if (err) {
    console.error('❌ ERROR de conexión:', err.message);
    console.log('\n🔧 Posibles soluciones:');
    console.log('1. ¿MySQL está ejecutándose? (revisa Services en Windows)');
    console.log('2. ¿La base de datos "organizador_tareas" existe?');
    console.log('3. ¿El usuario y contraseña son correctos?');
    console.log('4. ¿El puerto 3306 está abierto?');
    return;
  }
  
  console.log('✅ CONEXIÓN EXITOSA a MySQL!');
  
  // Verificar si la base de datos existe
  connection.query('SHOW DATABASES LIKE "organizador_tareas"', (err, results) => {
    if (err) throw err;
    
    if (results.length > 0) {
      console.log('✅ Base de datos "organizador_tareas" encontrada');
    } else {
      console.log('❌ Base de datos "organizador_tareas" NO existe');
      console.log('💡 Ejecuta en MySQL Workbench: CREATE DATABASE organizador_tareas;');
    }
    
    connection.end();
  });
});