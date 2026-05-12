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

    // Display today's date or filter
    const curMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
    if (document.getElementById('ag-filter-year')) document.getElementById('ag-filter-year').value = "2026";
    if (document.getElementById('ag-filter-month')) document.getElementById('ag-filter-month').value = curMonth;
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
    const month = document.getElementById('ag-filter-month')?.value || (new Date().getMonth() + 1).toString().padStart(2, '0');
    const year = document.getElementById('ag-filter-year')?.value || new Date().getFullYear().toString();

    try {
        if (typeof useFirebase !== 'undefined' && useFirebase && typeof db !== 'undefined' && db) {
            const snap = await db.collection('agenda_tarefas').where('month', '==', month).where('year', '==', year).get();
            AG_TASKS = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            // Sync to local (scoped to month/year for safety)
            localStorage.setItem(AG_LS_KEY, JSON.stringify(AG_TASKS));
        } else {
            AG_TASKS = JSON.parse(localStorage.getItem(AG_LS_KEY) || '[]').filter(t => t.month === month && t.year === year);
        }
    } catch (err) {
        console.warn('[AG] Firestore read failed, using local data:', err.message);
        AG_TASKS = JSON.parse(localStorage.getItem(AG_LS_KEY) || '[]');
    }
    ag_checkLate();
    ag_refreshUI();
}

async function ag_persistTask(task, id) {
    // 1. Always save to local first (Instant feedback & reliability)
    const idx = AG_TASKS.findIndex(t => t.id === id);
    if (idx >= 0) AG_TASKS[idx] = task;
    else AG_TASKS.push(task);
    localStorage.setItem(AG_LS_KEY, JSON.stringify(AG_TASKS));

    // 2. Try to sync to cloud
    if (typeof useFirebase !== 'undefined' && useFirebase && typeof db !== 'undefined' && db) {
        try {
            await db.collection('agenda_tarefas').doc(id).set(task);
            console.log('[AG] Sincronizado com o servidor ✅');
        } catch (err) {
            console.error('[AG] Falha na sincronização cloud:', err.message);
            ag_toast("Erro ao salvar na nuvem. Verifique as regras do Firebase.");
        }
    }
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
        ag_renderGroupedView();
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
    const opF = document.getElementById('ag-filter-op')?.value;
    const stF = document.getElementById('ag-filter-status')?.value;
    const month = document.getElementById('ag-filter-month')?.value || (new Date().getMonth() + 1).toString().padStart(2, '0');
    const year = document.getElementById('ag-filter-year')?.value || new Date().getFullYear().toString();

    let list = [...AG_TASKS].filter(t => t.month === month && t.year === year);
    if (opF) list = list.filter(t => t.operadorId === opF);
    if (stF) list = list.filter(t => t.status === stF);

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
    const month = document.getElementById('ag-filter-month')?.value || (new Date().getMonth() + 1).toString().padStart(2, '0');
    const year = document.getElementById('ag-filter-year')?.value || new Date().getFullYear().toString();

    const mine = AG_TASKS.filter(t => t.operadorId === AG_USER.id && t.month === month && t.year === year);
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
    const d = new Date(deadline);
    const curMonth = (d.getMonth() + 1).toString().padStart(2, '0');
    const curYear = d.getFullYear().toString();

    const baseData = {
        name,
        operadorId: opId,
        freq,
        priority,
        desc,
        status:    existing ? existing.status : 'pendente',
        criadaEm:  existing ? existing.criadaEm : new Date().toISOString()
    };

    ag_closeTaskModal();
    ag_toast('Salvando...');

    // Se for edição, apenas salva
    if (id) {
        const payload = { ...baseData, deadline, month: existing.month || curMonth, year: existing.year || curYear, id };
        await ag_persistTask(payload, id);
    } 
    // Se for nova tarefa, verifica recorrência
    else {
        if (freq === 'semanal') {
            // Cria para todas as semanas restantes do mês
            const startDay = d.getDate();
            const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
            
            for (let day = startDay; day <= lastDay; day += 7) {
                const newD = new Date(d);
                newD.setDate(day);
                const finalId = (typeof db !== 'undefined' && db) ? db.collection('agenda_tarefas').doc().id : 'local_' + Date.now() + day;
                const payload = { 
                    ...baseData, 
                    id: finalId,
                    deadline: newD.toISOString().slice(0, 16),
                    month: (newD.getMonth() + 1).toString().padStart(2, '0'),
                    year: newD.getFullYear().toString()
                };
                await ag_persistTask(payload, finalId);
            }
        } else if (freq === 'mensal') {
            // Cria para todos os meses restantes do ano
            const startMonth = d.getMonth();
            for (let m = startMonth; m < 12; m++) {
                const newD = new Date(d);
                newD.setMonth(m);
                const finalId = (typeof db !== 'undefined' && db) ? db.collection('agenda_tarefas').doc().id : 'local_' + Date.now() + m;
                const payload = { 
                    ...baseData, 
                    id: finalId,
                    deadline: newD.toISOString().slice(0, 16),
                    month: (newD.getMonth() + 1).toString().padStart(2, '0'),
                    year: newD.getFullYear().toString()
                };
                await ag_persistTask(payload, finalId);
            }
        } else {
            // Normal (uma vez ou diária - diária tratamos como apenas uma entrada que o operador faz todo dia?)
            // O usuário pediu "um dia da semana" ou "um dia do mês pelo ano todo".
            const finalId = (typeof db !== 'undefined' && db) ? db.collection('agenda_tarefas').doc().id : 'local_' + Date.now();
            const payload = { ...baseData, id: finalId, deadline, month: curMonth, year: curYear };
            await ag_persistTask(payload, finalId);
        }
    }

    await ag_loadTasks();
    ag_toast(id ? '✅ Atividade atualizada!' : '✅ Atividades geradas!');
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
    let tasks = [];
    let loadError = null;

    const month = document.getElementById('filter-month')?.value || (new Date().getMonth() + 1).toString().padStart(2, '0');
    const year = document.getElementById('filter-year')?.value || new Date().getFullYear().toString();

    try {
        if (typeof useFirebase !== 'undefined' && useFirebase && typeof db !== 'undefined' && db) {
            const snap = await db.collection('agenda_tarefas').where('month', '==', month).where('year', '==', year).get();
            tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            localStorage.setItem('ag_tasks_offline', JSON.stringify(tasks));
        } else {
            tasks = JSON.parse(localStorage.getItem('ag_tasks_offline') || '[]').filter(t => t.month === month && t.year === year);
        }
    } catch (err) {
        console.warn('[AG] Dashboard sync failed:', err.message);
        loadError = err.message;
        tasks = JSON.parse(localStorage.getItem('ag_tasks_offline') || '[]');
    }

    // --- RENDERIZAÇÃO MESMO COM ERRO (usando cache local) ---
    ag_renderDashboardSummary(tasks);
    if (document.getElementById('ag-exec-kpis')) {
        ag_renderExecutiveDashboard(tasks);
    }

    // Se houve erro de conexão, mostrar um aviso discreto mas continuar exibindo os dados locais
    if (loadError) {
        const containers = ['dashboard-agenda-summary', 'ag-exec-ranking', 'ag-exec-operator-sla', 'ag-exec-grouped-list'];
        containers.forEach(id => {
            const el = document.getElementById(id);
            if (el && tasks.length === 0) {
                el.innerHTML = `<p style="color:#dc2626; font-size:0.85rem;">⚠️ Erro de Conexão: ${loadError}. Verifique as permissões do Firebase.</p>`;
            }
        });
        // Tenta recarregar em 15 segundos
        setTimeout(ag_loadSummaryForDashboard, 15000);
    }
}

function ag_renderDashboardSummary(tasks) {
    const total      = tasks.length;
    const concluidas = tasks.filter(t => t.status === 'concluida').length;
    const sla        = total > 0 ? Math.round(concluidas / total * 100) : 100;
    const slaColor   = sla >= 90 ? '#16a34a' : sla >= 70 ? '#f59e0b' : '#dc2626';

    const slaEl = document.getElementById('kpi-agenda-sla');
    if (slaEl) {
        slaEl.textContent = sla + '%';
        slaEl.style.color = slaColor;
    }

    const summaryEl = document.getElementById('dashboard-agenda-summary');
    if (!summaryEl) return;
    if (!total) {
        summaryEl.innerHTML = '<p style="color:#64748b;text-align:center;padding:1rem">Nenhuma atividade cadastrada.</p>';
        return;
    }

    const OPERATORS = {
        'iris': 'Iris Souza', 'hallan': 'Hallan de Barros', 'victor': 'Victor Dourado',
        'walmir': 'Walmir da Luz', 'rodrigo': 'Rodrigo Vilanova', 'nikolas': 'Nikolas Cardoso'
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

        const sorted = [...opTasks].sort((a,b) => {
            const o = { atrasada:0, pendente:1, concluida:2 };
            return (o[a.status]??1) - (o[b.status]??1);
        });

        html += `
        <div style="background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.08);overflow:hidden;border:1px solid #e2e8f0">
            <div style="background:#f8fafc;padding:.7rem 1rem;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center">
                <strong style="font-size:.85rem">${opName}</strong>
                <span style="font-weight:700;font-size:.8rem;color:${opColor}">${opSla}%</span>
            </div>
            <div style="padding:.3rem 0">
                ${sorted.slice(0, 3).map(t => {
                    const sc = STATUS_COLOR[t.status] || '#64748b';
                    const sb = STATUS_BG[t.status]   || '#f8fafc';
                    const sl = STATUS_LABEL[t.status] || t.status;
                    return `<div style="padding:.5rem 1rem;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #f1f5f9">
                        <div style="font-size:.8rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px">${t.name}</div>
                        <span style="background:${sb};color:${sc};padding:.1rem .4rem;border-radius:4px;font-size:.65rem;font-weight:700;text-transform:uppercase">${sl}</span>
                    </div>`;
                }).join('')}
                ${opTasks.length > 3 ? `<div style="padding:.4rem;text-align:center;font-size:.7rem;color:#94a3b8">+ ${opTasks.length - 3} outras atividades</div>` : ''}
            </div>
        </div>`;
    });
    html += '</div>';
    summaryEl.innerHTML = html;
}

function ag_renderExecutiveDashboard(tasks) {
    const total      = tasks.length;
    const concluidas = tasks.filter(t => t.status === 'concluida').length;
    const atrasadas  = tasks.filter(t => t.status === 'atrasada').length;
    const pendentes  = tasks.filter(t => t.status === 'pendente').length;
    const sla        = total > 0 ? Math.round(concluidas / total * 100) : 100;
    const slaColor   = sla >= 90 ? '#16a34a' : sla >= 70 ? '#f59e0b' : '#dc2626';

    // 1. KPIs
    const kpiEl = document.getElementById('ag-exec-kpis');
    kpiEl.innerHTML = `
        <div class="card kpi-card">
            <div class="kpi-icon bg-blue"><i class="fa-solid fa-tasks"></i></div>
            <div class="kpi-info"><h3>Total Atividades</h3><h2>${total}</h2></div>
        </div>
        <div class="card kpi-card">
            <div class="kpi-icon bg-green"><i class="fa-solid fa-check-circle"></i></div>
            <div class="kpi-info"><h3>Concluídas</h3><h2>${concluidas}</h2></div>
        </div>
        <div class="card kpi-card">
            <div class="kpi-icon bg-purple"><i class="fa-solid fa-exclamation-circle"></i></div>
            <div class="kpi-info"><h3>Em Atraso</h3><h2>${atrasadas}</h2></div>
        </div>
        <div class="card kpi-card">
            <div class="kpi-icon" style="background:#f59e0b;"><i class="fa-solid fa-chart-line"></i></div>
            <div class="kpi-info"><h3>SLA Operacional</h3><h2 style="color:${slaColor}">${sla}%</h2></div>
        </div>
    `;

    // 2. Ranking & SLA List
    const OPERATORS = {
        'iris': 'Iris Souza', 'hallan': 'Hallan de Barros', 'victor': 'Victor Dourado',
        'walmir': 'Walmir da Luz', 'rodrigo': 'Rodrigo Vilanova', 'nikolas': 'Nikolas Cardoso'
    };

    const results = Object.entries(OPERATORS).map(([id, name]) => {
        const mine = tasks.filter(t => t.operadorId === id);
        const done = mine.filter(t => t.status === 'concluida').length;
        const sla  = mine.length > 0 ? Math.round(done / mine.length * 100) : 100;
        return { id, name, done, total: mine.length, sla };
    });

    // Ranking (Most deliveries)
    const ranking = [...results].sort((a,b) => b.done - a.done);
    document.getElementById('ag-exec-ranking').innerHTML = ranking.map((r, i) => `
        <div style="display:flex;align-items:center;padding:12px 0;border-bottom:1px solid #f1f5f9">
            <div style="width:30px;font-weight:800;color:${i===0?'#f59e0b':(i===1?'#94a3b8':(i===2?'#b45309':'#cbd5e1'))}">${i+1}°</div>
            <div style="flex:1">
                <strong style="font-size:.9rem">${r.name}</strong><br>
                <small style="color:#64748b">${r.done} conclusões de ${r.total} atribuídas</small>
            </div>
            <div style="text-align:right">
                <div style="font-weight:700;color:#16a34a">${r.done}</div>
                <small style="font-size:.65rem;text-transform:uppercase;color:#94a3b8">Entregues</small>
            </div>
        </div>
    `).join('');

    // SLA Efficiency
    const efficiency = [...results].sort((a,b) => b.sla - a.sla);
    document.getElementById('ag-exec-operator-sla').innerHTML = efficiency.map(r => {
        const color = r.sla >= 90 ? '#16a34a' : r.sla >= 70 ? '#f59e0b' : '#dc2626';
        return `
        <div style="margin-bottom:15px">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                <span style="font-size:.85rem;font-weight:600">${r.name}</span>
                <span style="font-size:.85rem;font-weight:700;color:${color}">${r.sla}%</span>
            </div>
            <div style="height:8px;background:#f1f5f9;border-radius:4px;overflow:hidden">
                <div style="height:100%;background:${color};width:${r.sla}%"></div>
            </div>
        </div>`;
    }).join('');

    // 3. Detailed Grouped List (Executive Style)
    const byOp = {};
    tasks.forEach(t => {
        const key = t.operadorId || 'outro';
        if (!byOp[key]) byOp[key] = [];
        byOp[key].push(t);
    });

    const STATUS_COLOR = { pendente:'#f59e0b', atrasada:'#dc2626', concluida:'#16a34a' };
    const STATUS_LABEL = { pendente:'Pendente', atrasada:'Atrasada', concluida:'Concluída' };

    let html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1.5rem">';
    Object.entries(byOp).forEach(([opId, opTasks]) => {
        const opName = AG_OPERATORS[opId] || opId;
        const sorted = [...opTasks].sort((a,b) => {
            const o = { atrasada:0, pendente:1, concluida:2 };
            return (o[a.status]??1) - (o[b.status]??1);
        });

        html += `
        <div style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden">
            <div style="background:#f8fafc;padding:1rem;border-bottom:1px solid #e2e8f0">
                <strong style="color:#1e3a8a">${opName}</strong>
            </div>
            <div>
                ${sorted.map(t => {
                    const sc = STATUS_COLOR[t.status] || '#64748b';
                    const sl = STATUS_LABEL[t.status] || t.status;
                    const prazo = t.deadline ? new Date(t.deadline).toLocaleDateString('pt-BR', {day:'2-digit',month:'2-digit'}) : '';
                    return `
                    <div style="padding:.8rem 1rem;border-bottom:1px solid #f8fafc;display:flex;justify-content:space-between;align-items:center">
                        <div style="min-width:0;flex:1">
                            <div style="font-size:.85rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.name}</div>
                            <div style="font-size:.75rem;color:#94a3b8">${prazo} · ${t.freq || ''}</div>
                        </div>
                        <span style="color:${sc};font-weight:700;font-size:.7rem;text-transform:uppercase;margin-left:10px">${sl}</span>
                    </div>`;
                }).join('')}
            </div>
        </div>`;
    });
    html += '</div>';
    const groupedEl = document.getElementById('ag-exec-grouped-list');
    if (groupedEl) groupedEl.innerHTML = html;
}

/* ================================================================
   ADMIN — GROUPED VIEW
   ================================================================ */
function ag_renderGroupedView() {
    const el = document.getElementById('ag-grouped-view-body');
    if (!el) return;

    if (!AG_TASKS.length) {
        el.innerHTML = '<div class="ag-empty" style="grid-column: 1/-1">Nenhuma atividade cadastrada na Agenda.</div>';
        return;
    }

    const byOp = {};
    AG_TASKS.forEach(t => {
        const key = t.operadorId || 'outro';
        if (!byOp[key]) byOp[key] = [];
        byOp[key].push(t);
    });

    const STATUS_COLOR = { pendente:'#f59e0b', atrasada:'#dc2626', concluida:'#16a34a' };
    const STATUS_BG    = { pendente:'#fffbeb', atrasada:'#fff1f2', concluida:'#f0fdf4' };
    const STATUS_LABEL = { pendente:'Pendente', atrasada:'Atrasada', concluida:'Concluída' };

    el.innerHTML = Object.entries(byOp).map(([opId, opTasks]) => {
        const opName = AG_OPERATORS[opId] || opId;
        const opDone = opTasks.filter(t => t.status === 'concluida').length;
        const opSla  = opTasks.length > 0 ? Math.round(opDone / opTasks.length * 100) : 100;
        const opColor = opSla >= 90 ? '#16a34a' : opSla >= 70 ? '#f59e0b' : '#dc2626';

        const sorted = [...opTasks].sort((a,b) => {
            const o = { atrasada:0, pendente:1, concluida:2 };
            return (o[a.status]??1) - (o[b.status]??1);
        });

        return `
        <div class="ag-table-wrap" style="display:flex; flex-direction:column; min-height:100%; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
            <div style="background:#f8fafc; padding:1.2rem; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center">
                <div>
                    <h4 style="margin:0; font-size:1rem; color:#1e3a8a; font-weight:700;">${opName}</h4>
                    <small style="color:#64748b">${opTasks.length} tarefas atribuídas</small>
                </div>
                <div style="text-align:right">
                    <div style="font-weight:800; font-size:1.2rem; color:${opColor}; line-height:1;">${opSla}%</div>
                    <small style="text-transform:uppercase; font-weight:700; font-size:0.65rem; color:#94a3b8">SLA</small>
                </div>
            </div>
            <div style="flex:1; padding: 0.5rem 0;">
                ${sorted.map(t => {
                    const sc = STATUS_COLOR[t.status] || '#64748b';
                    const sb = STATUS_BG[t.status]   || '#f8fafc';
                    const sl = STATUS_LABEL[t.status] || t.status;
                    const prazo = t.deadline ? new Date(t.deadline).toLocaleString('pt-BR', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';
                    return `
                    <div style="padding:0.8rem 1.2rem; border-bottom:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center">
                        <div style="min-width:0; flex:1">
                            <div style="font-weight:600; font-size:0.88rem; margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color: #334155;">${ag_esc(t.name)}</div>
                            <div style="font-size:0.75rem; color:#64748b"><i class="fa-regular fa-clock" style="margin-right:3px;"></i>${prazo}</div>
                        </div>
                        <div style="margin-left:12px; text-align:right; flex-shrink:0;">
                            <span class="ag-badge" style="background:${sb}; color:${sc}; border:1px solid ${sc}22; font-size:0.6rem; padding: 2px 8px;">${sl}</span>
                            <div style="margin-top:6px; display:flex; gap:5px; justify-content:flex-end">
                                <button class="ag-icon-btn edit" style="padding:2px 6px; font-size:0.7rem; height:24px; width:24px;" onclick="ag_openTaskModal('${t.id}')"><i class="fa-solid fa-pen"></i></button>
                                <button class="ag-icon-btn del" style="padding:2px 6px; font-size:0.7rem; height:24px; width:24px;" onclick="ag_deleteTask('${t.id}')"><i class="fa-solid fa-trash"></i></button>
                            </div>
                        </div>
                    </div>`;
                }).join('')}
            </div>
        </div>`;
    }).join('');
}

/**
 * DASHBOARD INTEGRATION
 * Loads a summary of tasks to be displayed in the main index.html
 */
async function ag_loadSummaryForDashboard() {
    const month = document.getElementById('filter-month')?.value || (new Date().getMonth() + 1).toString().padStart(2, '0');
    const year = document.getElementById('filter-year')?.value || new Date().getFullYear().toString();

    let tasks = [];
    try {
        if (typeof useFirebase !== 'undefined' && useFirebase && typeof db !== 'undefined' && db) {
            const snap = await db.collection('agenda_tarefas').where('month', '==', month).where('year', '==', year).get();
            tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } else {
            tasks = JSON.parse(localStorage.getItem(AG_LS_KEY) || '[]').filter(t => t.month === month && t.year === year);
        }
    } catch(e) {
        tasks = JSON.parse(localStorage.getItem(AG_LS_KEY) || '[]').filter(t => t.month === month && t.year === year);
    }

    ag_renderDashboardMiniList(tasks);
    ag_renderExecKPIs(tasks);
    ag_renderExecRanking(tasks);
    ag_renderExecOperatorSLA(tasks);
    ag_renderExecGroupedList(tasks);
}

function ag_renderDashboardMiniList(tasks) {
    const el = document.getElementById('dashboard-agenda-summary');
    if (!el) return;

    if (!tasks.length) {
        el.innerHTML = '<p style="color:#94a3b8; font-size:0.9rem">Nenhuma atividade pendente para este mês.</p>';
        return;
    }

    const pending = tasks.filter(t => t.status !== 'concluida').slice(0, 5);
    el.innerHTML = pending.map(t => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #f1f5f9">
            <span style="font-size:0.85rem; font-weight:600; color:#334155">${t.name}</span>
            <span style="font-size:0.75rem; color:#64748b">${AG_OPERATORS[t.operadorId] || t.operadorId}</span>
        </div>
    `).join('') || '<p style="color:#16a34a; font-size:0.9rem"><i class="fa-solid fa-circle-check"></i> Todas as atividades do mês concluídas!</p>';
}

function ag_renderExecKPIs(tasks) {
    const el = document.getElementById('ag-exec-kpis');
    if (!el) return;

    const total = tasks.length;
    const done = tasks.filter(t => t.status === 'concluida').length;
    const late = tasks.filter(t => t.status === 'atrasada').length;
    const sla = total > 0 ? Math.round(done / total * 100) : 100;

    el.innerHTML = `
        <div class="card kpi-card">
            <div class="kpi-icon bg-blue"><i class="fa-solid fa-tasks"></i></div>
            <div class="kpi-info"><h3>Total Atividades</h3><h2>${total}</h2></div>
        </div>
        <div class="card kpi-card">
            <div class="kpi-icon bg-purple"><i class="fa-solid fa-history"></i></div>
            <div class="kpi-info"><h3>Em Atraso</h3><h2 style="color:#ef4444">${late}</h2></div>
        </div>
        <div class="card kpi-card">
            <div class="kpi-icon bg-green"><i class="fa-solid fa-tachometer-alt"></i></div>
            <div class="kpi-info"><h3>SLA Operacional</h3><h2>${sla}%</h2></div>
        </div>
    `;
}

function ag_renderExecRanking(tasks) {
    const el = document.getElementById('ag-exec-ranking');
    if (!el) return;

    const stats = {};
    Object.keys(AG_OPERATORS).forEach(id => stats[id] = { done:0, total:0 });
    tasks.forEach(t => {
        if (stats[t.operadorId]) {
            stats[t.operadorId].total++;
            if (t.status === 'concluida') stats[t.operadorId].done++;
        }
    });

    const sorted = Object.entries(stats)
        .map(([id, s]) => ({ id, name: AG_OPERATORS[id], ...s }))
        .sort((a,b) => (b.done / (b.total||1)) - (a.done / (a.total||1)) || b.done - a.done);

    el.innerHTML = sorted.map((op, i) => {
        const sla = op.total > 0 ? Math.round(op.done / op.total * 100) : 100;
        const color = sla >= 90 ? '#16a34a' : sla >= 70 ? '#f59e0b' : '#dc2626';
        return `
            <div style="margin-bottom:1rem; display:flex; align-items:center; gap:12px;">
                <span style="font-weight:800; color:#94a3b8; width:20px;">${i+1}°</span>
                <div style="flex:1">
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                        <span style="font-size:0.85rem; font-weight:600">${op.name}</span>
                        <span style="font-size:0.85rem; font-weight:700; color:${color}">${sla}%</span>
                    </div>
                    <div style="height:4px; background:#f1f5f9; border-radius:2px; overflow:hidden">
                        <div style="width:${sla}%; height:100%; background:${color}"></div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function ag_renderExecOperatorSLA(tasks) {
    const el = document.getElementById('ag-exec-operator-sla');
    if (!el) return;
    
    // Simple summary of counts
    const statusCounts = { pendente: 0, atrasada: 0, concluida: 0 };
    tasks.forEach(t => { if (statusCounts[t.status] !== undefined) statusCounts[t.status]++; });

    el.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:1rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:#f8fafc; border-radius:8px;">
                <span style="font-size:0.9rem; font-weight:600; color:#64748b">Atividades Concluídas</span>
                <span style="font-size:1.1rem; font-weight:800; color:#16a34a">${statusCounts.concluida}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:#f8fafc; border-radius:8px;">
                <span style="font-size:0.9rem; font-weight:600; color:#64748b">Pendentes</span>
                <span style="font-size:1.1rem; font-weight:800; color:#f59e0b">${statusCounts.pendente}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:#fef2f2; border-radius:8px;">
                <span style="font-size:0.9rem; font-weight:600; color:#b91c1c">Em Atraso</span>
                <span style="font-size:1.1rem; font-weight:800; color:#dc2626">${statusCounts.atrasada}</span>
            </div>
        </div>
    `;
}

function ag_renderExecGroupedList(tasks) {
    const el = document.getElementById('ag-exec-grouped-list');
    if (!el) return;

    const byOp = {};
    tasks.forEach(t => {
        const key = t.operadorId || 'outro';
        if (!byOp[key]) byOp[key] = [];
        byOp[key].push(t);
    });

    const STATUS_COLOR = { pendente:'#f59e0b', atrasada:'#dc2626', concluida:'#16a34a' };
    const STATUS_LABEL = { pendente:'Pendente', atrasada:'Atrasada', concluida:'Concluída' };

    let html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1.5rem">';
    Object.entries(byOp).forEach(([opId, opTasks]) => {
        const opName = AG_OPERATORS[opId] || opId;
        const sorted = [...opTasks].sort((a,b) => {
            const o = { atrasada:0, pendente:1, concluida:2 };
            return (o[a.status]??1) - (o[b.status]??1);
        });

        html += `
        <div style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden">
            <div style="background:#f8fafc;padding:1rem;border-bottom:1px solid #e2e8f0">
                <strong style="color:#1e3a8a">${opName}</strong>
            </div>
            <div>
                ${sorted.map(t => {
                    const sc = STATUS_COLOR[t.status] || '#64748b';
                    const sl = STATUS_LABEL[t.status] || t.status;
                    const prazo = t.deadline ? new Date(t.deadline).toLocaleDateString('pt-BR', {day:'2-digit',month:'2-digit'}) : '';
                    return `
                    <div style="padding:.8rem 1rem;border-bottom:1px solid #f8fafc;display:flex;justify-content:space-between;align-items:center">
                        <div style="min-width:0;flex:1">
                            <div style="font-size:.85rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.name}</div>
                            <div style="font-size:.75rem;color:#94a3b8">${prazo} · ${t.freq || ''}</div>
                        </div>
                        <span style="color:${sc};font-weight:700;font-size:.7rem;text-transform:uppercase;margin-left:10px">${sl}</span>
                    </div>`;
                }).join('')}
            </div>
        </div>`;
    });
    html += '</div>';
    el.innerHTML = html;
}
