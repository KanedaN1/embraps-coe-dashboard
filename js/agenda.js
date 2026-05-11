/**
 * AGENDA COE — agenda.js v2.0
 *
 * IMPORTANT: This file depends on firebase-config.js being loaded first,
 * which sets the globals: `db` (Firestore instance) and `useFirebase` (boolean).
 *
 * Storage: Firestore collection `agenda_tarefas`.
 * LocalStorage fallback: key `ag_tasks_offline`.
 */

/* ================================================================
   CONSTANTS
   ================================================================ */
const AG_LS_KEY = 'ag_tasks_offline';

const AG_OPERATORS = {
    'iris':    'Iris Souza',
    'hallan':  'Hallan de Barros',
    'victor':  'Victor Dourado',
    'walmir':  'Walmir da Luz',
    'rodrigo': 'Rodrigo Vilanova',
    'nikolas': 'Nikolas Cardoso'
};

const AG_PASSWORDS = {
    admin:    'admin',
    iris:     'iris123',
    hallan:   'hallan123',
    victor:   'victor123',
    walmir:   'walmir123',
    rodrigo:  'rodrigo123',
    nikolas:  'nikolas123'
};

/* ================================================================
   STATE
   ================================================================ */
let AG_USER  = null;   // { type: 'admin'|'operador', id?, name }
let AG_TASKS = [];     // cached array of task objects

/* ================================================================
   BOOT
   ================================================================ */
document.addEventListener('DOMContentLoaded', () => {
    // Restore session
    const saved = sessionStorage.getItem('ag_session');
    if (saved) {
        try {
            AG_USER = JSON.parse(saved);
            ag_showApp();
        } catch(e) {
            sessionStorage.removeItem('ag_session');
        }
    }

    // Display today's date
    const el = document.getElementById('ag-date-display');
    if (el) el.textContent = new Date().toLocaleDateString('pt-BR', { weekday:'short', day:'numeric', month:'short' });
});

/* ================================================================
   LOGIN / LOGOUT
   ================================================================ */
function ag_setType(type) {
    document.querySelectorAll('.ag-type-tab').forEach(b => b.classList.remove('active'));
    event.currentTarget.classList.add('active');
    document.getElementById('ag-form-admin').style.display    = (type === 'admin')    ? 'block' : 'none';
    document.getElementById('ag-form-operador').style.display = (type === 'operador') ? 'block' : 'none';
}

function ag_login(type) {
    const errEl = document.getElementById('ag-login-err');
    errEl.style.display = 'none';

    let ok = false;
    if (type === 'admin') {
        const pw = document.getElementById('ag-admin-pw').value;
        ok = (pw === AG_PASSWORDS.admin);
        if (ok) AG_USER = { type: 'admin', name: 'Gestor COE' };
    } else {
        const id = document.getElementById('ag-op-select').value;
        const pw = document.getElementById('ag-op-pw').value;
        ok = (id && pw === AG_PASSWORDS[id]);
        if (ok) AG_USER = { type: 'operador', id, name: AG_OPERATORS[id] };
    }

    if (ok) {
        sessionStorage.setItem('ag_session', JSON.stringify(AG_USER));
        ag_showApp();
    } else {
        errEl.style.display = 'block';
        setTimeout(() => errEl.style.display = 'none', 3000);
    }
}

function ag_logout() {
    sessionStorage.removeItem('ag_session');
    location.reload();
}

/* ================================================================
   APP INIT
   ================================================================ */
function ag_showApp() {
    document.getElementById('ag-login').style.display = 'none';
    document.getElementById('ag-app').style.display   = 'block';
    document.getElementById('ag-user-name').textContent = AG_USER.name;

    if (AG_USER.type === 'admin') {
        document.getElementById('ag-view-admin').style.display    = 'block';
        document.getElementById('ag-view-operador').style.display = 'none';
    } else {
        document.getElementById('ag-view-admin').style.display    = 'none';
        document.getElementById('ag-view-operador').style.display = 'block';
    }

    ag_loadTasks();
}

/* ================================================================
   DATA LAYER — Load / Save / Delete
   ================================================================ */
async function ag_loadTasks() {
    try {
        if (useFirebase && db) {
            const snap = await db.collection('agenda_tarefas').get();
            AG_TASKS = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } else {
            AG_TASKS = JSON.parse(localStorage.getItem(AG_LS_KEY) || '[]');
        }
    } catch (err) {
        console.warn('[AG] Load failed, using offline cache.', err.message);
        AG_TASKS = JSON.parse(localStorage.getItem(AG_LS_KEY) || '[]');
    }

    ag_checkLate();
    ag_refreshUI();
}

async function ag_persistTask(data, id) {
    /* id is provided for update, null/undefined for create */
    try {
        if (useFirebase && db) {
            if (id) {
                await db.collection('agenda_tarefas').doc(id).set(data, { merge: true });
            } else {
                const ref = await db.collection('agenda_tarefas').add(data);
                data.id = ref.id;
            }
        }
    } catch (err) {
        console.warn('[AG] Firestore persist failed — offline save.', err.message);
    }

    // Always mirror to localStorage
    const local = JSON.parse(localStorage.getItem(AG_LS_KEY) || '[]');
    if (id) {
        const i = local.findIndex(t => t.id === id);
        if (i >= 0) local[i] = { ...data, id };
        else local.push({ ...data, id });
    } else {
        if (!data.id) data.id = 'local_' + Date.now();
        local.push(data);
    }
    localStorage.setItem(AG_LS_KEY, JSON.stringify(local));
}

async function ag_deleteFromDb(id) {
    try {
        if (useFirebase && db) {
            await db.collection('agenda_tarefas').doc(id).delete();
        }
    } catch (err) {
        console.warn('[AG] Delete failed.', err.message);
    }
    const local = JSON.parse(localStorage.getItem(AG_LS_KEY) || '[]').filter(t => t.id !== id);
    localStorage.setItem(AG_LS_KEY, JSON.stringify(local));
}

/* ================================================================
   AUTO-LATE CHECK
   ================================================================ */
function ag_checkLate() {
    const now = new Date();
    AG_TASKS.forEach(t => {
        if (t.status === 'pendente' && t.deadline && new Date(t.deadline) < now) {
            t.status = 'atrasada';
            ag_persistTask({ ...t }, t.id);
        }
    });
}

/* ================================================================
   UI REFRESH (master)
   ================================================================ */
function ag_refreshUI() {
    if (AG_USER.type === 'admin') {
        ag_renderAdminKPIs();
        ag_renderAdminTable();
        ag_renderRanking();
        ag_renderHistory();
    } else {
        ag_renderOpKPIs();
        ag_renderOpTasks();
    }
}

/* ================================================================
   ADMIN — KPIs
   ================================================================ */
function ag_renderAdminKPIs() {
    const total      = AG_TASKS.length;
    const concluidas = AG_TASKS.filter(t => t.status === 'concluida').length;
    const atrasadas  = AG_TASKS.filter(t => t.status === 'atrasada').length;
    const pendentes  = AG_TASKS.filter(t => t.status === 'pendente').length;
    const sla        = total > 0 ? Math.round(concluidas / total * 100) : 100;

    document.getElementById('ag-kpi-admin').innerHTML = `
        <div class="ag-kpi-card" style="border-left-color:#3b82f6">
            <h4>Total</h4><div class="ag-kpi-val">${total}</div>
        </div>
        <div class="ag-kpi-card" style="border-left-color:#16a34a">
            <h4>Concluídas</h4><div class="ag-kpi-val">${concluidas}</div>
        </div>
        <div class="ag-kpi-card" style="border-left-color:#f59e0b">
            <h4>Pendentes</h4><div class="ag-kpi-val">${pendentes}</div>
        </div>
        <div class="ag-kpi-card" style="border-left-color:#dc2626">
            <h4>Em Atraso</h4><div class="ag-kpi-val">${atrasadas}</div>
        </div>
        <div class="ag-kpi-card" style="border-left-color:#7c3aed">
            <h4>SLA Geral</h4><div class="ag-kpi-val" style="color:${sla>=90?'#16a34a':sla>=70?'#f59e0b':'#dc2626'}">${sla}%</div>
        </div>
    `;
}

/* ================================================================
   ADMIN — TASKS TABLE
   ================================================================ */
function ag_renderAdminTable() {
    const opF  = document.getElementById('ag-filter-op').value;
    const stF  = document.getElementById('ag-filter-status').value;

    let list = [...AG_TASKS];
    if (opF)  list = list.filter(t => t.operadorId === opF);
    if (stF)  list = list.filter(t => t.status === stF);

    // Sort: atrasada → pendente → concluida
    const ord = { atrasada:0, pendente:1, concluida:2 };
    list.sort((a, b) => (ord[a.status]??1) - (ord[b.status]??1));

    const tbody = document.getElementById('ag-admin-tbody');
    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="5"><div class="ag-empty"><i class="fa-solid fa-inbox"></i>Nenhuma atividade encontrada.</div></td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(t => {
        const opName  = AG_OPERATORS[t.operadorId] || t.operadorId;
        const prazo   = t.deadline ? new Date(t.deadline).toLocaleString('pt-BR') : '—';
        const canDone = t.status !== 'concluida';
        return `<tr>
            <td>
                <strong>${ag_esc(t.name)}</strong>
                ${t.desc ? `<br><small style="color:#64748b">${ag_esc(t.desc)}</small>` : ''}
            </td>
            <td>${ag_esc(opName)}</td>
            <td><small>${prazo}</small></td>
            <td><span class="ag-badge ag-badge-${t.status}">${t.status}</span></td>
            <td>
                <div style="display:flex;gap:5px;flex-wrap:wrap">
                    ${canDone ? `<button class="ag-icon-btn ok" onclick="ag_openConclude('${t.id}')" title="Concluir"><i class="fa-solid fa-check"></i></button>` : ''}
                    <button class="ag-icon-btn edit" onclick="ag_openTaskModal('${t.id}')" title="Editar"><i class="fa-solid fa-pen"></i></button>
                    <button class="ag-icon-btn del" onclick="ag_deleteTask('${t.id}')" title="Excluir"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

/* ================================================================
   ADMIN — RANKING
   ================================================================ */
function ag_renderRanking() {
    const results = Object.entries(AG_OPERATORS).map(([id, name]) => {
        const mine  = AG_TASKS.filter(t => t.operadorId === id);
        const done  = mine.filter(t => t.status === 'concluida').length;
        const total = mine.length;
        const sla   = total > 0 ? Math.round(done / total * 100) : 100;
        return { name, total, done, sla, late: mine.filter(t => t.status === 'atrasada').length };
    }).sort((a,b) => b.sla - a.sla);

    const el = document.getElementById('ag-ranking-body');
    el.innerHTML = `<h3 style="margin:0 0 1.5rem">Ranking por SLA do Mês</h3>` +
        results.map((r, i) => {
            const color = r.sla >= 90 ? '#16a34a' : r.sla >= 70 ? '#f59e0b' : '#dc2626';
            return `<div class="ag-rank-item">
                <span class="ag-rank-pos ${i===0?'gold':(i===1?'silver':i===2?'bronze':'')}">${i+1}°</span>
                <div class="ag-rank-bar-wrap" style="flex:1">
                    <div style="display:flex;justify-content:space-between">
                        <strong>${r.name}</strong>
                        <span style="color:${color};font-weight:700">${r.sla}%</span>
                    </div>
                    <small style="color:#64748b">${r.done}/${r.total} concluídas · ${r.late} atraso(s)</small>
                    <div class="ag-rank-bar-bg">
                        <div class="ag-rank-bar" style="width:${r.sla}%;background:${color}"></div>
                    </div>
                </div>
            </div>`;
        }).join('');
}

/* ================================================================
   ADMIN — HISTORY
   ================================================================ */
function ag_renderHistory() {
    const hist = AG_TASKS.filter(t => t.status === 'concluida')
        .sort((a,b) => new Date(b.concluidaEm||0) - new Date(a.concluidaEm||0));

    const tbody = document.getElementById('ag-history-tbody');
    if (!hist.length) {
        tbody.innerHTML = `<tr><td colspan="5"><div class="ag-empty"><i class="fa-solid fa-clock-rotate-left"></i>Nenhum histórico ainda.</div></td></tr>`;
        return;
    }
    tbody.innerHTML = hist.map(t => `<tr>
        <td><strong>${ag_esc(t.name)}</strong></td>
        <td>${ag_esc(AG_OPERATORS[t.operadorId] || t.operadorId)}</td>
        <td><small>${t.concluidaEm ? new Date(t.concluidaEm).toLocaleString('pt-BR') : '—'}</small></td>
        <td>${ag_esc(t.concluidaPor || '—')}</td>
        <td><small>${ag_esc(t.concluidaObs || '—')}</small></td>
    </tr>`).join('');
}

/* ================================================================
   OPERADOR — KPIs
   ================================================================ */
function ag_renderOpKPIs() {
    const mine  = AG_TASKS.filter(t => t.operadorId === AG_USER.id);
    const done  = mine.filter(t => t.status === 'concluida').length;
    const total = mine.length;
    const sla   = total > 0 ? Math.round(done / total * 100) : 100;
    const late  = mine.filter(t => t.status === 'atrasada').length;

    document.getElementById('ag-kpi-op').innerHTML = `
        <div class="ag-kpi-card"><h4>Minhas Tarefas</h4><div class="ag-kpi-val">${total}</div></div>
        <div class="ag-kpi-card" style="border-left-color:#16a34a"><h4>Concluídas</h4><div class="ag-kpi-val">${done}</div></div>
        <div class="ag-kpi-card" style="border-left-color:#dc2626"><h4>Em Atraso</h4><div class="ag-kpi-val">${late}</div></div>
        <div class="ag-kpi-card" style="border-left-color:#7c3aed"><h4>Meu SLA</h4>
            <div class="ag-kpi-val" style="color:${sla>=90?'#16a34a':sla>=70?'#f59e0b':'#dc2626'}">${sla}%</div>
        </div>
    `;
}

/* ================================================================
   OPERADOR — TASKS
   ================================================================ */
function ag_renderOpTasks() {
    const mine = AG_TASKS.filter(t => t.operadorId === AG_USER.id);
    const el   = document.getElementById('ag-op-tasks');

    if (!mine.length) {
        el.innerHTML = `<div class="ag-empty"><i class="fa-solid fa-inbox"></i>Nenhuma atividade atribuída a você.</div>`;
        return;
    }

    const ord = { atrasada:0, pendente:1, concluida:2 };
    mine.sort((a,b) => (ord[a.status]??1) - (ord[b.status]??1));

    el.innerHTML = mine.map(t => {
        const borderColor = t.status === 'atrasada' ? '#dc2626' : t.status === 'concluida' ? '#16a34a' : '#3b82f6';
        const prazo = t.deadline ? new Date(t.deadline).toLocaleString('pt-BR') : '—';
        return `<div class="ag-op-card ${t.status}" style="border-left-color:${borderColor}">
            <div class="ag-op-card-header">
                <div>
                    <p class="ag-op-card-title">${ag_esc(t.name)}</p>
                    <p class="ag-op-card-meta">
                        <i class="fa-regular fa-clock"></i> Prazo: <strong>${prazo}</strong>
                        &nbsp;·&nbsp; ${t.freq || ''}
                    </p>
                    ${t.desc ? `<p style="margin:.5rem 0 0;font-size:.85rem;color:#475569">${ag_esc(t.desc)}</p>` : ''}
                </div>
                <div style="text-align:right;flex-shrink:0;margin-left:1rem">
                    <span class="ag-badge ag-badge-${t.status}" style="margin-bottom:.6rem;display:inline-block">${t.status}</span><br>
                    ${t.status === 'pendente' ?
                        `<button class="ag-btn ag-btn-success" style="font-size:.82rem;padding:.5rem 1rem" onclick="ag_openConclude('${t.id}')">
                            <i class="fa-solid fa-check"></i> Concluir
                        </button>` : ''}
                    ${t.status === 'atrasada' ?
                        `<small style="color:#dc2626;font-weight:700"><i class="fa-solid fa-lock"></i> Apenas o Admin pode concluir</small>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');
}

/* ================================================================
   TAB SWITCHER
   ================================================================ */
function ag_switchTab(tabId, btn) {
    document.querySelectorAll('.ag-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.ag-tab-pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('ag-tab-' + tabId).classList.add('active');
}

/* ================================================================
   TASK MODAL
   ================================================================ */
function ag_openTaskModal(id) {
    const modal = document.getElementById('ag-modal-task');
    const title = document.getElementById('ag-modal-task-title');

    if (id) {
        const t = AG_TASKS.find(x => x.id === id);
        if (!t) return;
        title.innerHTML = '<i class="fa-solid fa-pen"></i> Editar Atividade';
        document.getElementById('ag-task-id').value       = id;
        document.getElementById('ag-task-name').value     = t.name || '';
        document.getElementById('ag-task-op').value       = t.operadorId || '';
        document.getElementById('ag-task-freq').value     = t.freq || 'diaria';
        document.getElementById('ag-task-deadline').value = t.deadline || '';
        document.getElementById('ag-task-priority').value = t.priority || 'media';
        document.getElementById('ag-task-desc').value     = t.desc || '';
    } else {
        title.innerHTML = '<i class="fa-solid fa-plus"></i> Nova Atividade';
        document.getElementById('ag-task-id').value       = '';
        document.getElementById('ag-task-name').value     = '';
        document.getElementById('ag-task-op').value       = '';
        document.getElementById('ag-task-freq').value     = 'diaria';
        document.getElementById('ag-task-deadline').value = '';
        document.getElementById('ag-task-priority').value = 'media';
        document.getElementById('ag-task-desc').value     = '';
    }
    modal.style.display = 'flex';
    document.getElementById('ag-task-name').focus();
}

function ag_closeTaskModal() {
    document.getElementById('ag-modal-task').style.display = 'none';
}

async function ag_saveTask() {
    const id       = document.getElementById('ag-task-id').value;
    const name     = document.getElementById('ag-task-name').value.trim();
    const opId     = document.getElementById('ag-task-op').value;
    const freq     = document.getElementById('ag-task-freq').value;
    const deadline = document.getElementById('ag-task-deadline').value;
    const priority = document.getElementById('ag-task-priority').value;
    const desc     = document.getElementById('ag-task-desc').value.trim();

    if (!name)     { ag_toast('⚠️ Informe o título da atividade.'); return; }
    if (!opId)     { ag_toast('⚠️ Selecione um responsável.');      return; }
    if (!deadline) { ag_toast('⚠️ Informe o prazo.');               return; }

    const existing = id ? AG_TASKS.find(t => t.id === id) : null;
    const data = {
        name,
        operadorId: opId,
        freq,
        deadline,
        priority,
        desc,
        status:    existing ? existing.status : 'pendente',
        criadaEm:  existing ? existing.criadaEm : new Date().toISOString()
    };

    ag_closeTaskModal();
    ag_toast('Salvando...');

    await ag_persistTask(data, id || null);
    await ag_loadTasks();
    ag_toast(id ? '✅ Atividade atualizada!' : '✅ Atividade criada!');
}

/* ================================================================
   DELETE TASK
   ================================================================ */
async function ag_deleteTask(id) {
    if (!confirm('Deseja excluir esta atividade permanentemente?')) return;
    await ag_deleteFromDb(id);
    await ag_loadTasks();
    ag_toast('🗑️ Atividade excluída.');
}

/* ================================================================
   CONCLUSION MODAL
   ================================================================ */
function ag_openConclude(id) {
    const t = AG_TASKS.find(x => x.id === id);
    if (!t) return;
    document.getElementById('ag-conclude-id').value      = id;
    document.getElementById('ag-conclude-name').textContent = t.name;
    document.getElementById('ag-conclude-obs').value     = '';
    document.getElementById('ag-modal-conclude').style.display = 'flex';
    document.getElementById('ag-conclude-obs').focus();
}

function ag_closeConcludeModal() {
    document.getElementById('ag-modal-conclude').style.display = 'none';
}

async function ag_confirmConclusion() {
    const id  = document.getElementById('ag-conclude-id').value;
    const obs = document.getElementById('ag-conclude-obs').value.trim();

    if (!id) return;

    const existing = AG_TASKS.find(t => t.id === id);
    if (!existing) return;

    const data = {
        ...existing,
        status:       'concluida',
        concluidaEm:  new Date().toISOString(),
        concluidaPor: AG_USER.name,
        concluidaObs: obs
    };
    delete data.id;

    ag_closeConcludeModal();
    ag_toast('Salvando...');

    await ag_persistTask(data, id);
    await ag_loadTasks();
    ag_toast('✅ Atividade concluída com sucesso!');
}

/* ================================================================
   TOAST
   ================================================================ */
let _toastTimer = null;
function ag_toast(msg, duration = 3000) {
    const el = document.getElementById('ag-toast');
    el.textContent = msg;
    el.style.display = 'block';
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => el.style.display = 'none', duration);
}

/* ================================================================
   HELPERS
   ================================================================ */
function ag_esc(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;');
}

/* ================================================================
   DASHBOARD INTEGRATION (called from app.js)
   ================================================================ */
async function ag_loadSummaryForDashboard() {
    try {
        let tasks = [];
        if (typeof useFirebase !== 'undefined' && useFirebase && typeof db !== 'undefined' && db) {
            const snap = await db.collection('agenda_tarefas').get();
            tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } else {
            tasks = JSON.parse(localStorage.getItem('ag_tasks_offline') || '[]');
        }

        const total      = tasks.length;
        const concluidas = tasks.filter(t => t.status === 'concluida').length;
        const sla        = total > 0 ? Math.round(concluidas / total * 100) : 100;
        const slaColor   = sla >= 90 ? '#16a34a' : sla >= 70 ? '#f59e0b' : '#dc2626';

        // Update KPI card
        const slaEl = document.getElementById('kpi-agenda-sla');
        if (slaEl) {
            slaEl.textContent = sla + '%';
            slaEl.style.color = slaColor;
        }

        const summaryEl = document.getElementById('dashboard-agenda-summary');
        if (!summaryEl) return;

        if (!total) {
            summaryEl.innerHTML = '<p style="color:#64748b;text-align:center;padding:1rem">Nenhuma atividade cadastrada. <a href="agenda.html" style="color:#2563eb">Adicionar agora</a></p>';
            return;
        }

        // Group by operator
        const OPERATORS = {
            'iris':    'Iris Souza',
            'hallan':  'Hallan de Barros',
            'victor':  'Victor Dourado',
            'walmir':  'Walmir da Luz',
            'rodrigo': 'Rodrigo Vilanova',
            'nikolas': 'Nikolas Cardoso'
        };

        const byOp = {};
        tasks.forEach(t => {
            const key = t.operadorId || 'outro';
            if (!byOp[key]) byOp[key] = [];
            byOp[key].push(t);
        });

        const STATUS_COLOR = { pendente:'#f59e0b', atrasada:'#dc2626', concluida:'#16a34a' };
        const STATUS_BG    = { pendente:'#fffbeb', atrasada:'#fff1f2', concluida:'#f0fdf4' };
        const STATUS_LABEL = { pendente:'Pendente', atrasada:'Atrasada', concluida:'Concluída' };

        let html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem;margin-top:.5rem">';

        Object.entries(byOp).forEach(([opId, opTasks]) => {
            const opName = OPERATORS[opId] || opId;
            const opDone = opTasks.filter(t => t.status === 'concluida').length;
            const opSla  = opTasks.length > 0 ? Math.round(opDone / opTasks.length * 100) : 100;
            const opColor = opSla >= 90 ? '#16a34a' : opSla >= 70 ? '#f59e0b' : '#dc2626';

            // Sort: atrasada first
            const sorted = [...opTasks].sort((a,b) => {
                const o = { atrasada:0, pendente:1, concluida:2 };
                return (o[a.status]??1) - (o[b.status]??1);
            });

            html += `
            <div style="background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.08);overflow:hidden">
                <div style="background:#f8fafc;padding:.9rem 1rem;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center">
                    <div>
                        <strong style="font-size:.9rem">${opName}</strong><br>
                        <small style="color:#64748b">${opTasks.length} atividade(s)</small>
                    </div>
                    <span style="font-weight:700;font-size:.85rem;color:${opColor}">SLA ${opSla}%</span>
                </div>
                <div style="padding:.5rem 0">
                    ${sorted.map(t => {
                        const sc = STATUS_COLOR[t.status] || '#64748b';
                        const sb = STATUS_BG[t.status]   || '#f8fafc';
                        const sl = STATUS_LABEL[t.status] || t.status;
                        const prazo = t.deadline ? new Date(t.deadline).toLocaleString('pt-BR', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';
                        return `<div style="padding:.65rem 1rem;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #f1f5f9">
                            <div style="flex:1;min-width:0">
                                <div style="font-size:.85rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.name || ''}</div>
                                ${prazo ? `<div style="font-size:.75rem;color:#94a3b8">${prazo}</div>` : ''}
                            </div>
                            <span style="background:${sb};color:${sc};padding:.2rem .55rem;border-radius:20px;font-size:.72rem;font-weight:700;text-transform:uppercase;margin-left:.5rem;flex-shrink:0">${sl}</span>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        });

        html += '</div>';
        summaryEl.innerHTML = html;

    } catch (err) {
        console.warn('[AG] Dashboard summary failed:', err.message);
        const el = document.getElementById('dashboard-agenda-summary');
        if (el) el.innerHTML = '<p style="color:#dc2626">Erro ao carregar agenda. Verifique a conexão.</p>';
    }
}
