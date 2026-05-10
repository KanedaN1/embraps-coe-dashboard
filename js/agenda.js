// Agenda COE - Main Logic
let currentAgendaUser = null;
let agendaTasks = [];

document.addEventListener('DOMContentLoaded', async () => {
    // Check if already logged in
    const savedUser = sessionStorage.getItem('agenda_user');
    if (savedUser) {
        currentAgendaUser = JSON.parse(savedUser);
        initApp();
    }
});

function agendaSelectLoginType(type) {
    document.querySelectorAll('.agenda-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('tab-' + type).classList.add('active');
    
    if (type === 'admin') {
        document.getElementById('login-form-admin').style.display = 'block';
        document.getElementById('login-form-operador').style.display = 'none';
    } else {
        document.getElementById('login-form-admin').style.display = 'none';
        document.getElementById('login-form-operador').style.display = 'block';
    }
}

function agendaLoginAdmin() {
    const senha = document.getElementById('admin-senha').value;
    if (senha === 'admin') { // As per user request: "pode ser a mesma senha"
        currentAgendaUser = { type: 'admin', name: 'Administrador' };
        sessionStorage.setItem('agenda_user', JSON.stringify(currentAgendaUser));
        initApp();
    } else {
        showLoginError();
    }
}

function agendaLoginOperador() {
    const op = document.getElementById('operador-select').value;
    const senha = document.getElementById('operador-senha').value;
    
    // Simplistic password check for demo/initial phase
    // In a real app, these would be in a database
    const validPasswords = {
        'iris': 'iris123',
        'hallan': 'hallan123',
        'victor': 'victor123',
        'walmir': 'walmir123',
        'rodrigo': 'rodrigo123',
        'nikolas': 'nikolas123'
    };

    if (op && senha === validPasswords[op]) {
        const names = {
            'iris': 'Iris Souza',
            'hallan': 'Hallan de Barros',
            'victor': 'Victor Dourado',
            'walmir': 'Walmir da Luz',
            'rodrigo': 'Rodrigo Vilanova',
            'nikolas': 'Nikolas Cardoso'
        };
        currentAgendaUser = { type: 'operador', id: op, name: names[op] };
        sessionStorage.setItem('agenda_user', JSON.stringify(currentAgendaUser));
        initApp();
    } else {
        showLoginError();
    }
}

function showLoginError() {
    const err = document.getElementById('agenda-login-error');
    err.style.display = 'block';
    setTimeout(() => { err.style.display = 'none'; }, 3000);
}

function agendaLogout() {
    sessionStorage.removeItem('agenda_user');
    location.reload();
}

async function initApp() {
    document.getElementById('agenda-login-screen').style.display = 'none';
    document.getElementById('agenda-app').style.display = 'block';
    
    document.getElementById('agenda-user-badge').textContent = currentAgendaUser.name;
    document.getElementById('agenda-date-now').textContent = new Date().toLocaleDateString('pt-BR');
    
    if (currentAgendaUser.type === 'admin') {
        document.getElementById('painel-admin').style.display = 'block';
        document.getElementById('painel-operador').style.display = 'none';
        await loadAgendaTasks();
        renderTabelaAdmin();
        renderKPIsAdmin();
    } else {
        document.getElementById('painel-admin').style.display = 'none';
        document.getElementById('painel-operador').style.display = 'block';
        await loadAgendaTasks();
        renderPainelOperador();
    }

    // Auto-check for late tasks
    setInterval(checkLateTasks, 1000 * 60 * 5); // 5 minutes
    checkLateTasks();
}

async function loadAgendaTasks() {
    if (useFirebase && db) {
        try {
            const snapshot = await db.collection('agenda_tarefas').get();
            agendaTasks = [];
            snapshot.forEach(doc => {
                agendaTasks.push({ id: doc.id, ...doc.data() });
            });
        } catch (err) {
            console.error("Error loading tasks:", err);
            agendaTasks = JSON.parse(localStorage.getItem('agenda_tasks') || '[]');
        }
    } else {
        agendaTasks = JSON.parse(localStorage.getItem('agenda_tasks') || '[]');
    }
}

async function saveTaskToDb(task) {
    if (useFirebase && db) {
        if (task.id) {
            const id = task.id;
            const data = { ...task };
            delete data.id;
            await db.collection('agenda_tarefas').doc(id).set(data);
        } else {
            const docRef = await db.collection('agenda_tarefas').add(task);
            task.id = docRef.id;
        }
    }
    // Local fallback
    let localTasks = JSON.parse(localStorage.getItem('agenda_tasks') || '[]');
    const idx = localTasks.findIndex(t => t.id === task.id);
    if (idx >= 0) localTasks[idx] = task;
    else localTasks.push(task);
    localStorage.setItem('agenda_tasks', JSON.stringify(localTasks));
}

function renderKPIsAdmin() {
    const total = agendaTasks.length;
    const concluidas = agendaTasks.filter(t => t.status === 'concluida').length;
    const pendentes = agendaTasks.filter(t => t.status === 'pendente').length;
    const atrasadas = agendaTasks.filter(t => t.status === 'atrasada').length;
    const sla = total > 0 ? Math.round((concluidas / total) * 100) : 100;

    const html = `
        <div class="agenda-kpi-card">
            <h3>Total Tarefas</h3>
            <div class="value">${total}</div>
        </div>
        <div class="agenda-kpi-card" style="border-left-color: var(--agenda-success)">
            <h3>Concluídas</h3>
            <div class="value">${concluidas}</div>
        </div>
        <div class="agenda-kpi-card" style="border-left-color: var(--agenda-warning)">
            <h3>Pendentes</h3>
            <div class="value">${pendentes}</div>
        </div>
        <div class="agenda-kpi-card" style="border-left-color: var(--agenda-danger)">
            <h3>Em Atraso</h3>
            <div class="value">${atrasadas}</div>
        </div>
        <div class="agenda-kpi-card" style="border-left-color: var(--agenda-info)">
            <h3>SLA Geral</h3>
            <div class="value">${sla}%</div>
        </div>
    `;
    document.getElementById('agenda-kpis').innerHTML = html;
}

function renderTabelaAdmin() {
    const opFiltro = document.getElementById('filtro-operador').value;
    const statusFiltro = document.getElementById('filtro-status').value;
    
    let filtered = agendaTasks;
    if (opFiltro) filtered = filtered.filter(t => t.operadorId === opFiltro);
    if (statusFiltro) filtered = filtered.filter(t => t.status === statusFiltro);

    if (filtered.length === 0) {
        document.getElementById('admin-tabela-container').innerHTML = '<p class="agenda-empty">Nenhuma tarefa encontrada.</p>';
        return;
    }

    let html = `
        <table class="agenda-table">
            <thead>
                <tr>
                    <th>Atividade</th>
                    <th>Responsável</th>
                    <th>Prazo</th>
                    <th>Status</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>
    `;

    filtered.forEach(t => {
        html += `
            <tr>
                <td><strong>${t.nome}</strong><br><small>${t.frequencia}</small></td>
                <td>${t.operadorNome}</td>
                <td>${new Date(t.dataLimite).toLocaleString('pt-BR')}</td>
                <td><span class="badge badge-${t.status}">${t.status}</span></td>
                <td>
                    <button onclick="abrirEditarTarefa('${t.id}')"><i class="fa-solid fa-edit"></i></button>
                    <button onclick="excluirTarefa('${t.id}')"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    document.getElementById('admin-tabela-container').innerHTML = html;
}

function abrirModalNovaTarefa() {
    document.getElementById('modal-tarefa-title').innerHTML = '<i class="fa-solid fa-plus"></i> Nova Tarefa';
    document.getElementById('modal-tarefa-id').value = '';
    document.getElementById('modal-nome').value = '';
    document.getElementById('modal-descricao').value = '';
    document.getElementById('modal-operador').value = '';
    document.getElementById('modal-frequencia').value = 'diaria';
    document.getElementById('modal-prazo').value = '';
    document.getElementById('modal-prioridade').value = 'media';
    
    document.getElementById('modal-tarefa').style.display = 'flex';
}

function abrirEditarTarefa(id) {
    const t = agendaTasks.find(x => x.id === id);
    if (!t) return;

    document.getElementById('modal-tarefa-title').innerHTML = '<i class="fa-solid fa-edit"></i> Editar Tarefa';
    document.getElementById('modal-tarefa-id').value = t.id;
    document.getElementById('modal-nome').value = t.nome;
    document.getElementById('modal-descricao').value = t.descricao || '';
    document.getElementById('modal-operador').value = t.operadorId;
    document.getElementById('modal-frequencia').value = t.frequencia;
    document.getElementById('modal-prazo').value = t.dataLimite;
    document.getElementById('modal-prioridade').value = t.prioridade || 'media';
    
    document.getElementById('modal-tarefa').style.display = 'flex';
}

function fecharModalTarefa(e) {
    if (e && e.target !== e.currentTarget) return;
    document.getElementById('modal-tarefa').style.display = 'none';
}

function concluirTarefa(id) {
    const t = agendaTasks.find(x => x.id === id);
    if (!t) return;

    document.getElementById('conclusao-tarefa-id').value = id;
    document.getElementById('modal-conclusao-title').innerHTML = t.status === 'atrasada' ? '<i class="fa-solid fa-gavel"></i> Concluir em Atraso (Admin)' : '<i class="fa-solid fa-check-circle"></i> Concluir Atividade';
    document.getElementById('conclusao-obs').value = '';
    document.getElementById('modal-conclusao').style.display = 'flex';
}

function fecharModalConclusao(e) {
    if (e && e.target !== e.currentTarget) return;
    document.getElementById('modal-conclusao').style.display = 'none';
}

async function confirmarConclusao() {
    const id = document.getElementById('conclusao-tarefa-id').value;
    const obs = document.getElementById('conclusao-obs').value;
    const task = agendaTasks.find(t => t.id === id);
    
    if (task) {
        task.status = 'concluida';
        task.concluidaEm = new Date().toISOString();
        task.concluidaObs = obs;
        task.concluidaPor = currentAgendaUser.name;
        
        await saveTaskToDb(task);
        await loadAgendaTasks();
        fecharModalConclusao();
        
        if (currentAgendaUser.type === 'admin') {
            renderTabelaAdmin();
            renderKPIsAdmin();
        } else {
            renderPainelOperador();
        }
        showToast("Atividade concluída com sucesso!");
    }
}

async function salvarTarefa() {
    const id = document.getElementById('modal-tarefa-id').value;
    const nome = document.getElementById('modal-nome').value;
    const operadorId = document.getElementById('modal-operador').value;
    const descricao = document.getElementById('modal-descricao').value;
    const frequencia = document.getElementById('modal-frequencia').value;
    const dataLimite = document.getElementById('modal-prazo').value;
    const prioridade = document.getElementById('modal-prioridade').value;

    if (!nome || !operadorId || !dataLimite) {
        alert("Preencha todos os campos obrigatórios!");
        return;
    }

    const sel = document.getElementById('modal-operador');
    const operadorNome = sel.options[sel.selectedIndex].text;

    const task = {
        nome,
        operadorId,
        operadorNome,
        descricao,
        frequencia,
        dataLimite,
        prioridade,
        status: id ? agendaTasks.find(t => t.id === id).status : 'pendente',
        criadaEm: id ? agendaTasks.find(t => t.id === id).criadaEm : new Date().toISOString()
    };

    if (id) task.id = id;

    await saveTaskToDb(task);
    fecharModalTarefa();
    await loadAgendaTasks();
    if (currentAgendaUser.type === 'admin') {
        renderTabelaAdmin();
        renderKPIsAdmin();
    } else {
        renderPainelOperador();
    }
    showToast("Tarefa salva com sucesso!");
}

function showToast(msg) {
    const toast = document.getElementById('agenda-toast');
    toast.textContent = msg;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 3000);
}

function checkLateTasks() {
    const agora = new Date();
    let mudou = false;
    agendaTasks.forEach(t => {
        if (t.status === 'pendente' || t.status === 'em_andamento') {
            const prazo = new Date(t.dataLimite);
            if (agora > prazo) {
                t.status = 'atrasada';
                saveTaskToDb(t);
                mudou = true;
                // Here we would trigger email if integrated
                console.warn(`Tarefa atrasada: ${t.nome}`);
            }
        }
    });
    if (mudou && currentAgendaUser) {
        if (currentAgendaUser.type === 'admin') renderTabelaAdmin();
        else renderPainelOperador();
    }
}

// Additional functions for operator and ranking would go here
function renderPainelOperador() {
    const minhas = agendaTasks.filter(t => t.operadorId === currentAgendaUser.id);
    const concluidas = minhas.filter(t => t.status === 'concluida').length;
    const total = minhas.length;
    const sla = total > 0 ? Math.round((concluidas / total) * 100) : 100;
    const atrasadas = minhas.filter(t => t.status === 'atrasada').length;

    const kpiHtml = `
        <div class="agenda-kpi-card">
            <h3>Minhas Tarefas</h3>
            <div class="value">${total}</div>
        </div>
        <div class="agenda-kpi-card" style="border-left-color: var(--agenda-info)">
            <h3>Meu SLA</h3>
            <div class="value">${sla}%</div>
        </div>
        <div class="agenda-kpi-card" style="border-left-color: var(--agenda-danger)">
            <h3>Atrasos</h3>
            <div class="value">${atrasadas}</div>
        </div>
    `;
    document.getElementById('operador-kpis').innerHTML = kpiHtml;

    if (minhas.length === 0) {
        document.getElementById('operador-tarefas-container').innerHTML = '<p class="agenda-empty">Você não possui tarefas atribuídas.</p>';
        return;
    }

    let html = '<div class="agenda-op-list">';
    minhas.forEach(t => {
        html += `
            <div class="agenda-op-item card" style="margin-bottom: 1rem; padding: 1rem; border-left: 5px solid ${t.status === 'atrasada' ? 'var(--agenda-danger)' : 'var(--agenda-primary)'}">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h4 style="margin:0">${t.nome}</h4>
                        <small style="color: var(--agenda-text-muted)">Prazo: ${new Date(t.dataLimite).toLocaleString('pt-BR')}</small>
                    </div>
                    <div>
                        <span class="badge badge-${t.status}">${t.status}</span>
                    </div>
                </div>
                <p style="margin: 0.5rem 0; font-size: 0.9rem;">${t.descricao || 'Sem descrição.'}</p>
                ${t.status !== 'concluida' && t.status !== 'atrasada' ? `
                    <button class="agenda-btn-primary" style="padding: 0.5rem; width: auto; font-size: 0.8rem;" onclick="concluirTarefa('${t.id}')">
                        <i class="fa-solid fa-check"></i> Marcar como Concluída
                    </button>
                ` : ''}
                ${t.status === 'atrasada' ? `
                    <p style="color: var(--agenda-danger); font-size: 0.8rem; font-weight: bold;">
                        <i class="fa-solid fa-circle-exclamation"></i> Vencida. Somente o administrador pode concluir.
                    </p>
                ` : ''}
            </div>
        `;
    });
    html += '</div>';
    document.getElementById('operador-tarefas-container').innerHTML = html;
}

async function concluirTarefa(id) {
    const task = agendaTasks.find(t => t.id === id);
    if (task) {
        task.status = 'concluida';
        task.concluidaEm = new Date().toISOString();
        await saveTaskToDb(task);
        await loadAgendaTasks();
        renderPainelOperador();
        showToast("Tarefa concluída!");
    }
}

function showAdminTab(tab) {
    document.querySelectorAll('.agenda-admin-tab').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(content => content.classList.remove('active-tab'));
    
    const targetTab = document.getElementById('admin-tab-' + tab);
    const targetBtn = document.querySelector(`[onclick="showAdminTab('${tab}')"]`);
    
    if (targetTab) targetTab.classList.add('active-tab');
    if (targetBtn) targetBtn.classList.add('active');

    if (tab === 'ranking') renderRankingAdmin();
    if (tab === 'historico') renderHistoricoAdmin();
}

function renderRankingAdmin() {
    const ops = [
        { id: 'iris', name: 'Iris Souza' },
        { id: 'hallan', name: 'Hallan de Barros' },
        { id: 'victor', name: 'Victor Dourado' },
        { id: 'walmir', name: 'Walmir da Luz' },
        { id: 'rodrigo', name: 'Rodrigo Vilanova' },
        { id: 'nikolas', name: 'Nikolas Cardoso' }
    ];

    let results = ops.map(op => {
        const suas = agendaTasks.filter(t => t.operadorId === op.id);
        const concluidas = suas.filter(t => t.status === 'concluida').length;
        const total = suas.length;
        const sla = total > 0 ? Math.round((concluidas / total) * 100) : 0;
        const atrasos = suas.filter(t => t.status === 'atrasada').length;
        return { ...op, total, concluidas, sla, atrasos };
    });

    results.sort((a, b) => b.sla - a.sla || a.atrasos - b.atrasos);

    let html = `
        <div class="card" style="padding: 2rem;">
            <h2><i class="fa-solid fa-ranking-star"></i> Ranking de Operadores (SLA)</h2>
            <div class="agenda-ranking-list">
    `;

    results.forEach((r, idx) => {
        html += `
            <div style="display: flex; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid var(--agenda-border);">
                <div style="font-size: 1.5rem; font-weight: 800; width: 40px; color: ${idx === 0 ? '#fbbf24' : '#94a3b8'}">${idx + 1}°</div>
                <div style="flex: 1">
                    <strong>${r.name}</strong><br>
                    <small>${r.atrasos} atrasos / ${r.total} tarefas</small>
                </div>
                <div style="width: 200px; margin: 0 20px;">
                    <div style="background: #e2e8f0; height: 10px; border-radius: 5px; overflow: hidden;">
                        <div style="background: ${r.sla > 90 ? 'var(--agenda-success)' : (r.sla > 70 ? 'var(--agenda-warning)' : 'var(--agenda-danger)')}; width: ${r.sla}%; height: 100%;"></div>
                    </div>
                </div>
                <div style="font-weight: 800; font-size: 1.2rem;">${r.sla}%</div>
            </div>
        `;
    });

    html += '</div></div>';
    document.getElementById('ranking-container').innerHTML = html;
}

function renderHistoricoAdmin() {
    // Sort tasks by conclusion date
    const sorted = [...agendaTasks].filter(t => t.concluidaEm).sort((a, b) => new Date(b.concluidaEm) - new Date(a.concluidaEm));

    if (sorted.length === 0) {
        document.getElementById('historico-container').innerHTML = '<p class="agenda-empty">Nenhuma atividade concluída ainda.</p>';
        return;
    }

    let html = '<div class="card" style="padding: 1rem;"><table class="agenda-table"><thead><tr><th>Atividade</th><th>Operador</th><th>Conclusão</th><th>Observação</th></tr></thead><tbody>';
    
    sorted.forEach(t => {
        html += `
            <tr>
                <td>${t.nome}</td>
                <td>${t.operadorNome}</td>
                <td>${new Date(t.concluidaEm).toLocaleString('pt-BR')}</td>
                <td><small>${t.concluidaObs || '-'}</small></td>
            </tr>
        `;
    });

    html += '</tbody></table></div>';
    document.getElementById('historico-container').innerHTML = html;
}

async function excluirTarefa(id) {
    if (!confirm("Deseja realmente excluir esta tarefa?")) return;
    
    if (useFirebase && db) {
        await db.collection('agenda_tarefas').doc(id).delete();
    }
    
    let localTasks = JSON.parse(localStorage.getItem('agenda_tasks') || '[]');
    localTasks = localTasks.filter(t => t.id !== id);
    localStorage.setItem('agenda_tasks', JSON.stringify(localTasks));
    
    await loadAgendaTasks();
    renderTabelaAdmin();
    renderKPIsAdmin();
    showToast("Tarefa excluída.");
}

function agendaExportPDF() {
    window.print();
}
