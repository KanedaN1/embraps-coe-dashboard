/**
 * AGENDA COE - REWRITTEN FROM SCRATCH
 */

const STATE = {
    user: null,
    tasks: [],
    operators: {
        'iris': 'Iris Souza',
        'hallan': 'Hallan de Barros',
        'victor': 'Victor Dourado',
        'walmir': 'Walmir da Luz',
        'rodrigo': 'Rodrigo Vilanova',
        'nikolas': 'Nikolas Cardoso'
    },
    passwords: {
        'iris': 'iris123',
        'hallan': 'hallan123',
        'victor': 'victor123',
        'walmir': 'walmir123',
        'rodrigo': 'rodrigo123',
        'nikolas': 'nikolas123',
        'admin': 'admin'
    }
};

// ---------------------------------------------------------
// INITIALIZATION
// ---------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
    initTabs();
    
    // Auto-login if session exists
    const saved = sessionStorage.getItem('agenda_session');
    if (saved) {
        STATE.user = JSON.parse(saved);
        startApp();
    }
});

function initTabs() {
    const tabs = document.querySelectorAll('.agenda-admin-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const target = tab.getAttribute('data-tab');
            document.querySelectorAll('.agenda-tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById('tab-' + target).classList.add('active');
        });
    });
}

// ---------------------------------------------------------
// LOGIN LOGIC
// ---------------------------------------------------------

function setLoginType(type) {
    document.querySelectorAll('.agenda-tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('btn-tab-' + type).classList.add('active');
    
    document.getElementById('form-admin').style.display = type === 'admin' ? 'block' : 'none';
    document.getElementById('form-operador').style.display = type === 'operador' ? 'block' : 'none';
}

function handleLogin(type) {
    let success = false;
    let userData = null;

    if (type === 'admin') {
        const pass = document.getElementById('login-admin-pass').value;
        if (pass === STATE.passwords.admin) {
            success = true;
            userData = { type: 'admin', name: 'Gestor COE' };
        }
    } else {
        const opId = document.getElementById('login-operador-id').value;
        const pass = document.getElementById('login-operador-pass').value;
        if (opId && pass === STATE.passwords[opId]) {
            success = true;
            userData = { type: 'operador', id: opId, name: STATE.operators[opId] };
        }
    }

    if (success) {
        STATE.user = userData;
        sessionStorage.setItem('agenda_session', JSON.stringify(userData));
        startApp();
    } else {
        const err = document.getElementById('login-error');
        err.style.display = 'block';
        setTimeout(() => err.style.display = 'none', 3000);
    }
}

function handleLogout() {
    sessionStorage.removeItem('agenda_session');
    location.reload();
}

// ---------------------------------------------------------
// CORE APP LOGIC
// ---------------------------------------------------------

async function startApp() {
    document.getElementById('agenda-login-screen').style.display = 'none';
    document.getElementById('agenda-app').style.display = 'block';
    document.getElementById('user-display').textContent = STATE.user.name;

    if (STATE.user.type === 'admin') {
        document.getElementById('view-admin').style.display = 'block';
        populateOperatorFilter();
    } else {
        document.getElementById('view-operador').style.display = 'block';
    }

    // Subscribe to Firebase (Real-time)
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        const db = firebase.firestore();
        db.collection('agenda_tarefas').onSnapshot(snapshot => {
            STATE.tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            refreshUI();
            checkLateTasks();
        });
    } else {
        // Fallback for development if firebase fails
        STATE.tasks = JSON.parse(localStorage.getItem('agenda_tasks_offline') || '[]');
        refreshUI();
    }
}

function refreshUI() {
    if (STATE.user.type === 'admin') {
        renderAdminTasks();
        renderAdminKPIs();
        renderRanking();
        renderHistory();
    } else {
        renderOperadorTasks();
        renderOperadorKPIs();
    }
}

// ---------------------------------------------------------
// RENDERERS (ADMIN)
// ---------------------------------------------------------

function renderAdminKPIs() {
    const total = STATE.tasks.length;
    const concluidas = STATE.tasks.filter(t => t.status === 'concluida').length;
    const atrasadas = STATE.tasks.filter(t => t.status === 'atrasada').length;
    const sla = total > 0 ? Math.round((concluidas / total) * 100) : 100;

    const html = `
        <div class="agenda-kpi-card" style="border-left-color: #3b82f6"><h3>Total</h3><div class="value">${total}</div></div>
        <div class="agenda-kpi-card" style="border-left-color: #16a34a"><h3>Concluídas</h3><div class="value">${concluidas}</div></div>
        <div class="agenda-kpi-card" style="border-left-color: #dc2626"><h3>Em Atraso</h3><div class="value">${atrasadas}</div></div>
        <div class="agenda-kpi-card" style="border-left-color: #0284c7"><h3>SLA Geral</h3><div class="value">${sla}%</div></div>
    `;
    document.getElementById('admin-kpis').innerHTML = html;
}

function renderAdminTasks() {
    const opFilter = document.getElementById('filter-op').value;
    const statusFilter = document.getElementById('filter-status').value;

    let list = STATE.tasks;
    if (opFilter) list = list.filter(t => t.operadorId === opFilter);
    if (statusFilter) list = list.filter(t => t.status === statusFilter);

    // Sort: Late first, then Pending, then Concluded
    list.sort((a, b) => {
        const order = { 'atrasada': 0, 'pendente': 1, 'em_andamento': 2, 'concluida': 3 };
        return order[a.status] - order[b.status] || new Date(a.deadline) - new Date(b.deadline);
    });

    const body = document.getElementById('table-tasks-body');
    if (list.length === 0) {
        body.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 2rem;">Nenhuma atividade encontrada.</td></tr>';
        return;
    }

    body.innerHTML = list.map(t => `
        <tr>
            <td>
                <strong>${t.name}</strong><br>
                <small style="color: #64748b">${new Date(t.deadline).toLocaleString('pt-BR')}</small>
            </td>
            <td>${STATE.operators[t.operadorId] || t.operadorId}</td>
            <td><span class="badge badge-${t.status}">${t.status}</span></td>
            <td>
                <div style="display: flex; gap: 5px;">
                    ${t.status !== 'concluida' ? `<button class="btn-action success" onclick="openConcludeModal('${t.id}')"><i class="fa-solid fa-check"></i></button>` : ''}
                    <button class="btn-action primary" onclick="openTaskModal('${t.id}')"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-action danger" onclick="deleteTask('${t.id}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderRanking() {
    const results = Object.keys(STATE.operators).map(id => {
        const tasks = STATE.tasks.filter(t => t.operadorId === id);
        const done = tasks.filter(t => t.status === 'concluida').length;
        const total = tasks.length;
        const sla = total > 0 ? Math.round((done / total) * 100) : 100;
        return { name: STATE.operators[id], total, done, sla };
    }).sort((a, b) => b.sla - a.sla);

    document.getElementById('ranking-list').innerHTML = `
        <h2 style="margin-bottom: 2rem;">SLA por Operador</h2>
        ${results.map((r, idx) => `
            <div style="margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span><strong>${idx + 1}° ${r.name}</strong> (${r.done}/${r.total})</span>
                    <span><strong>${r.sla}%</strong></span>
                </div>
                <div style="background: #e2e8f0; height: 10px; border-radius: 5px; overflow: hidden;">
                    <div style="background: ${r.sla > 90 ? '#16a34a' : (r.sla > 70 ? '#f59e0b' : '#dc2626')}; width: ${r.sla}%; height: 100%;"></div>
                </div>
            </div>
        `).join('')}
    `;
}

function renderHistory() {
    const history = STATE.tasks.filter(t => t.status === 'concluida')
        .sort((a, b) => new Date(b.concluidaEm) - new Date(a.concluidaEm));

    const body = document.getElementById('table-history-body');
    body.innerHTML = history.map(t => `
        <tr>
            <td>${t.name}</td>
            <td>${t.concluidaPor || '-'}</td>
            <td>${new Date(t.concluidaEm).toLocaleString('pt-BR')}</td>
            <td><small>${t.concluidaObs || '-'}</small></td>
        </tr>
    `).join('');
}

// ---------------------------------------------------------
// RENDERERS (OPERADOR)
// ---------------------------------------------------------

function renderOperadorKPIs() {
    const minhas = STATE.tasks.filter(t => t.operadorId === STATE.user.id);
    const done = minhas.filter(t => t.status === 'concluida').length;
    const total = minhas.length;
    const sla = total > 0 ? Math.round((done / total) * 100) : 100;
    const late = minhas.filter(t => t.status === 'atrasada').length;

    const html = `
        <div class="agenda-kpi-card"><h3>Minhas Tarefas</h3><div class="value">${total}</div></div>
        <div class="agenda-kpi-card" style="border-left-color: #0284c7"><h3>Meu SLA</h3><div class="value">${sla}%</div></div>
        <div class="agenda-kpi-card" style="border-left-color: #dc2626"><h3>Atrasos</h3><div class="value">${late}</div></div>
    `;
    document.getElementById('operador-kpis').innerHTML = html;
}

function renderOperadorTasks() {
    const minhas = STATE.tasks.filter(t => t.operadorId === STATE.user.id);
    const list = document.getElementById('operador-tasks-list');
    
    if (minhas.length === 0) {
        list.innerHTML = '<div class="card" style="padding: 2rem; text-align:center;">Nenhuma atividade atribuída para você.</div>';
        return;
    }

    list.innerHTML = minhas.map(t => `
        <div class="card" style="padding: 1.5rem; margin-bottom: 1rem; border-left: 5px solid ${t.status === 'atrasada' ? '#dc2626' : (t.status === 'concluida' ? '#16a34a' : '#3b82f6')}">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                    <h3 style="margin: 0;">${t.name}</h3>
                    <p style="margin: 5px 0; color: #64748b; font-size: 0.9rem;">${t.desc || 'Sem descrição.'}</p>
                    <small>Prazo: <strong>${new Date(t.deadline).toLocaleString('pt-BR')}</strong></small>
                </div>
                <div style="text-align: right;">
                    <span class="badge badge-${t.status}" style="display: block; margin-bottom: 10px;">${t.status}</span>
                    ${t.status === 'pendente' ? `<button class="agenda-btn-primary" onclick="openConcludeModal('${t.id}')" style="padding: 8px 15px; font-size: 0.8rem;">Concluir</button>` : ''}
                    ${t.status === 'atrasada' ? `<small style="color: #dc2626; font-weight: bold;">Bloqueado: Contate o Admin</small>` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

// ---------------------------------------------------------
// CRUD ACTIONS
// ---------------------------------------------------------

function openTaskModal(id = null) {
    const modal = document.getElementById('modal-task');
    const title = document.getElementById('modal-task-title');
    
    if (id) {
        const t = STATE.tasks.find(x => x.id === id);
        title.textContent = 'Editar Atividade';
        document.getElementById('task-id').value = id;
        document.getElementById('task-name').value = t.name;
        document.getElementById('task-op-id').value = t.operadorId;
        document.getElementById('task-freq').value = t.freq;
        document.getElementById('task-deadline').value = t.deadline;
        document.getElementById('task-priority').value = t.priority;
        document.getElementById('task-desc').value = t.desc || '';
    } else {
        title.textContent = 'Nova Atividade';
        document.getElementById('task-id').value = '';
        document.getElementById('task-name').value = '';
        document.getElementById('task-deadline').value = '';
        document.getElementById('task-desc').value = '';
    }
    
    modal.style.display = 'flex';
}

function closeTaskModal() {
    document.getElementById('modal-task').style.display = 'none';
}

async function saveTask() {
    const id = document.getElementById('task-id').value;
    const data = {
        name: document.getElementById('task-name').value,
        operadorId: document.getElementById('task-op-id').value,
        freq: document.getElementById('task-freq').value,
        deadline: document.getElementById('task-deadline').value,
        priority: document.getElementById('task-priority').value,
        desc: document.getElementById('task-desc').value,
        status: id ? STATE.tasks.find(t => t.id === id).status : 'pendente',
        criadaEm: id ? STATE.tasks.find(t => t.id === id).criadaEm : new Date().toISOString()
    };

    if (!data.name || !data.deadline) return alert('Título e Prazo são obrigatórios!');

    try {
        const db = firebase.firestore();
        if (id) {
            await db.collection('agenda_tarefas').doc(id).update(data);
        } else {
            await db.collection('agenda_tarefas').add(data);
        }
        closeTaskModal();
    } catch (e) {
        console.error(e);
        // Offline fallback
        const offline = JSON.parse(localStorage.getItem('agenda_tasks_offline') || '[]');
        if (id) {
            const idx = offline.findIndex(x => x.id === id);
            offline[idx] = { ...data, id };
        } else {
            offline.push({ ...data, id: Date.now().toString() });
        }
        localStorage.setItem('agenda_tasks_offline', JSON.stringify(offline));
        location.reload(); // Refresh to show changes if offline
    }
}

async function deleteTask(id) {
    if (!confirm('Deseja excluir esta atividade?')) return;
    const db = firebase.firestore();
    await db.collection('agenda_tarefas').doc(id).delete();
}

// ---------------------------------------------------------
// CONCLUSION MODAL
// ---------------------------------------------------------

function openConcludeModal(id) {
    const t = STATE.tasks.find(x => x.id === id);
    document.getElementById('conclude-task-id').value = id;
    document.getElementById('conclude-task-name').textContent = t.name;
    document.getElementById('conclude-obs').value = '';
    document.getElementById('modal-conclude').style.display = 'flex';
}

function closeConcludeModal() {
    document.getElementById('modal-conclude').style.display = 'none';
}

async function confirmConclusion() {
    const id = document.getElementById('conclude-task-id').value;
    const obs = document.getElementById('conclude-obs').value;
    
    const db = firebase.firestore();
    await db.collection('agenda_tarefas').doc(id).update({
        status: 'concluida',
        concluidaEm: new Date().toISOString(),
        concluidaPor: STATE.user.name,
        concluidaObs: obs
    });
    
    closeConcludeModal();
}

// ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------

function populateOperatorFilter() {
    const select = document.getElementById('filter-op');
    select.innerHTML = '<option value="">Todos Operadores</option>' + 
        Object.keys(STATE.operators).map(id => `<option value="${id}">${STATE.operators[id]}</option>`).join('');
}

function checkLateTasks() {
    const agora = new Date();
    const db = firebase.firestore();
    
    STATE.tasks.forEach(t => {
        if (t.status === 'pendente' && new Date(t.deadline) < agora) {
            db.collection('agenda_tarefas').doc(t.id).update({ status: 'atrasada' });
        }
    });
}
