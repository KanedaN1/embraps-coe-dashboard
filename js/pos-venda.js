/* Pós Venda Negativo - Business Logic */

let PV_DATA = [];
let PV_USER = null; // null = visitante, 'Admin' ou nome do coordenador
const PV_LS_KEY = 'embraps_pv_offline';

// PINS compartilhados com o módulo de Vagas
const PV_PINS = {
    'admin':             '9999',
    'Carlos Leme':       '1111',
    'Isaias Belchior':   '2222',
    'Rejiane Teles':     '3333',
    'Renato Augusto':    '4444',
    'Ricardo Faustino':  '5555'
};

const COORDENADORES = {
    'carlos':   'Carlos Leme',
    'isaias':   'Isaias Belchior',
    'rejiane':  'Rejiane Teles',
    'renato':   'Renato Augusto',
    'ricardo':  'Ricardo Faustino'
};

// =============================================
// INICIALIZAÇÃO
// =============================================
document.addEventListener('DOMContentLoaded', () => {
    // Checar sessão ativa
    const adminSession = sessionStorage.getItem('pv_admin_logged') === 'true';
    const coordSession = sessionStorage.getItem('pv_coord_logged');

    if (adminSession) {
        PV_USER = 'Admin';
        pv_liberarAcesso('Admin');
    } else if (coordSession) {
        PV_USER = coordSession;
        pv_liberarAcesso(coordSession);
    } else {
        // Modo público: mostra tudo, bloqueia apenas ações
        PV_USER = null;
        pv_atualizarHeaderVisitante();
    }

    pv_loadData();
});

// =============================================
// CONTROLE DE ACESSO
// =============================================
function pv_atualizarHeaderVisitante() {
    const btnLogin = document.getElementById('btn-fazer-login-pv');
    const btnLogout = document.getElementById('btn-logout-pv');
    if (btnLogin) btnLogin.style.display = 'inline-block';
    if (btnLogout) btnLogout.style.display = 'none';
}

function pv_liberarAcesso(nome) {
    PV_USER = nome;
    const btnLogin = document.getElementById('btn-fazer-login-pv');
    const btnLogout = document.getElementById('btn-logout-pv');
    if (btnLogin) btnLogin.style.display = 'none';
    if (btnLogout) {
        btnLogout.style.display = 'inline-block';
        btnLogout.innerHTML = `<i class="fa-solid fa-sign-out-alt"></i> Sair (${nome})`;
    }
    pv_renderUI();
}

function pv_forcarLogin() {
    const overlay = document.getElementById('pv-login-overlay');
    if (overlay) overlay.style.display = 'flex';
    const pinInput = document.getElementById('pv-login-pin');
    if (pinInput) pinInput.value = '';
}

function pv_fecharLogin() {
    const overlay = document.getElementById('pv-login-overlay');
    if (overlay) overlay.style.display = 'none';
}

function pv_autenticar() {
    const userEl = document.getElementById('pv-login-user');
    const pinEl  = document.getElementById('pv-login-pin');
    if (!userEl || !pinEl) return;

    const user = userEl.value;
    const pin  = pinEl.value;

    const pinCorreto = PV_PINS[user];

    if (!pin) {
        alert('Digite o PIN de acesso.');
        return;
    }

    if (pinCorreto && pin === pinCorreto) {
        pv_fecharLogin();

        if (user === 'admin') {
            sessionStorage.setItem('pv_admin_logged', 'true');
            pv_liberarAcesso('Admin');
        } else {
            sessionStorage.setItem('pv_coord_logged', user);
            pv_liberarAcesso(user);
        }
    } else {
        alert('PIN incorreto! Tente novamente.');
        pinEl.value = '';
        pinEl.focus();
    }
}

function pv_logout() {
    sessionStorage.removeItem('pv_admin_logged');
    sessionStorage.removeItem('pv_coord_logged');
    PV_USER = null;
    pv_atualizarHeaderVisitante();
    pv_renderUI();
}

// Intercepta ações restritas - se não logado, exibe login primeiro
function pv_handleAcaoRestrita(acao, id = null) {
    if (!PV_USER) {
        // Salva a ação pendente para executar após o login
        sessionStorage.setItem('pv_acao_pendente', JSON.stringify({ acao, id }));
        pv_forcarLogin();
        return;
    }
    pv_executarAcao(acao, id);
}

function pv_executarAcao(acao, id) {
    if (acao === 'novo') {
        pv_openModal();
    } else if (acao === 'concluir') {
        pv_concluir(id);
    } else if (acao === 'excluir') {
        pv_delete(id);
    }
}

// =============================================
// CARREGAR DADOS
// =============================================
async function pv_loadData() {
    const filterCoord = document.getElementById('pv-filter-coord')?.value;

    try {
        if (typeof useFirebase !== 'undefined' && useFirebase && typeof db !== 'undefined' && db) {
            let query = db.collection('pos_venda_negativo');
            if (filterCoord) query = query.where('coordenadorId', '==', filterCoord);
            const snap = await query.get();
            PV_DATA = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            localStorage.setItem(PV_LS_KEY, JSON.stringify(PV_DATA));
        } else {
            PV_DATA = JSON.parse(localStorage.getItem(PV_LS_KEY) || '[]');
            if (filterCoord) PV_DATA = PV_DATA.filter(d => d.coordenadorId === filterCoord);
        }
    } catch (err) {
        console.warn('[PV] Firestore fail, usando local:', err.message);
        PV_DATA = JSON.parse(localStorage.getItem(PV_LS_KEY) || '[]');
        if (filterCoord) PV_DATA = PV_DATA.filter(d => d.coordenadorId === filterCoord);
    }

    // Executa ação pendente após login
    const pendente = sessionStorage.getItem('pv_acao_pendente');
    if (pendente && PV_USER) {
        sessionStorage.removeItem('pv_acao_pendente');
        const { acao, id } = JSON.parse(pendente);
        setTimeout(() => pv_executarAcao(acao, id), 300);
    }

    pv_renderUI();
}

// =============================================
// RENDERIZAR INTERFACE
// =============================================
function pv_renderUI() {
    pv_renderKPIs();
    pv_renderTable();
    pv_renderRanking();
}

function pv_renderKPIs() {
    const total      = PV_DATA.length;
    const concluidos = PV_DATA.filter(d => d.status === 'concluida' || d.status === 'concluido').length;
    const pendentes  = total - concluidos;
    const sla        = total > 0 ? Math.round((concluidos / total) * 100) : 100;

    const kpiEl = document.getElementById('pv-kpis');
    if (!kpiEl) return;

    kpiEl.innerHTML = `
        <div class="card kpi-card">
            <div class="kpi-icon bg-blue"><i class="fa-solid fa-folder-open"></i></div>
            <div class="kpi-info"><h3>Total Casos</h3><h2>${total}</h2></div>
        </div>
        <div class="card kpi-card">
            <div class="kpi-icon bg-green"><i class="fa-solid fa-check-double"></i></div>
            <div class="kpi-info"><h3>Concluídos</h3><h2>${concluidos}</h2></div>
        </div>
        <div class="card kpi-card">
            <div class="kpi-icon bg-purple"><i class="fa-solid fa-history"></i></div>
            <div class="kpi-info"><h3>Pendentes</h3><h2>${pendentes}</h2></div>
        </div>
        <div class="card kpi-card">
            <div class="kpi-icon" style="background:#f59e0b;"><i class="fa-solid fa-star"></i></div>
            <div class="kpi-info"><h3>SLA Médio</h3><h2>${sla}%</h2></div>
        </div>
    `;
}

function pv_renderTable() {
    const tbody = document.getElementById('pv-table-body');
    if (!tbody) return;

    const statusFilter = document.getElementById('pv-filter-status')?.value || '';
    
    let filteredData = PV_DATA;
    if (statusFilter) {
        filteredData = PV_DATA.filter(d => {
            if (statusFilter === 'concluido') return d.status === 'concluido' || d.status === 'concluida';
            if (statusFilter === 'pendente') return d.status === 'pendente';
            return true;
        });
    }

    if (filteredData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:2rem; color:#94a3b8;">Nenhum registro encontrado.</td></tr>';
        return;
    }

    const sorted = [...filteredData].sort((a, b) => {
        if (a.status !== b.status) return a.status === 'pendente' ? -1 : 1;
        return new Date(a.proximoRetorno) - new Date(b.proximoRetorno);
    });

    tbody.innerHTML = sorted.map(d => {
        const isDone     = d.status === 'concluido' || d.status === 'concluida';
        const statusLabel = isDone ? 'Concluído' : 'Pendente';
        const badgeClass  = isDone ? 'pv-badge-concluido' : 'pv-badge-pendente';
        const coordName   = COORDENADORES[d.coordenadorId] || d.coordenadorId || 'N/A';
        const dateLimit   = new Date(d.proximoRetorno);
        const isLate      = dateLimit < new Date() && !isDone;
        const isAdmin     = PV_USER === 'Admin';
        const podeAgir    = PV_USER !== null; // qualquer logado pode concluir

        // Campo de observação: editável se logado, somente leitura se visitante
        const obsTexto = d.observacao || '';
        let obsHtml;
        if (PV_USER) {
            obsHtml = `<input 
                type="text" 
                value="${obsTexto.replace(/"/g, '&quot;')}" 
                placeholder="Adicionar observação..." 
                onblur="pv_salvarObservacao('${d.id}', this.value)"
                onkeydown="if(event.key==='Enter'){this.blur();}"
                style="
                    width: 100%;
                    min-width: 160px;
                    padding: 5px 8px;
                    border: 1px solid #e2e8f0;
                    border-radius: 6px;
                    font-size: 0.78rem;
                    color: #1e293b;
                    background: #f8fafc;
                    outline: none;
                    transition: border-color 0.2s;
                "
                onfocus="this.style.borderColor='#1e3a8a'"
                onblur="this.style.borderColor='#e2e8f0'; pv_salvarObservacao('${d.id}', this.value);"
            >`;
        } else {
            obsHtml = obsTexto
                ? `<span style="font-size:0.8rem; color:#475569; font-style:italic;">${obsTexto}</span>`
                : `<span style="font-size:0.75rem; color:#cbd5e1;">—</span>`;
        }

        // Botões de ação
        let acoes = '';
        if (!isDone && podeAgir) {
            acoes += `<button onclick="pv_handleAcaoRestrita('concluir','${d.id}')" title="Concluir" style="padding:5px 10px; background:#16a34a; border:none; border-radius:6px; color:white; cursor:pointer; font-size:0.7rem; font-weight:600;"><i class="fa-solid fa-check"></i> Concluir</button>`;
        }
        if (!isDone && !podeAgir) {
            // visitante vê botão bloqueado
            acoes += `<button onclick="pv_handleAcaoRestrita('concluir','${d.id}')" title="Requer login" style="padding:5px 10px; background:#e2e8f0; border:none; border-radius:6px; color:#94a3b8; cursor:pointer; font-size:0.7rem;"><i class="fa-solid fa-lock"></i> Concluir</button>`;
        }
        if (isAdmin) {
            acoes += `<button onclick="pv_handleAcaoRestrita('excluir','${d.id}')" title="Excluir" style="padding:5px 10px; background:#f1f5f9; border:none; border-radius:6px; color:#64748b; cursor:pointer; font-size:0.7rem; margin-left:4px;"><i class="fa-solid fa-trash"></i></button>`;
        } else if (podeAgir === false) {
            // Para visitante, excluir não aparece
        }

        return `
            <tr style="border-bottom: 1px solid #f1f5f9; ${isLate ? 'background: #fff5f5;' : ''}">
                <td style="padding: 12px; font-weight:700; color:#1e3a8a;">${d.cliente}</td>
                <td style="padding: 12px;">
                    <div style="font-size:0.85rem; font-weight:600">${coordName}</div>
                    <div style="font-size:0.75rem; color:#94a3b8">${d.supervisor || ''}</div>
                </td>
                <td style="padding: 12px;">
                    <div style="font-size:0.75rem; color:#94a3b8">Início: ${d.dataInicial ? d.dataInicial.split('-').reverse().join('/') : '—'}</div>
                    <div style="font-size:0.85rem; font-weight:700; color:${isLate ? '#e11d48' : '#1e293b'}">Retorno: ${d.proximoRetorno ? d.proximoRetorno.split('-').reverse().join('/') : '—'}</div>
                </td>
                <td style="padding: 12px;"><span class="pv-badge ${badgeClass}" style="padding:4px 8px; border-radius:4px; font-size:0.7rem; font-weight:700; text-transform:uppercase;">${statusLabel}</span></td>
                <td style="padding: 12px; min-width: 180px;">${obsHtml}</td>
                <td style="padding: 12px;">
                    <div style="display:flex; gap:5px; flex-wrap:wrap;">
                        ${acoes || '<span style="font-size:0.75rem;color:#94a3b8;">—</span>'}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function pv_renderRanking() {
    const rankingEl = document.getElementById('pv-ranking');
    if (!rankingEl) return;

    const stats = {};
    Object.keys(COORDENADORES).forEach(id => stats[id] = { done: 0, total: 0, name: COORDENADORES[id] });

    PV_DATA.forEach(d => {
        const cid = d.coordenadorId;
        if (stats[cid]) {
            stats[cid].total++;
            if (d.status === 'concluido' || d.status === 'concluida') stats[cid].done++;
        }
    });

    const ranking = Object.values(stats).sort((a, b) => {
        const slaA = a.total > 0 ? (a.done / a.total) : 0;
        const slaB = b.total > 0 ? (b.done / b.total) : 0;
        return slaB - slaA || b.done - a.done;
    });

    rankingEl.innerHTML = ranking.map((r, i) => {
        const sla   = r.total > 0 ? Math.round((r.done / r.total) * 100) : 0;
        const color = sla >= 80 ? '#16a34a' : sla >= 50 ? '#f59e0b' : '#e11d48';

        return `
            <div style="margin-bottom: 1.2rem; padding-bottom: 1rem; border-bottom: 1px solid #f8fafc;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-weight:800; color:#94a3b8; font-size:0.8rem;">${i+1}°</span>
                        <strong style="font-size:0.85rem;">${r.name}</strong>
                    </div>
                    <span style="font-weight:800; color:${color}; font-size:0.9rem;">${sla}%</span>
                </div>
                <div style="height:6px; background:#f1f5f9; border-radius:3px; overflow:hidden; margin-bottom:4px;">
                    <div style="width:${sla}%; height:100%; background:${color};"></div>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:#94a3b8;">
                    <span>${r.done} concluídos</span>
                    <span>Total: ${r.total}</span>
                </div>
            </div>
        `;
    }).join('');
}

// =============================================
// MODAL DE CADASTRO
// =============================================
function pv_openModal(id = null) {
    document.getElementById('pv-modal').style.display = 'flex';
    const select = document.getElementById('pv-coordenador');
    select.innerHTML = '<option value="">Selecione...</option>' +
        Object.entries(COORDENADORES).map(([val, name]) => `<option value="${val}">${name}</option>`).join('');

    // Se coordenador logado, pré-seleciona ele mesmo
    if (PV_USER && PV_USER !== 'Admin') {
        const coordKey = Object.keys(COORDENADORES).find(k => COORDENADORES[k] === PV_USER);
        if (coordKey) select.value = coordKey;
    }

    // Limpar campos
    document.getElementById('pv-id').value = '';
    document.getElementById('pv-cliente').value = '';
    document.getElementById('pv-supervisor').value = '';
    document.getElementById('pv-data-inicial').value = '';
    document.getElementById('pv-proximo-retorno').value = '';
    document.getElementById('pv-modal-title').innerText = 'Novo Pós Venda';
}

function pv_closeModal() {
    document.getElementById('pv-modal').style.display = 'none';
}

async function pv_save() {
    const cliente  = document.getElementById('pv-cliente').value.trim();
    const coordId  = document.getElementById('pv-coordenador').value;
    const superv   = document.getElementById('pv-supervisor').value.trim();
    const dataIni  = document.getElementById('pv-data-inicial').value;
    const proxRet  = document.getElementById('pv-proximo-retorno').value;

    if (!cliente || !coordId || !dataIni || !proxRet) {
        alert('Preencha todos os campos obrigatórios.');
        return;
    }

    const id = 'pv_' + Date.now();
    const payload = {
        cliente,
        coordenadorId: coordId,
        supervisor: superv,
        dataInicial: dataIni,
        proximoRetorno: proxRet,
        status: 'pendente',
        observacao: '',
        criadoEm: new Date().toISOString(),
        criadoPor: PV_USER || 'Desconhecido'
    };

    try {
        if (typeof useFirebase !== 'undefined' && useFirebase && typeof db !== 'undefined' && db) {
            await db.collection('pos_venda_negativo').doc(id).set(payload);
        }
    } catch (e) {
        console.error('[PV] Erro ao salvar:', e);
    }

    pv_closeModal();
    pv_loadData();
}

// =============================================
// AÇÕES: CONCLUIR / EXCLUIR / OBSERVAÇÃO
// =============================================
async function pv_concluir(id) {
    const item = PV_DATA.find(x => x.id === id);
    if (!item) return;

    item.status = 'concluido';
    item.concluidoEm = new Date().toISOString();
    item.concluidoPor = PV_USER || 'Desconhecido';

    try {
        if (typeof useFirebase !== 'undefined' && useFirebase && typeof db !== 'undefined' && db) {
            await db.collection('pos_venda_negativo').doc(id).update({
                status: 'concluido',
                concluidoEm: item.concluidoEm,
                concluidoPor: item.concluidoPor
            });
        }
    } catch (e) {
        console.error('[PV] Erro ao concluir:', e);
    }

    pv_loadData();
}

async function pv_delete(id) {
    if (PV_USER !== 'Admin') {
        alert('Apenas administradores podem excluir registros.');
        return;
    }
    if (!confirm('Excluir este registro definitivamente?')) return;

    try {
        if (typeof useFirebase !== 'undefined' && useFirebase && typeof db !== 'undefined' && db) {
            await db.collection('pos_venda_negativo').doc(id).delete();
        }
        PV_DATA = PV_DATA.filter(x => x.id !== id);
        pv_renderUI();
    } catch (e) {
        console.error('[PV] Erro ao excluir:', e);
    }
}

async function pv_salvarObservacao(id, texto) {
    const item = PV_DATA.find(x => x.id === id);
    if (!item || item.observacao === texto) return; // sem mudança

    item.observacao = texto;

    try {
        if (typeof useFirebase !== 'undefined' && useFirebase && typeof db !== 'undefined' && db) {
            await db.collection('pos_venda_negativo').doc(id).update({ observacao: texto });
        }
    } catch (e) {
        console.error('[PV] Erro ao salvar observação:', e);
    }
}

// =============================================
// IMPRESSÃO
// =============================================
function pv_print() {
    const printWindow = window.open('', '_blank');
    const statusFilter = document.getElementById('pv-filter-status')?.value || '';
    let filteredData = PV_DATA;
    if (statusFilter) {
        filteredData = PV_DATA.filter(d => {
            if (statusFilter === 'concluido') return d.status === 'concluido' || d.status === 'concluida';
            if (statusFilter === 'pendente') return d.status === 'pendente';
            return true;
        });
    }

    const rows = filteredData.map(d => `
        <tr>
            <td>${d.cliente}</td>
            <td>${COORDENADORES[d.coordenadorId] || d.coordenadorId}</td>
            <td>${d.supervisor || ''}</td>
            <td>${d.dataInicial ? d.dataInicial.split('-').reverse().join('/') : '—'}</td>
            <td>${d.proximoRetorno ? d.proximoRetorno.split('-').reverse().join('/') : '—'}</td>
            <td>${d.status === 'concluido' ? 'Concluído' : 'Pendente'}</td>
            <td>${d.observacao || '—'}</td>
        </tr>
    `).join('');

    printWindow.document.write(`
        <html>
        <head>
            <title>Relatório Pós Venda Negativo</title>
            <style>
                body { font-family: sans-serif; padding: 20px; color: #333; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 12px; }
                th { background: #f4f4f4; }
                h1 { color: #1e3a8a; font-size: 18px; }
                .footer { margin-top: 30px; font-size: 10px; color: #999; text-align: center; }
            </style>
        </head>
        <body>
            <h1>Relatório Pós Venda Negativo - ${new Date().toLocaleDateString('pt-BR')}</h1>
            <table>
                <thead>
                    <tr>
                        <th>Cliente</th>
                        <th>Coordenador</th>
                        <th>Supervisor</th>
                        <th>Data Inicial</th>
                        <th>Próximo Retorno</th>
                        <th>Status</th>
                        <th>Observação</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            <div class="footer">Gerado via Embraps COE Dashboard em ${new Date().toLocaleString('pt-BR')}</div>
            <script>window.print();<\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
}
