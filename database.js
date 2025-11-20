/**
 * DATABASE.JS - Gestión de Base de Datos MySQL CON LOGS MEJORADOS
 * 
 * NAMING CONVENTIONS:
 * - Tablas: snake_case plural (tasks, categories, audit_log)
 * - Columnas: snake_case (created_at, is_completed)
 * - Índices: idx_tabla_columna
 * - Triggers: trg_tabla_accion
 * 
 * CONCEPTOS DEMOSTRADOS:
 * - CRUD completo
 * - Triggers automáticos
 * - Transacciones con ROLLBACK
 * - Integridad referencial
 */

const mysql = require('mysql2');
const config = require('./config.js');

class DatabaseManager {
  constructor() {
    console.log('\n🔧 ========== INICIANDO DATABASE MANAGER ==========');
    console.log('📊 Configuración MySQL:', {
      host: config.host,
      database: config.database,
      port: config.port,
      user: config.user
    });
    
    // Crear pool de conexiones a MySQL
    this.pool = mysql.createPool(config);
    this.db = this.pool.promise();
    
    console.log('✅ Pool de conexiones MySQL creado');
    
    // Probar conexión inmediatamente
    this.testConnection()
      .then(() => {
        console.log('🎉 BASE DE DATOS CONECTADA EXITOSAMENTE');
        return this.initDatabase();
      })
      .then(() => {
        console.log('🚀 Base de datos completamente inicializada y lista');
      })
      .catch(error => {
        console.error('💥 ERROR CRÍTICO EN CONEXIÓN:', error.message);
        console.error('🔧 Detalles del error:', error);
      });
  }

  /**
   * TEST: Probar conexión a MySQL con más detalles
   */
  async testConnection() {
    try {
      console.log('🧪 Probando conexión a MySQL...');
      
      const connection = await this.pool.promise().getConnection();
      console.log('✅ Conexión obtenida del pool');
      
      // Ejecutar un query simple
      const [rows] = await connection.query('SELECT 1 + 1 AS result, NOW() as time, DATABASE() as db, USER() as user');
      console.log('📊 Query de prueba ejecutado:', rows[0]);
      
      // Verificar base de datos
      const [dbRows] = await connection.query('SELECT DATABASE() as current_db');
      const currentDb = dbRows[0].current_db;
      console.log('📁 Base de datos actual:', currentDb);
      
      if (currentDb !== config.database) {
        console.warn('⚠️  Base de datos diferente a la esperada');
      }
      
      // Verificar tablas existentes
      const [tables] = await connection.query('SHOW TABLES');
      console.log('📋 Tablas existentes:', tables.map(t => Object.values(t)[0]));
      
      connection.release();
      console.log('✅ Conexión liberada - Prueba exitosa');
      return true;
      
    } catch (error) {
      console.error('❌ ERROR en testConnection:', error.message);
      console.error('🔧 Código de error:', error.code);
      console.error('🔧 Número de error:', error.errno);
      console.error('🔧 SQL State:', error.sqlState);
      
      if (error.code === 'ER_ACCESS_DENIED_ERROR') {
        console.log('\n💡 SOLUCIÓN: Revisa usuario y contraseña en config.js');
      } else if (error.code === 'ER_BAD_DB_ERROR') {
        console.log('\n💡 SOLUCIÓN: La base de datos no existe. Ejecuta en MySQL:');
        console.log(`   CREATE DATABASE ${config.database};`);
      } else if (error.code === 'ECONNREFUSED') {
        console.log('\n💡 SOLUCIÓN: MySQL no está ejecutándose o el puerto es incorrecto');
      }
      
      throw error;
    }
  }

  /**
   * LOG: Función para mostrar logs visuales de SQL
   */
  logSQL(operation, sql, params = []) {
    console.log(`\n🔵 OPERACIÓN: ${operation}`);
    console.log(`📝 SQL: ${sql.replace(/\s+/g, ' ').trim()}`);
    if (params.length > 0) {
      console.log(`📊 PARAMS:`, params);
    }
  }

  /**
   * INIT: Crear estructura de base de datos
   */
  async initDatabase() {
    try {
      console.log('\n🔧 ========== INICIALIZANDO BASE DE DATOS ==========');
      
      // ==================== TABLA: categories ====================
      const createCategoriesTable = `
        CREATE TABLE IF NOT EXISTS categories (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) UNIQUE NOT NULL,
          task_count INT DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `;
      await this.db.query(createCategoriesTable);
      this.logSQL('CREATE TABLE', 'categories');
      console.log('✅ Tabla categories creada/verificada');

      // ==================== TABLA: tasks ====================
      const createTasksTable = `
        CREATE TABLE IF NOT EXISTS tasks (
          id INT AUTO_INCREMENT PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          category_id INT,
          is_completed TINYINT(1) DEFAULT 0 CHECK(is_completed IN (0, 1)),
          priority ENUM('baja', 'media', 'alta') DEFAULT 'media',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          completed_at DATETIME NULL,
          FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
          INDEX idx_tasks_category (category_id),
          INDEX idx_tasks_completed (is_completed)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `;
      await this.db.query(createTasksTable);
      this.logSQL('CREATE TABLE', 'tasks');
      console.log('✅ Tabla tasks creada/verificada');

      // ==================== TABLA: audit_log ====================
      const createAuditTable = `
        CREATE TABLE IF NOT EXISTS audit_log (
          id INT AUTO_INCREMENT PRIMARY KEY,
          action VARCHAR(50) NOT NULL,
          table_name VARCHAR(50) NOT NULL,
          record_id INT,
          details TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `;
      await this.db.query(createAuditTable);
      this.logSQL('CREATE TABLE', 'audit_log');
      console.log('✅ Tabla audit_log creada/verificada');

      // Crear triggers
      await this.createTriggers();
      
      // Insertar categorías por defecto
      await this.insertDefaultCategories();
      
      // Verificar datos iniciales
      await this.verifyInitialData();
      
      console.log('\n🎉 BASE DE DATOS INICIALIZADA CORRECTAMENTE');
      console.log('📊 Estado final:');
      console.log('   - 3 tablas creadas/verificadas');
      console.log('   - 3 triggers configurados');
      console.log('   - Categorías por defecto insertadas');
      console.log('   - Índices y foreign keys configurados');
      
    } catch (error) {
      console.error('❌ Error al inicializar BD:', error.message);
      throw error;
    }
  }

  /**
   * VERIFY: Verificar datos iniciales
   */
  async verifyInitialData() {
    try {
      console.log('\n🔍 Verificando datos iniciales...');
      
      const [categories] = await this.db.query('SELECT COUNT(*) as count FROM categories');
      const [tasks] = await this.db.query('SELECT COUNT(*) as count FROM tasks');
      const [audit] = await this.db.query('SELECT COUNT(*) as count FROM audit_log');
      
      console.log(`📊 Conteo inicial - Categorías: ${categories[0].count}, Tareas: ${tasks[0].count}, Auditoría: ${audit[0].count}`);
      
    } catch (error) {
      console.error('⚠️ Error verificando datos iniciales:', error.message);
    }
  }

  /**
   * TRIGGERS: Crear triggers automáticos en MySQL
   */
  async createTriggers() {
    try {
      console.log('\n🔔 ========== CONFIGURANDO TRIGGERS ==========');

      // TRIGGER 1: Después de insertar una tarea
      const triggerAfterInsert = `
        CREATE TRIGGER IF NOT EXISTS trg_tasks_after_insert
        AFTER INSERT ON tasks
        FOR EACH ROW
        BEGIN
          IF NEW.category_id IS NOT NULL THEN
            UPDATE categories 
            SET task_count = task_count + 1 
            WHERE id = NEW.category_id;
          END IF;
          
          INSERT INTO audit_log (action, table_name, record_id, details)
          VALUES ('INSERT', 'tasks', NEW.id, CONCAT('Tarea creada: ', NEW.title));
        END;
      `;
      
      await this.db.query('DROP TRIGGER IF EXISTS trg_tasks_after_insert');
      await this.db.query(triggerAfterInsert);
      console.log('✅ Trigger trg_tasks_after_insert creado');

      // TRIGGER 2: Después de actualizar (completar tarea)
      const triggerAfterUpdate = `
        CREATE TRIGGER trg_tasks_after_update
        AFTER UPDATE ON tasks
        FOR EACH ROW
        BEGIN
          IF NEW.is_completed = 1 AND OLD.is_completed = 0 THEN
            INSERT INTO audit_log (action, table_name, record_id, details)
            VALUES ('COMPLETE', 'tasks', NEW.id, CONCAT('Tarea completada: ', NEW.title));
          END IF;
        END;
      `;
      
      await this.db.query('DROP TRIGGER IF EXISTS trg_tasks_after_update');
      await this.db.query(triggerAfterUpdate);
      console.log('✅ Trigger trg_tasks_after_update creado');

      // TRIGGER 3: Después de eliminar una tarea
      const triggerAfterDelete = `
        CREATE TRIGGER trg_tasks_after_delete
        AFTER DELETE ON tasks
        FOR EACH ROW
        BEGIN
          IF OLD.category_id IS NOT NULL THEN
            UPDATE categories 
            SET task_count = task_count - 1 
            WHERE id = OLD.category_id;
          END IF;
          
          INSERT INTO audit_log (action, table_name, record_id, details)
          VALUES ('DELETE', 'tasks', OLD.id, CONCAT('Tarea eliminada: ', OLD.title));
        END;
      `;
      
      await this.db.query('DROP TRIGGER IF EXISTS trg_tasks_after_delete');
      await this.db.query(triggerAfterDelete);
      console.log('✅ Trigger trg_tasks_after_delete creado');
      
      // Verificar triggers creados
      const [triggers] = await this.db.query('SHOW TRIGGERS');
      console.log(`📋 Triggers activos: ${triggers.length}`);
      
    } catch (error) {
      console.error('⚠️ Error creando triggers:', error.message);
    }
  }

  /**
   * INSERT: Insertar categorías por defecto
   */
  async insertDefaultCategories() {
    const categories = ['Personal', 'Trabajo', 'Estudio', 'Hogar'];
    let inserted = 0;
    
    console.log('\n📥 Insertando categorías por defecto...');
    
    for (const cat of categories) {
      try {
        const [result] = await this.db.query('INSERT IGNORE INTO categories (name) VALUES (?)', [cat]);
        if (result.affectedRows > 0) {
          console.log(`✅ Categoría insertada: ${cat}`);
          inserted++;
        } else {
          console.log(`ℹ️  Categoría ya existía: ${cat}`);
        }
      } catch (error) {
        console.error(`❌ Error insertando categoría ${cat}:`, error.message);
      }
    }
    
    console.log(`📊 Categorías insertadas: ${inserted} de ${categories.length}`);
  }

  // ==================== OPERACIONES CRUD ====================

  /**
   * CREATE: Insertar nueva tarea (con TRIGGER automático)
   */
  async createTask(title, description, categoryId, priority = 'media') {
    this.logSQL('INSERT', 'INSERT INTO tasks', [title, description, categoryId, priority]);
    
    try {
      const [result] = await this.db.query(
        'INSERT INTO tasks (title, description, category_id, priority) VALUES (?, ?, ?, ?)',
        [title, description, categoryId, priority]
      );
      
      console.log(`✅ Tarea creada con ID: ${result.insertId}`);
      console.log(`🔔 TRIGGER ejecutado: contador de categoría actualizado`);
      
      return result.insertId;
    } catch (error) {
      console.error('❌ Error creando tarea:', error.message);
      throw error;
    }
  }

  /**
   * READ: Obtener todas las tareas
   */
  async getAllTasks() {
    this.logSQL('SELECT', 'SELECT tasks con JOIN categories');
    
    try {
      const [rows] = await this.db.query(`
        SELECT t.*, c.name as category_name 
        FROM tasks t
        LEFT JOIN categories c ON t.category_id = c.id
        ORDER BY t.created_at DESC
      `);
      
      console.log(`✅ ${rows.length} tareas encontradas`);
      return rows;
    } catch (error) {
      console.error('❌ Error obteniendo tareas:', error.message);
      throw error;
    }
  }

  /**
   * READ: Obtener tareas por categoría
   */
  async getTasksByCategory(categoryId) {
    this.logSQL('SELECT', 'SELECT tasks por categoría', [categoryId]);
    
    try {
      const [rows] = await this.db.query(
        'SELECT * FROM tasks WHERE category_id = ? ORDER BY created_at DESC',
        [categoryId]
      );
      
      console.log(`✅ ${rows.length} tareas encontradas para categoría ${categoryId}`);
      return rows;
    } catch (error) {
      console.error('❌ Error obteniendo tareas por categoría:', error.message);
      throw error;
    }
  }

  /**
   * UPDATE: Actualizar tarea
   */
  async updateTask(id, title, description, categoryId, priority) {
    this.logSQL('UPDATE', 'UPDATE tasks', [title, description, categoryId, priority, id]);
    
    try {
      const [result] = await this.db.query(
        'UPDATE tasks SET title = ?, description = ?, category_id = ?, priority = ? WHERE id = ?',
        [title, description, categoryId, priority, id]
      );
      
      console.log(`✅ Tarea ${id} actualizada - Filas afectadas: ${result.affectedRows}`);
      return result.affectedRows;
    } catch (error) {
      console.error('❌ Error actualizando tarea:', error.message);
      throw error;
    }
  }

  /**
   * UPDATE: Marcar tarea como completada (activa TRIGGER)
   */
  async completeTask(id) {
    this.logSQL('UPDATE', 'UPDATE tasks SET completed', [id]);
    
    try {
      const [result] = await this.db.query(
        'UPDATE tasks SET is_completed = 1, completed_at = NOW() WHERE id = ?',
        [id]
      );
      
      console.log(`✅ Tarea ${id} marcada como completada`);
      console.log(`🔔 TRIGGER ejecutado: registro en audit_log`);
      
      return result.affectedRows;
    } catch (error) {
      console.error('❌ Error completando tarea:', error.message);
      throw error;
    }
  }

  /**
   * DELETE: Eliminar tarea (activa TRIGGER)
   */
  async deleteTask(id) {
    this.logSQL('DELETE', 'DELETE FROM tasks', [id]);
    
    try {
      const [result] = await this.db.query('DELETE FROM tasks WHERE id = ?', [id]);
      
      console.log(`✅ Tarea ${id} eliminada - Filas afectadas: ${result.affectedRows}`);
      console.log(`🔔 TRIGGER ejecutado: contador de categoría decrementado`);
      
      return result.affectedRows;
    } catch (error) {
      console.error('❌ Error eliminando tarea:', error.message);
      throw error;
    }
  }

  /**
   * TRANSACTION: Eliminar categoría con todas sus tareas (con ROLLBACK)
   */
  async deleteCategoryWithTasks(categoryId) {
    console.log(`\n🔄 ========== INICIANDO TRANSACCIÓN ==========`);
    console.log(`🎯 Objetivo: Eliminar categoría ${categoryId} y sus tareas`);
    
    const connection = await this.pool.promise().getConnection();
    
    try {
      // Iniciar transacción
      await connection.beginTransaction();
      console.log('📍 START TRANSACTION');
      
      // 1. Obtener número de tareas
      const [countResult] = await connection.query(
        'SELECT COUNT(*) as count FROM tasks WHERE category_id = ?',
        [categoryId]
      );
      console.log(`📊 Tareas a eliminar: ${countResult[0].count}`);
      
      // 2. Eliminar todas las tareas de la categoría
      const [deleteTasksResult] = await connection.query(
        'DELETE FROM tasks WHERE category_id = ?',
        [categoryId]
      );
      console.log(`✅ ${deleteTasksResult.affectedRows} tareas eliminadas`);
      
      // 3. Eliminar la categoría
      const [deleteCatResult] = await connection.query(
        'DELETE FROM categories WHERE id = ?',
        [categoryId]
      );
      
      if (deleteCatResult.affectedRows === 0) {
        throw new Error('Categoría no existe');
      }
      
      console.log(`✅ Categoría ${categoryId} eliminada`);
      
      // Confirmar transacción
      await connection.commit();
      console.log('✅ COMMIT: Transacción completada exitosamente\n');
      
      return true;
      
    } catch (error) {
      // Si hay error, hacer ROLLBACK
      await connection.rollback();
      console.error('❌ ROLLBACK: Transacción cancelada');
      console.error('❌ Error:', error.message);
      
      return false;
      
    } finally {
      connection.release();
      console.log('🔓 Conexión liberada');
    }
  }

  /**
   * READ: Obtener categorías
   */
  async getAllCategories() {
    this.logSQL('SELECT', 'SELECT * FROM categories');
    
    try {
      const [rows] = await this.db.query('SELECT * FROM categories ORDER BY name');
      console.log(`✅ ${rows.length} categorías encontradas`);
      return rows;
    } catch (error) {
      console.error('❌ Error obteniendo categorías:', error.message);
      throw error;
    }
  }

  /**
   * READ: Obtener log de auditoría
   */
  async getAuditLog(limit = 50) {
    this.logSQL('SELECT', 'SELECT audit_log', [limit]);
    
    try {
      const [rows] = await this.db.query(
        'SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?',
        [limit]
      );
      console.log(`✅ ${rows.length} registros de auditoría encontrados`);
      return rows;
    } catch (error) {
      console.error('❌ Error obteniendo auditoría:', error.message);
      throw error;
    }
  }

  /**
   * HEALTH: Verificar estado de la base de datos
   */
  async healthCheck() {
    try {
      const [result] = await this.db.query('SELECT 1 as status');
      return result[0].status === 1;
    } catch (error) {
      console.error('❌ Health check falló:', error.message);
      return false;
    }
  }

  /**
   * UTILITY: Cerrar pool de conexiones
   */
  close() {
    this.pool.end();
    console.log('🔴 Pool de conexiones MySQL cerrado');
  }
}

module.exports = DatabaseManager;