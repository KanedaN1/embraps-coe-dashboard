/* Pós Venda Negativo - Business Logic */

let PV_DATA = [];
let PV_USER = { type: null }; // 'admin' ou 'coordenador'
const PV_LS_KEY = 'embraps_pv_offline';

const COORDENADORES = {
    'ricardo': 'Ricardo Faustino',
    'renato': 'Renato Augusto',
    'isaias': 'Isaias Belchior',
    'carlos': 'Carlos Leme',
    'rejiane': 'Rejiane Teles'
};

document.addEventListener('DOMContentLoaded', () => {
    // Verificar se é admin via localStorage ou URL
    const isAdmin = localStorage.getItem('embraps_admin') === 'true' || window.location.search.includes('admin=true');
    if (isAdmin) {
        PV_USER.type = 'admin';
        const btn = document.getElementById('pv-btn-novo');
        if (btn) btn.style.display = 'block';
    }
    
    pv_loadData();
});

function pv_login(type) {
    PV_USER.type = type;
    sessionStorage.setItem('pv_user_type', type);
    
    document.getElementById('pv-login-section').style.display = 'none';
    document.getElementById('pv-app-content').style.display = 'block';
    
    if (type === 'admin') {
        document.getElementById('pv-admin-actions').style.display = 'block';
    }
    
    pv_loadData();
}
async function pv_loadData() {
    const filterCoord = document.getElementById('pv-filter-coord')?.value;

    try {
        if (typeof useFirebase !== 'undefined' && useFirebase && typeof db !== 'undefined' && db) {
            let query = db.collection('pos_venda_negativo');
            if (filterCoord) {
                query = query.where('coordenadorId', '==', filterCoord);
            }
            const snap = await query.get();
            PV_DATA = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            localStorage.setItem(PV_LS_KEY, JSON.stringify(PV_DATA));
        } else {
            PV_DATA = JSON.parse(localStorage.getItem(PV_LS_KEY) || '[]');
            if (filterCoord) {
                PV_DATA = PV_DATA.filter(d => d.coordenadorId === filterCoord);
            }
        }
    } catch (err) {
        console.warn('[PV] Firestore fail, using local:', err.message);
        PV_DATA = JSON.parse(localStorage.getItem(PV_LS_KEY) || '[]');
        if (filterCoord) {
            PV_DATA = PV_DATA.filter(d => d.coordenadorId === filterCoord);
        }
    }
    pv_renderUI();
}

function pv_renderUI() {
    pv_renderKPIs();
    pv_renderTable();
    pv_renderRanking();
}

function pv_renderKPIs() {
    const total = PV_DATA.length;
    const concluidos = PV_DATA.filter(d => d.status === 'concluida' || d.status === 'concluido').length;
    const pendentes = total - concluidos;
    const sla = total > 0 ? Math.round((concluidos / total) * 100) : 100;

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
    
    if (PV_DATA.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:2rem; color:#94a3b8;">Nenhum registro encontrado.</td></tr>';
        return;
    }

    const sorted = [...PV_DATA].sort((a,b) => {
        if (a.status !== b.status) return a.status === 'pendente' ? -1 : 1;
        return new Date(a.proximoRetorno) - new Date(b.proximoRetorno);
    });

    tbody.innerHTML = sorted.map(d => {
        const isDone = d.status === 'concluido' || d.status === 'concluida';
        const statusLabel = isDone ? 'Concluído' : 'Pendente';
        const badgeClass = isDone ? 'pv-badge-concluido' : 'pv-badge-pendente';
        const coordName = COORDENADORES[d.coordenadorId] || d.coordenadorId || 'N/A';
        const dateLimit = new Date(d.proximoRetorno);
        const isLate = dateLimit < new Date() && !isDone;
        
        const isAdmin = localStorage.getItem('embraps_admin') === 'true' || window.location.search.includes('admin=true');

        return `
            <tr style="border-bottom: 1px solid #f1f5f9;">
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
                <td style="padding: 12px;">
                    <div style="display:flex; gap:5px;">
                        ${!isDone ? `<button onclick="pv_concluir('${d.id}')" style="padding:5px 10px; background:#16a34a; border:none; border-radius:6px; color:white; cursor:pointer; font-size:0.7rem; font-weight:600;"><i class="fa-solid fa-check"></i> Concluir</button>` : ''}
                        ${isAdmin ? `<button onclick="pv_delete('${d.id}')" style="padding:5px 10px; background:#f1f5f9; border:none; border-radius:6px; color:#64748b; cursor:pointer; font-size:0.7rem;"><i class="fa-solid fa-trash"></i></button>` : ''}
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

    const ranking = Object.values(stats).sort((a,b) => {
        const slaA = a.total > 0 ? (a.done / a.total) : 0;
        const slaB = b.total > 0 ? (b.done / b.total) : 0;
        return slaB - slaA || b.done - a.done;
    });

    rankingEl.innerHTML = ranking.map((r, i) => {
        const sla = r.total > 0 ? Math.round((r.done / r.total) * 100) : 0;
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

function pv_openModal(id = null) {
    document.getElementById('pv-modal').style.display = 'flex';
    // Popular coordenadores
    const select = document.getElementById('pv-coordenador');
    select.innerHTML = '<option value="">Selecione...</option>' + 
        Object.entries(COORDENADORES).map(([val, name]) => `<option value="${val}">${name}</option>`).join('');
}

function pv_closeModal() {
    document.getElementById('pv-modal').style.display = 'none';
}

async function pv_save() {
    const cliente = document.getElementById('pv-cliente').value.trim();
    const coordId = document.getElementById('pv-coordenador').value;
    const superv  = document.getElementById('pv-supervisor').value.trim();
    const dataIni = document.getElementById('pv-data-inicial').value;
    const proxRet = document.getElementById('pv-proximo-retorno').value;

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
        criadoEm: new Date().toISOString()
    };

    try {
        if (typeof useFirebase !== 'undefined' && useFirebase && typeof db !== 'undefined' && db) {
            await db.collection('pos_venda_negativo').doc(id).set(payload);
        }
    } catch(e) {}

    pv_closeModal();
    pv_loadData();
}

async function pv_concluir(id) {
    const item = PV_DATA.find(x => x.id === id);
    if (!item) return;
    
    item.status = 'concluido';
    item.concluidoEm = new Date().toISOString();

    try {
        if (typeof useFirebase !== 'undefined' && useFirebase && typeof db !== 'undefined' && db) {
            await db.collection('pos_venda_negativo').doc(id).update({ status: 'concluido', concluidoEm: item.concluidoEm });
        }
    } catch(e) {}
    
    pv_loadData();
}

async function pv_delete(id) {
    const isAdmin = localStorage.getItem('embraps_admin') === 'true' || window.location.search.includes('admin=true');
    if (!isAdmin) {
        alert('Apenas administradores podem excluir registros.');
        return;
    }
    if (!confirm('Excluir este registro?')) return;
    try {
        if (typeof useFirebase !== 'undefined' && useFirebase && typeof db !== 'undefined' && db) {
            await db.collection('pos_venda_negativo').doc(id).delete();
        }
    } catch(e) {}
    pv_loadData();
}

function pv_print() {
    const printWindow = window.open('', '_blank');
    const rows = PV_DATA.map(d => `
        <tr>
            <td>${d.cliente}</td>
            <td>${COORDENADORES[d.coordenadorId] || d.coordenadorId}</td>
            <td>${d.supervisor || ''}</td>
            <td>${d.dataInicial ? d.dataInicial.split('-').reverse().join('/') : '—'}</td>
            <td>${d.proximoRetorno ? d.proximoRetorno.split('-').reverse().join('/') : '—'}</td>
            <td>${d.status === 'concluido' ? 'Concluído' : 'Pendente'}</td>
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
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            <div class="footer">Gerado via Embraps COE Dashboard em ${new Date().toLocaleString('pt-BR')}</div>
            <script>window.print();</script>
        </body>
        </html>
    `);
    printWindow.document.close();
}
