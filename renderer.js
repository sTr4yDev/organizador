/**
 * RENDERER.JS - Lógica de la Interfaz (CON ESPERA INTELIGENTE)
 * 
 * CONECTADO A BASE DE DATOS REAL - Con sistema de espera y reintentos
 */

const DatabaseManager = require('./database.js');
const db = new DatabaseManager();

// ==================== VARIABLES GLOBALES ====================
let editingTaskId = null;
let currentTasks = [];
let currentCategories = [];
let isDatabaseReady = false;

// ==================== ESTADO DE MYSQL ====================
let dbStatus = 'connecting';

// Función para actualizar el estado de MySQL
function updateDatabaseStatus(status, message = '') {
    dbStatus = status;
    const statusElement = document.getElementById('database-status');
    const consoleStatus = document.getElementById('console-status');
    
    const statusConfig = {
        connecting: { class: 'connecting', text: 'Conectando a MySQL...', color: '🟡' },
        connected: { class: 'connected', text: 'MySQL Conectado ✓', color: '🟢' },
        error: { class: 'error', text: 'Error en MySQL ✗', color: '🔴' }
    };
    
    const config = statusConfig[status];
    
    if (statusElement) {
        statusElement.innerHTML = `
            <div class="status-indicator ${config.class}">
                <div class="status-dot ${config.class}"></div>
                <span>${config.text} ${message}</span>
            </div>
        `;
    }
    
    if (consoleStatus) {
        consoleStatus.innerHTML = `
            <div class="status-dot ${config.class}"></div>
            <span>${config.text} ${message}</span>
        `;
    }
    
    // Agregar a consola
    addConsoleEntry(`${config.color} ${config.text} ${message}`, 'system');
}

// Función mejorada para consola
function addConsoleEntry(message, type = 'system') {
    const consoleOutput = document.getElementById('console-output');
    const timestamp = new Date().toLocaleTimeString();
    
    const entry = document.createElement('div');
    entry.className = `console-entry ${type}`;
    entry.innerHTML = `
        <span class="timestamp">[${timestamp}]</span>
        <span class="message">${message}</span>
    `;
    
    consoleOutput.appendChild(entry);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

// ==================== NAVEGACIÓN ====================
document.querySelectorAll('.menu-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        // Remover activo de todos los botones
        document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
        // Agregar activo al botón clickeado
        this.classList.add('active');
        
        // Ocultar todas las secciones
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Mostrar la sección correspondiente
        const sectionId = this.getAttribute('data-section');
        document.getElementById(`section-${sectionId}`).classList.add('active');
        
        console.log(`Navegando a: ${sectionId}`);
        addConsoleEntry(`📁 Navegando a sección: ${sectionId}`, 'system');
    });
});

// ==================== SISTEMA DE ESPERA INTELIGENTE ====================

/**
 * WAIT FOR DATABASE: Espera hasta que la base de datos esté lista
 */
async function waitForDatabase() {
    const maxAttempts = 30; // Máximo 30 intentos (15 segundos)
    const delay = 500; // 500ms entre intentos
    
    addConsoleEntry('⏳ Iniciando espera para base de datos...', 'system');
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            addConsoleEntry(`🔍 Intento ${attempt}/${maxAttempts}: Verificando base de datos...`, 'system');
            
            // Intentar una operación simple para verificar si la BD está lista
            const categories = await db.getAllCategories().catch(() => []);
            
            // Si podemos obtener categorías sin error, la BD está lista
            if (Array.isArray(categories)) {
                addConsoleEntry(`✅ Base de datos VERIFICADA en intento ${attempt}`, 'success');
                isDatabaseReady = true;
                return true;
            }
        } catch (error) {
            // Ignorar errores y continuar intentando
            if (error.message.includes('Table') && error.message.includes('doesn\'t exist')) {
                addConsoleEntry(`🔄 Tablas no listas aún (${attempt}/${maxAttempts})...`, 'warning');
            } else {
                addConsoleEntry(`⚠️ Error en intento ${attempt}: ${error.message}`, 'warning');
            }
        }
        
        // Esperar antes del próximo intento
        if (attempt < maxAttempts) {
            addConsoleEntry(`⏱️ Esperando ${delay}ms...`, 'system');
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    // Si llegamos aquí, se agotaron los intentos
    throw new Error(`No se pudo conectar a la base de datos después de ${maxAttempts} intentos`);
}

/**
 * SAFE DATABASE OPERATION: Ejecuta operaciones de BD de manera segura
 */
async function safeDbOperation(operation, operationName) {
    if (!isDatabaseReady) {
        addConsoleEntry(`⚠️ Base de datos no lista para: ${operationName}`, 'warning');
        return null;
    }
    
    try {
        return await operation();
    } catch (error) {
        addConsoleEntry(`❌ Error en ${operationName}: ${error.message}`, 'error');
        return null;
    }
}

// ==================== CARGAR DATOS REALES DE MYSQL ====================

// Cargar tareas REALES desde MySQL
async function loadTasks() {
    addConsoleEntry('📋 Solicitando carga de tareas...', 'system');
    
    const tasks = await safeDbOperation(() => db.getAllTasks(), 'cargar tareas');
    if (!tasks) return;
    
    currentTasks = tasks;
    const tasksList = document.getElementById('tasks-list');
    
    if (currentTasks.length === 0) {
        tasksList.innerHTML = '<div class="empty-state"><p>No hay tareas. ¡Crea tu primera tarea!</p></div>';
        addConsoleEntry('ℹ️ No hay tareas en la base de datos', 'system');
    } else {
        tasksList.innerHTML = currentTasks.map(task => `
            <div class="task-item ${task.is_completed ? 'completed' : ''} priority-${task.priority}">
                <div class="task-info">
                    <div class="task-title">${escapeHtml(task.title)}</div>
                    <div class="task-meta">
                        ${task.category_name ? `<span>🏷️ ${escapeHtml(task.category_name)}</span>` : ''}
                        <span>⏰ ${formatDate(task.created_at)}</span>
                        ${task.is_completed ? `<span>✅ Completada: ${formatDate(task.completed_at)}</span>` : ''}
                        <span>${getPriorityIcon(task.priority)} ${task.priority}</span>
                    </div>
                    ${task.description ? `<div style="margin-top:8px; font-size:13px; color:#666">${escapeHtml(task.description)}</div>` : ''}
                </div>
                <div class="task-actions">
                    ${!task.is_completed ? `
                        <button class="btn-small btn-success" onclick="completeTask(${task.id})">✅ Completar</button>
                        <button class="btn-small btn-warning" onclick="editTask(${task.id})">✏️ Editar</button>
                    ` : ''}
                    <button class="btn-small btn-danger" onclick="deleteTask(${task.id})">🗑️ Eliminar</button>
                </div>
            </div>
        `).join('');
        
        addConsoleEntry(`✅ ${currentTasks.length} tareas cargadas desde MySQL`, 'success');
    }
    
    updateTasksCount(currentTasks.length);
}

// Cargar categorías REALES desde MySQL
async function loadCategories() {
    addConsoleEntry('🏷️ Solicitando carga de categorías...', 'system');
    
    const categories = await safeDbOperation(() => db.getAllCategories(), 'cargar categorías');
    if (!categories) return;
    
    currentCategories = categories;
    const categoriesList = document.getElementById('categories-list');
    
    if (currentCategories.length === 0) {
        categoriesList.innerHTML = '<div class="empty-state"><p>No hay categorías</p></div>';
        addConsoleEntry('ℹ️ No hay categorías en la base de datos', 'system');
    } else {
        categoriesList.innerHTML = currentCategories.map(cat => `
            <div class="category-item">
                <div class="category-info">
                    <div class="category-name">🏷️ ${escapeHtml(cat.name)}</div>
                    <div class="category-count">${cat.task_count} tareas</div>
                </div>
                <div class="task-actions">
                    <button class="btn-small btn-danger" onclick="deleteCategory(${cat.id})">🗑️ Eliminar</button>
                </div>
            </div>
        `).join('');
        
        addConsoleEntry(`✅ ${currentCategories.length} categorías cargadas desde MySQL`, 'success');
    }
    
    updateCategoriesCount(currentCategories.length);
}

// Cargar auditoría REAL desde MySQL
async function loadAuditLog() {
    addConsoleEntry('📊 Solicitando carga de auditoría...', 'system');
    
    const logs = await safeDbOperation(() => db.getAuditLog(50), 'cargar auditoría');
    if (!logs) return;
    
    const auditLog = document.getElementById('audit-log');
    
    if (logs.length === 0) {
        auditLog.innerHTML = '<div class="empty-state"><p>No hay registros en el log</p></div>';
        addConsoleEntry('ℹ️ No hay registros de auditoría', 'system');
    } else {
        auditLog.innerHTML = logs.map(log => `
            <div class="audit-item">
                <div class="audit-header">
                    <span class="audit-action">${log.action} - ${log.table_name}</span>
                    <span class="audit-time">${formatDate(log.timestamp)}</span>
                </div>
                <div class="audit-details">${escapeHtml(log.details || `ID: ${log.record_id}`)}</div>
            </div>
        `).join('');
        
        addConsoleEntry(`✅ ${logs.length} registros de auditoría cargados`, 'success');
    }
    
    updateAuditCount(logs.length);
}

// Cargar categorías en selects
async function loadCategoriesSelect() {
    addConsoleEntry('📝 Actualizando selects de categorías...', 'system');
    
    const categories = await safeDbOperation(() => db.getAllCategories(), 'cargar categorías para selects');
    if (!categories) return;
    
    const selects = [
        document.getElementById('task-category'),
        document.getElementById('demo-category')
    ];
    
    selects.forEach(select => {
        if (select) {
            const currentValue = select.value;
            select.innerHTML = select.id === 'task-category' 
                ? '<option value="">Sin categoría</option>' 
                : '<option value="">-- Seleccionar --</option>';
            
            categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.id;
                option.textContent = `${cat.name} (${cat.task_count} tareas)`;
                select.appendChild(option);
            });
            
            select.value = currentValue;
        }
    });
    
    addConsoleEntry('✅ Selects de categorías actualizados', 'success');
}

// ==================== OPERACIONES CRUD REALES ====================

// Crear/Actualizar tarea REAL
document.getElementById('task-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    if (!isDatabaseReady) {
        addConsoleEntry('❌ Base de datos no está lista. Espere...', 'error');
        alert('⚠️ La base de datos no está lista. Por favor espere unos segundos.');
        return;
    }
    
    const title = document.getElementById('task-title').value.trim();
    const description = document.getElementById('task-description').value.trim();
    const categoryId = document.getElementById('task-category').value || null;
    const priority = document.getElementById('task-priority').value;
    
    if (!title) {
        alert('El título es obligatorio');
        return;
    }
    
    addConsoleEntry('📝 Procesando formulario de tarea...', 'system');
    
    try {
        if (editingTaskId) {
            addConsoleEntry(`🔄 Actualizando tarea ID: ${editingTaskId}`, 'system');
            await db.updateTask(editingTaskId, title, description, categoryId, priority);
            addConsoleEntry(`✅ Tarea "${title}" actualizada correctamente`, 'success');
            cancelEdit();
        } else {
            addConsoleEntry(`➕ Creando nueva tarea: "${title}"`, 'system');
            const newTaskId = await db.createTask(title, description, categoryId, priority);
            addConsoleEntry(`✅ Tarea creada con ID: ${newTaskId}`, 'success');
        }
        
        this.reset();
        await loadTasks();
        await loadCategories(); // Para actualizar contadores
        
    } catch (error) {
        addConsoleEntry(`❌ Error guardando tarea: ${error.message}`, 'error');
        alert('❌ Error: ' + error.message);
    }
});

// Completar tarea REAL
async function completeTask(id) {
    if (!isDatabaseReady) {
        alert('⚠️ La base de datos no está lista. Por favor espere.');
        return;
    }
    
    if (confirm('¿Marcar esta tarea como completada?')) {
        addConsoleEntry(`✅ Completando tarea ID: ${id}`, 'system');
        
        try {
            await db.completeTask(id);
            addConsoleEntry(`✅ Tarea ${id} marcada como completada`, 'success');
            await loadTasks();
            await loadAuditLog(); // Para ver el trigger en acción
            
        } catch (error) {
            addConsoleEntry(`❌ Error completando tarea: ${error.message}`, 'error');
            alert('❌ Error: ' + error.message);
        }
    }
}

// Editar tarea REAL
async function editTask(id) {
    if (!isDatabaseReady) {
        alert('⚠️ La base de datos no está lista. Por favor espere.');
        return;
    }
    
    try {
        const task = currentTasks.find(t => t.id === id);
        
        if (!task) {
            addConsoleEntry(`❌ Tarea ${id} no encontrada`, 'error');
            return;
        }
        
        editingTaskId = id;
        document.getElementById('task-title').value = task.title;
        document.getElementById('task-description').value = task.description || '';
        document.getElementById('task-category').value = task.category_id || '';
        document.getElementById('task-priority').value = task.priority;
        
        document.getElementById('form-title').textContent = '✏️ Editar Tarea';
        document.getElementById('cancel-edit').style.display = 'inline-block';
        
        addConsoleEntry(`✏️ Editando tarea: "${task.title}"`, 'system');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
    } catch (error) {
        addConsoleEntry(`❌ Error editando tarea: ${error.message}`, 'error');
        alert('❌ Error: ' + error.message);
    }
}

// Cancelar edición
document.getElementById('cancel-edit').addEventListener('click', cancelEdit);

function cancelEdit() {
    editingTaskId = null;
    document.getElementById('task-form').reset();
    document.getElementById('form-title').textContent = '➕ Nueva Tarea';
    document.getElementById('cancel-edit').style.display = 'none';
    addConsoleEntry('❌ Edición cancelada', 'system');
}

// Eliminar tarea REAL
async function deleteTask(id) {
    if (!isDatabaseReady) {
        alert('⚠️ La base de datos no está lista. Por favor espere.');
        return;
    }
    
    if (confirm('¿Estás seguro de eliminar esta tarea?')) {
        addConsoleEntry(`🗑️ Eliminando tarea ID: ${id}`, 'system');
        
        try {
            await db.deleteTask(id);
            addConsoleEntry(`✅ Tarea ${id} eliminada correctamente`, 'success');
            await loadTasks();
            await loadCategories(); // Para actualizar contadores
            await loadAuditLog(); // Para ver el trigger
            
        } catch (error) {
            addConsoleEntry(`❌ Error eliminando tarea: ${error.message}`, 'error');
            alert('❌ Error: ' + error.message);
        }
    }
}

// Crear categoría REAL
document.getElementById('category-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    if (!isDatabaseReady) {
        alert('⚠️ La base de datos no está lista. Por favor espere.');
        return;
    }
    
    const name = document.getElementById('category-name').value.trim();
    
    if (!name) {
        alert('El nombre es obligatorio');
        return;
    }
    
    addConsoleEntry(`🏷️ Creando nueva categoría: "${name}"`, 'system');
    
    try {
        await db.db.query('INSERT INTO categories (name) VALUES (?)', [name]);
        addConsoleEntry(`✅ Categoría "${name}" creada correctamente`, 'success');
        
        this.reset();
        await loadCategories();
        await loadCategoriesSelect();
        
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            addConsoleEntry(`❌ Ya existe una categoría con el nombre "${name}"`, 'error');
            alert('❌ Error: Ya existe una categoría con ese nombre');
        } else {
            addConsoleEntry(`❌ Error creando categoría: ${error.message}`, 'error');
            alert('❌ Error: ' + error.message);
        }
    }
});

// Eliminar categoría REAL
async function deleteCategory(id) {
    if (!isDatabaseReady) {
        alert('⚠️ La base de datos no está lista. Por favor espere.');
        return;
    }
    
    const category = currentCategories.find(c => c.id === id);
    if (!category) return;
    
    if (confirm(`¿Eliminar la categoría "${category.name}"? Las tareas asociadas quedarán sin categoría.`)) {
        addConsoleEntry(`🗑️ Eliminando categoría: "${category.name}"`, 'system');
        
        try {
            await db.db.query('DELETE FROM categories WHERE id = ?', [id]);
            addConsoleEntry(`✅ Categoría "${category.name}" eliminada`, 'success');
            
            await loadCategories();
            await loadCategoriesSelect();
            await loadTasks(); // Para actualizar las tareas que perdieron categoría
            
        } catch (error) {
            addConsoleEntry(`❌ Error eliminando categoría: ${error.message}`, 'error');
            alert('❌ Error: ' + error.message);
        }
    }
}

// ==================== DEMO TRANSACCIÓN REAL ====================
document.getElementById('demo-transaction').addEventListener('click', async function() {
    if (!isDatabaseReady) {
        alert('⚠️ La base de datos no está lista. Por favor espere.');
        return;
    }
    
    const categoryId = document.getElementById('demo-category').value;
    
    if (!categoryId) {
        alert('Selecciona una categoría primero');
        return;
    }
    
    const category = currentCategories.find(c => c.id == categoryId);
    if (!category) return;
    
    const resultDiv = document.getElementById('demo-result');
    resultDiv.className = 'demo-result show';
    
    addConsoleEntry(`🔄 INICIANDO TRANSACCIÓN: Eliminar categoría "${category.name}"`, 'system');
    
    const success = await db.deleteCategoryWithTasks(parseInt(categoryId));
    
    if (success) {
        resultDiv.classList.add('success');
        resultDiv.innerHTML = `
            <strong>✅ TRANSACCIÓN EXITOSA</strong><br><br>
            Se ejecutaron los siguientes pasos:<br>
            1. START TRANSACTION<br>
            2. DELETE FROM tasks WHERE category_id = ${categoryId}<br>
            3. DELETE FROM categories WHERE id = ${categoryId}<br>
            4. COMMIT<br><br>
            ¡Transacción completada correctamente!<br>
            Categoría "${category.name}" y sus tareas eliminadas.
        `;
        
        addConsoleEntry(`✅ TRANSACCIÓN EXITOSA - COMMIT ejecutado`, 'success');
        alert('✅ Transacción completada con éxito');
        
        await loadCategories();
        await loadCategoriesSelect();
        await loadTasks();
        
    } else {
        resultDiv.classList.add('error');
        resultDiv.innerHTML = `
            <strong>❌ TRANSACCIÓN FALLIDA - ROLLBACK EJECUTADO</strong><br><br>
            La transacción fue revertida debido a un error.<br>
            Todos los cambios fueron deshechos (ROLLBACK).<br><br>
            ¡La categoría "${category.name}" y sus tareas se mantienen intactas!
        `;
        
        addConsoleEntry(`❌ TRANSACCIÓN FALLIDA - ROLLBACK ejecutado`, 'error');
        alert('❌ Transacción fallida. Se hizo ROLLBACK.');
    }
});

// ==================== UTILIDADES ====================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('es-MX', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getPriorityIcon(priority) {
    const icons = {
        'alta': '🔴',
        'media': '🟡',
        'baja': '🟢'
    };
    return icons[priority] || '⚪';
}

function updateTasksCount(count) {
    const badge = document.getElementById('tasks-count');
    if (badge) badge.textContent = count;
}

function updateCategoriesCount(count) {
    const badge = document.getElementById('categories-count');
    if (badge) badge.textContent = count;
}

function updateAuditCount(count) {
    const badge = document.getElementById('audit-count');
    if (badge) badge.textContent = count;
}

// ==================== INICIALIZACIÓN ====================
async function initializeApp() {
    addConsoleEntry('🚀 Iniciando aplicación Organizador de Tareas...', 'system');
    updateDatabaseStatus('connecting', 'Inicializando...');
    
    try {
        // ESPERAR INTELIGENTEMENTE a que la base de datos esté lista
        addConsoleEntry('🎯 Iniciando sistema de espera inteligente...', 'system');
        
        await waitForDatabase();
        
        // Base de datos verificada y lista
        updateDatabaseStatus('connected', 'organizador_tareas@localhost');
        addConsoleEntry('🎉 Base de datos CONECTADA y VERIFICADA', 'success');
        
        // Cargar datos iniciales
        addConsoleEntry('📥 Cargando datos iniciales...', 'system');
        await loadTasks();
        await loadCategories();
        await loadCategoriesSelect();
        await loadAuditLog();
        
        addConsoleEntry('✨ Aplicación completamente inicializada y lista para usar', 'success');
        
    } catch (error) {
        addConsoleEntry(`💥 ERROR CRÍTICO: ${error.message}`, 'error');
        updateDatabaseStatus('error', error.message);
        
        // Mostrar mensaje de error al usuario
        setTimeout(() => {
            alert(`Error crítico: ${error.message}\n\nRevisa la consola para más detalles.`);
        }, 1000);
    }
}

// Event listeners para controles de consola
document.getElementById('clear-console')?.addEventListener('click', () => {
    document.getElementById('console-output').innerHTML = '';
    addConsoleEntry('🧹 Consola limpiada', 'system');
});

document.getElementById('test-connection')?.addEventListener('click', async () => {
    addConsoleEntry('🔍 Probando conexión a MySQL...', 'system');
    try {
        if (isDatabaseReady) {
            addConsoleEntry('✅ Conexión a MySQL verificada correctamente', 'success');
        } else {
            addConsoleEntry('❌ Base de datos no está lista', 'error');
        }
    } catch (error) {
        addConsoleEntry(`❌ Error en conexión: ${error.message}`, 'error');
    }
});

document.getElementById('refresh-audit')?.addEventListener('click', async () => {
    if (!isDatabaseReady) {
        alert('⚠️ La base de datos no está lista. Por favor espere.');
        return;
    }
    await loadAuditLog();
});

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initializeApp);

// Hacer funciones globales para los onclick
window.completeTask = completeTask;
window.editTask = editTask;
window.deleteTask = deleteTask;
window.deleteCategory = deleteCategory;