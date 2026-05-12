console.log('[DEBUG] admin.js parse started');

function doLogin() {
    console.log('[DEBUG] doLogin() called');
    const user = (document.getElementById('username') || {}).value || '';
    const pass = (document.getElementById('password') || {}).value || '';
    console.log('[DEBUG] user:', user, 'pass:', pass);
    if (user.trim() === 'admin' && pass.trim() === 'admin') {
        sessionStorage.setItem('admin_logged', 'true');
        localStorage.setItem('embraps_admin', 'true');
        showAdminPanel();
    } else {
        const errEl = document.getElementById('login-error');
        if (errEl) errEl.style.display = 'block';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('[DEBUG] DOMContentLoaded fired in admin.js');

    // Login via botão dedicado (sem form submit)
    const btnLogin = document.getElementById('btn-login');
    console.log('[DEBUG] btn-login element:', btnLogin);
    if (btnLogin) {
        btnLogin.addEventListener('click', doLogin);
    }

    // Fallback: enter key no campo de senha
    const passField = document.getElementById('password');
    if (passField) {
        passField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') doLogin();
        });
    }

    // Sessão ativa
    if (sessionStorage.getItem('admin_logged') === 'true') {
        showAdminPanel();
    }

    // Logout
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) btnLogout.addEventListener('click', () => {
        sessionStorage.removeItem('admin_logged');
        localStorage.removeItem('embraps_admin');
        location.reload();
    });

    // ---- Menu Mobile (Hamburger) ----
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const menuToggle = document.getElementById('btn-menu-toggle');

    function openSidebar() {
        if (sidebar) sidebar.classList.add('open');
        if (overlay) overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    function closeSidebar() {
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    if (menuToggle) menuToggle.addEventListener('click', openSidebar);
    if (overlay) overlay.addEventListener('click', closeSidebar);

    // --- ACOES DO PAINEL (só registradas se elementos existirem) ---
    const btnLoad = document.getElementById('btn-load');
    const dataForm = document.getElementById('data-form');
    const btnDelete = document.getElementById('btn-delete');
    if (btnLoad) btnLoad.addEventListener('click', loadMonthData);
    if (dataForm) dataForm.addEventListener('submit', saveMonthData);
    if (btnDelete) btnDelete.addEventListener('click', deleteMonthData);
});

function showAdminPanel() {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'flex';

    // Mostrar barra mobile
    const mobileTopbar = document.getElementById('mobile-topbar-admin');
    if (mobileTopbar) mobileTopbar.style.display = '';

    // Inicializa filtros de ano/mês ao mostrar o painel
    const yearEl = document.getElementById('data-year');
    const monthEl = document.getElementById('data-month');
    if (yearEl) yearEl.value = '2026';
    if (monthEl) monthEl.value = (new Date().getMonth() + 1).toString().padStart(2, '0');
}

const formFields = [
    'faltas', 'demissoes', 'punicoes', 'divergenciaFuncao', 'divergenciasResolvidas', 'pendenciasPonto',
    'gastosFolgas', 'valeTransporte', 'custo99',
    'horasExtrasGeral', 'horasExtrasIntra', 'horasExtras100',
    'visitasContele', 'totalSupervisoresContele', 'reservasDiurna', 'reservasNoturna', 'reservasLimpeza',
    'movTotal',
    'folgasPortaria_1', 'folgasPortaria_2', 'folgasPortaria_3', 'folgasPortaria_4',
    'folgasLimpeza_1', 'folgasLimpeza_2', 'folgasLimpeza_3', 'folgasLimpeza_4',
    'totalTreinamentos'
];

let stateSupervisores99 = [];
let stateSupervisoresContele = [];
let stateMovMotivos = [];
let stateMovSupervisores = [];
let stateMovTransportes = [];
let stateFolgasMotivos = [];
let statePunicoesMotivos = [];
let statePunicoesTipos = [];
let statePontoSupervisores = [];
let stateApp99Motivos = [];
let stateVtCidades = [];
let stateVtEscalas = [];
let stateCoringasPostos = [];
let stateCoringasUsuarios = [];
let stateTopClientesFaltas = [];
let stateTopClientesDemissoes = [];

async function loadMonthData() {
    const year = document.getElementById('data-year').value;
    const month = document.getElementById('data-month').value;

    showAdminAlert('Carregando dados...', 'info');
    const data = await getDataByMonth(year, month);

    const form = document.getElementById('data-form');
    form.style.display = 'block';

    if (data) {
        formFields.forEach(field => {
            const el = document.getElementById(field);
            if (el) el.value = data[field] || 0;
        });

        stateSupervisores99 = data.supervisores99 ? [...data.supervisores99] : [];
        stateSupervisoresContele = data.supervisoresContele ? [...data.supervisoresContele] : [];
        stateMovMotivos = data.movMotivos ? [...data.movMotivos] : [];
        stateMovSupervisores = data.movSupervisores ? [...data.movSupervisores] : [];
        stateMovTransportes = data.movTransportes ? [...data.movTransportes] : [];
        stateFolgasMotivos = data.folgasMotivos ? [...data.folgasMotivos] : [];
        statePunicoesMotivos = data.punicoesMotivos ? [...data.punicoesMotivos] : [];
        statePunicoesTipos = data.punicoesTipos ? [...data.punicoesTipos] : [];
        statePontoSupervisores = data.pontoSupervisores ? [...data.pontoSupervisores] : [];
        stateApp99Motivos = data.app99Motivos ? [...data.app99Motivos] : [];
        stateVtCidades = data.vtCidades ? [...data.vtCidades] : [];
        stateVtEscalas = data.vtEscalas ? [...data.vtEscalas] : [];
        stateCoringasPostos = data.coringasPostos ? [...data.coringasPostos] : [];
        stateCoringasUsuarios = data.coringasUsuarios ? [...data.coringasUsuarios] : [];
        stateTopClientesFaltas = data.topClientesFaltas ? [...data.topClientesFaltas] : [];
        stateTopClientesDemissoes = data.topClientesDemissoes ? [...data.topClientesDemissoes] : [];

        renderDemissoesGridTabela(data.demissoesMotivosDiarios || {});

        if (data.reservas) {
            const mapRes = (id, idx, arr) => {
                if (arr[idx]) {
                    const a = document.getElementById(id + '_atual');
                    const i = document.getElementById(id + '_ideal');
                    if (a) a.value = arr[idx].atual || 0;
                    if (i) i.value = arr[idx].ideal || 0;
                }
            };
            if (data.reservas.limpeza) {
                mapRes('res_limp_diurno', 0, data.reservas.limpeza);
                mapRes('res_limp_vesp', 1, data.reservas.limpeza);
                mapRes('res_limp_5x2', 2, data.reservas.limpeza);
                mapRes('res_limp_12x36', 3, data.reservas.limpeza);
                mapRes('res_limp_coringa', 4, data.reservas.limpeza);
            }
            if (data.reservas.portariaDia) {
                mapRes('res_portdia_par', 0, data.reservas.portariaDia);
                mapRes('res_portdia_impar', 1, data.reservas.portariaDia);
                mapRes('res_portdia_manu', 2, data.reservas.portariaDia);
                mapRes('res_portdia_zel', 3, data.reservas.portariaDia);
                mapRes('res_portdia_coringa', 4, data.reservas.portariaDia);
            }
            if (data.reservas.portariaNoite) {
                mapRes('res_portnoite_par', 0, data.reservas.portariaNoite);
                mapRes('res_portnoite_impar', 1, data.reservas.portariaNoite);
                mapRes('res_portnoite_limp', 2, data.reservas.portariaNoite);
                mapRes('res_portnoite_coringa', 3, data.reservas.portariaNoite);
            }
        }

        renderDailyGrid('faltas-diurna', data.faltasDiurna || {});
        renderDailyGrid('faltas-noturna', data.faltasNoturna || {});
        renderDailyGrid('faltas-limpeza', data.faltasLimpeza || {});
        renderDemissoesGridTabela(data.demissoesMotivosDiarios || {});

        showAdminAlert(`Dados carregados: ${month}/${year}`, 'success');
    } else {
        formFields.forEach(field => {
            const el = document.getElementById(field);
            if (el) el.value = 0;
        });

        stateSupervisores99 = [];
        stateSupervisoresContele = [];
        stateMovMotivos = [];
        stateMovSupervisores = [];
        stateMovTransportes = [];
        stateFolgasMotivos = [];
        statePunicoesMotivos = [];
        statePunicoesTipos = [];
        statePontoSupervisores = [];
        stateApp99Motivos = [];
        stateVtCidades = [];
        stateVtEscalas = [];
        stateCoringasPostos = [];
        stateCoringasUsuarios = [];
        stateTopClientesFaltas = [];
        stateTopClientesDemissoes = [];

        renderDemissoesGridTabela({});
        const resIds = ['res_limp_diurno', 'res_limp_vesp', 'res_limp_5x2', 'res_limp_12x36', 'res_limp_coringa', 'res_portdia_par', 'res_portdia_impar', 'res_portdia_manu', 'res_portdia_zel', 'res_portdia_coringa', 'res_portnoite_par', 'res_portnoite_impar', 'res_portnoite_limp', 'res_portnoite_coringa'];
        resIds.forEach(id => {
            const a = document.getElementById(id + '_atual');
            const i = document.getElementById(id + '_ideal');
            if (a) a.value = 0;
            if (i) i.value = 0;
        });

        renderDailyGrid('faltas-diurna', {});
        renderDailyGrid('faltas-noturna', {});
        renderDailyGrid('faltas-limpeza', {});
        renderDemissoesGridTabela({});

        showAdminAlert(`Nenhum dado encontrado para ${month}/${year}. Preencha para criar.`, 'warning');
    }

    renderSupervisores99();
    renderSupervisoresContele();
    renderMovMotivos();
    renderMovSupervisores();
    renderMovTransportes();
    renderFolgasMotivos();
    renderPunicoesMotivos();
    renderPunicoesTipos();
    renderPontoSupervisores();
    renderApp99Motivos();
    renderVtCidades();
    renderVtEscalas();
    renderCoringasPostos();
    renderCoringasUsuarios();
    renderTopClientesFaltas();
    renderTopClientesDemissoes();
}

// ---- Supervisores 99 ----
function addSupervisor99() {
    stateSupervisores99.push({ nome: '', gasto: 0 });
    renderSupervisores99();
}

function removeSupervisor99(index) {
    stateSupervisores99.splice(index, 1);
    renderSupervisores99();
}

function renderSupervisores99() {
    const container = document.getElementById('list-supervisores99');
    container.innerHTML = '';

    if (stateSupervisores99.length === 0) {
        container.innerHTML = '<p class="text-muted" style="font-size: 0.85rem">Nenhum supervisor adicionado.</p>';
        return;
    }

    stateSupervisores99.forEach((sup, index) => {
        const div = document.createElement('div');
        div.className = 'dynamic-item';
        div.innerHTML = `
            <input type="text" placeholder="Nome" value="${sup.nome}" onchange="stateSupervisores99[${index}].nome = this.value" style="flex: 2;">
            <input type="number" placeholder="Gasto (R$)" value="${sup.gasto}" step="0.01" onchange="stateSupervisores99[${index}].gasto = parseFloat(this.value) || 0" style="flex: 1;">
            <button type="button" class="btn-icon" onclick="removeSupervisor99(${index})" title="Remover"><i class="fa-solid fa-xmark"></i></button>
        `;
        container.appendChild(div);
    });
}

// ---- Supervisores Contele ----
function addSupervisorContele() {
    stateSupervisoresContele.push({ nome: '', visitas: 0, foto: '' });
    renderSupervisoresContele();
}

function removeSupervisorContele(index) {
    stateSupervisoresContele.splice(index, 1);
    renderSupervisoresContele();
}

function renderSupervisoresContele() {
    const container = document.getElementById('list-supervisoresContele');
    container.innerHTML = '';

    if (stateSupervisoresContele.length === 0) {
        container.innerHTML = '<p class="text-muted" style="font-size: 0.85rem">Nenhum supervisor adicionado.</p>';
        return;
    }

    stateSupervisoresContele.forEach((sup, index) => {
        const div = document.createElement('div');
        div.className = 'dynamic-item';

        const imgSrc = sup.foto ? `assets/img/supervisores/${sup.foto}` : 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2394a3b8"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';

        div.innerHTML = `
            <img src="${imgSrc}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 24 24\\' fill=\\'%2394a3b8\\'><path d=\\'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z\\'/></svg>'">
            
            <div style="display: flex; flex-direction: column; gap: 5px; flex: 1;">
                <input type="text" placeholder="Arquivo (ex: joao.png)" value="${sup.foto || ''}" onchange="stateSupervisoresContele[${index}].foto = this.value; renderSupervisoresContele();" style="font-size: 0.85rem;">
            </div>

            <input type="text" placeholder="Nome" value="${sup.nome}" onchange="stateSupervisoresContele[${index}].nome = this.value" style="flex: 2;">
            <input type="number" placeholder="Visitas" value="${sup.visitas}" onchange="stateSupervisoresContele[${index}].visitas = parseInt(this.value) || 0" style="flex: 1;">
            
            <button type="button" class="btn-icon" onclick="removeSupervisorContele(${index})" title="Remover"><i class="fa-solid fa-xmark"></i></button>
        `;
        container.appendChild(div);
    });
}

// ---- Movimentação Operacional ----
function addMovMotivo() {
    stateMovMotivos.push({ nome: '', qtd: 0 });
    renderMovMotivos();
}
function removeMovMotivo(index) {
    stateMovMotivos.splice(index, 1);
    renderMovMotivos();
}
function renderMovMotivos() {
    const container = document.getElementById('list-movMotivos');
    container.innerHTML = '';
    if (stateMovMotivos.length === 0) {
        container.innerHTML = '<p class="text-muted" style="font-size: 0.85rem">Nenhum motivo adicionado.</p>';
        return;
    }
    stateMovMotivos.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'dynamic-item';
        div.innerHTML = `
            <input type="text" placeholder="Motivo" value="${item.nome}" onchange="stateMovMotivos[${index}].nome = this.value" style="flex: 2;">
            <input type="number" placeholder="Qtd" value="${item.qtd}" onchange="stateMovMotivos[${index}].qtd = parseInt(this.value) || 0" style="flex: 1;">
            <button type="button" class="btn-icon" onclick="removeMovMotivo(${index})" title="Remover"><i class="fa-solid fa-xmark"></i></button>
        `;
        container.appendChild(div);
    });
}

function addMovSupervisor() {
    stateMovSupervisores.push({ nome: '', qtd: 0 });
    renderMovSupervisores();
}
function removeMovSupervisor(index) {
    stateMovSupervisores.splice(index, 1);
    renderMovSupervisores();
}
function renderMovSupervisores() {
    const container = document.getElementById('list-movSupervisores');
    container.innerHTML = '';
    if (stateMovSupervisores.length === 0) {
        container.innerHTML = '<p class="text-muted" style="font-size: 0.85rem">Nenhum supervisor adicionado.</p>';
        return;
    }
    stateMovSupervisores.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'dynamic-item';
        div.innerHTML = `
            <input type="text" placeholder="Supervisor" value="${item.nome}" onchange="stateMovSupervisores[${index}].nome = this.value" style="flex: 2;">
            <input type="number" placeholder="Qtd" value="${item.qtd}" onchange="stateMovSupervisores[${index}].qtd = parseInt(this.value) || 0" style="flex: 1;">
            <button type="button" class="btn-icon" onclick="removeMovSupervisor(${index})" title="Remover"><i class="fa-solid fa-xmark"></i></button>
        `;
        container.appendChild(div);
    });
}

function addMovTransporte() {
    stateMovTransportes.push({ nome: '', qtd: 0 });
    renderMovTransportes();
}
function removeMovTransporte(index) {
    stateMovTransportes.splice(index, 1);
    renderMovTransportes();
}
function renderMovTransportes() {
    const container = document.getElementById('list-movTransportes');
    container.innerHTML = '';
    if (stateMovTransportes.length === 0) {
        container.innerHTML = '<p class="text-muted" style="font-size: 0.85rem">Nenhum transporte adicionado.</p>';
        return;
    }
    stateMovTransportes.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'dynamic-item';
        div.innerHTML = `
            <input type="text" placeholder="Transporte" value="${item.nome}" onchange="stateMovTransportes[${index}].nome = this.value" style="flex: 2;">
            <input type="number" placeholder="Qtd" value="${item.qtd}" onchange="stateMovTransportes[${index}].qtd = parseInt(this.value) || 0" style="flex: 1;">
            <button type="button" class="btn-icon" onclick="removeMovTransporte(${index})" title="Remover"><i class="fa-solid fa-xmark"></i></button>
        `;
        container.appendChild(div);
    });
}

// --- Folgas Motivos ---
function addFolgaMotivo() { stateFolgasMotivos.push({ nome: '', valor: 0 }); renderFolgasMotivos(); }
function removeFolgaMotivo(i) { stateFolgasMotivos.splice(i, 1); renderFolgasMotivos(); }
function renderFolgasMotivos() {
    const c = document.getElementById('list-folgasMotivos'); c.innerHTML = '';
    if (stateFolgasMotivos.length === 0) return c.innerHTML = '<p class="text-muted" style="font-size: 0.85rem">Nenhum motivo.</p>';
    stateFolgasMotivos.forEach((item, i) => {
        const div = document.createElement('div'); div.className = 'dynamic-item';
        div.innerHTML = `
            <input type="text" placeholder="Motivo" value="${item.nome}" onchange="stateFolgasMotivos[${i}].nome = this.value" style="flex: 2;">
            <input type="number" placeholder="R$" value="${item.valor}" step="0.01" onchange="stateFolgasMotivos[${i}].valor = parseFloat(this.value) || 0" style="flex: 1;">
            <button type="button" class="btn-icon" onclick="removeFolgaMotivo(${i})"><i class="fa-solid fa-xmark"></i></button>`;
        c.appendChild(div);
    });
}

// --- Punições ---
function addPunicaoMotivo() { statePunicoesMotivos.push({ nome: '', qtd: 0 }); renderPunicoesMotivos(); }
function removePunicaoMotivo(i) { statePunicoesMotivos.splice(i, 1); renderPunicoesMotivos(); }
function renderPunicoesMotivos() {
    const c = document.getElementById('list-punicoesMotivos'); c.innerHTML = '';
    if (statePunicoesMotivos.length === 0) return c.innerHTML = '<p class="text-muted" style="font-size: 0.85rem">Nenhum motivo.</p>';
    statePunicoesMotivos.forEach((item, i) => {
        const div = document.createElement('div'); div.className = 'dynamic-item';
        div.innerHTML = `
            <input type="text" placeholder="Motivo" value="${item.nome}" onchange="statePunicoesMotivos[${i}].nome = this.value" style="flex: 2;">
            <input type="number" placeholder="Qtd" value="${item.qtd}" onchange="statePunicoesMotivos[${i}].qtd = parseInt(this.value) || 0" style="flex: 1;">
            <button type="button" class="btn-icon" onclick="removePunicaoMotivo(${i})"><i class="fa-solid fa-xmark"></i></button>`;
        c.appendChild(div);
    });
}
function addPunicaoTipo() { statePunicoesTipos.push({ nome: '', qtd: 0 }); renderPunicoesTipos(); }
function removePunicaoTipo(i) { statePunicoesTipos.splice(i, 1); renderPunicoesTipos(); }
function renderPunicoesTipos() {
    const c = document.getElementById('list-punicoesTipos'); c.innerHTML = '';
    if (statePunicoesTipos.length === 0) return c.innerHTML = '<p class="text-muted" style="font-size: 0.85rem">Nenhum tipo.</p>';
    statePunicoesTipos.forEach((item, i) => {
        const div = document.createElement('div'); div.className = 'dynamic-item';
        div.innerHTML = `
            <input type="text" placeholder="Tipo" value="${item.nome}" onchange="statePunicoesTipos[${i}].nome = this.value" style="flex: 2;">
            <input type="number" placeholder="Qtd" value="${item.qtd}" onchange="statePunicoesTipos[${i}].qtd = parseInt(this.value) || 0" style="flex: 1;">
            <button type="button" class="btn-icon" onclick="removePunicaoTipo(${i})"><i class="fa-solid fa-xmark"></i></button>`;
        c.appendChild(div);
    });
}

// --- Ponto Supervisores ---
function addPontoSupervisor() { statePontoSupervisores.push({ nome: '', qtd: 0 }); renderPontoSupervisores(); }
function removePontoSupervisor(i) { statePontoSupervisores.splice(i, 1); renderPontoSupervisores(); }
function renderPontoSupervisores() {
    const c = document.getElementById('list-pontoSupervisores'); c.innerHTML = '';
    if (statePontoSupervisores.length === 0) return c.innerHTML = '<p class="text-muted" style="font-size: 0.85rem">Nenhum supervisor.</p>';
    statePontoSupervisores.forEach((item, i) => {
        const div = document.createElement('div'); div.className = 'dynamic-item';
        div.innerHTML = `
            <input type="text" placeholder="Supervisor" value="${item.nome}" onchange="statePontoSupervisores[${i}].nome = this.value" style="flex: 2;">
            <input type="number" placeholder="Qtd Pendências" value="${item.qtd}" onchange="statePontoSupervisores[${i}].qtd = parseInt(this.value) || 0" style="flex: 1;">
            <button type="button" class="btn-icon" onclick="removePontoSupervisor(${i})"><i class="fa-solid fa-xmark"></i></button>`;
        c.appendChild(div);
    });
}

// --- App 99 Motivos ---
function addApp99Motivo() { stateApp99Motivos.push({ nome: '', valor: 0 }); renderApp99Motivos(); }
function removeApp99Motivo(i) { stateApp99Motivos.splice(i, 1); renderApp99Motivos(); }
function renderApp99Motivos() {
    const c = document.getElementById('list-app99Motivos'); c.innerHTML = '';
    if (stateApp99Motivos.length === 0) return c.innerHTML = '<p class="text-muted" style="font-size: 0.85rem">Nenhum motivo.</p>';
    stateApp99Motivos.forEach((item, i) => {
        const div = document.createElement('div'); div.className = 'dynamic-item';
        div.innerHTML = `
            <input type="text" placeholder="Motivo" value="${item.nome || ''}" onchange="stateApp99Motivos[${i}].nome = this.value" style="flex: 2;">
            <input type="number" placeholder="Valor (R$)" value="${item.valor || 0}" step="0.01" onchange="stateApp99Motivos[${i}].valor = parseFloat(this.value) || 0" style="flex: 1;">
            <button type="button" class="btn-icon" onclick="removeApp99Motivo(${i})"><i class="fa-solid fa-xmark"></i></button>`;
        c.appendChild(div);
    });
}

// --- VT Cidades e Escalas ---
function addVtCidade() { stateVtCidades.push({ nome: '', valor: 0 }); renderVtCidades(); }
function removeVtCidade(i) { stateVtCidades.splice(i, 1); renderVtCidades(); }
function renderVtCidades() {
    const c = document.getElementById('list-vtCidades'); c.innerHTML = '';
    if (stateVtCidades.length === 0) return c.innerHTML = '<p class="text-muted" style="font-size: 0.85rem">Nenhuma cidade.</p>';
    stateVtCidades.forEach((item, i) => {
        const div = document.createElement('div'); div.className = 'dynamic-item';
        div.innerHTML = `
            <input type="text" placeholder="Cidade" value="${item.nome}" onchange="stateVtCidades[${i}].nome = this.value" style="flex: 2;">
            <input type="number" placeholder="Valor (R$)" value="${item.valor}" step="0.01" onchange="stateVtCidades[${i}].valor = parseFloat(this.value) || 0" style="flex: 1;">
            <button type="button" class="btn-icon" onclick="removeVtCidade(${i})"><i class="fa-solid fa-xmark"></i></button>`;
        c.appendChild(div);
    });
}
function addVtEscala() { stateVtEscalas.push({ nome: '', valor: 0 }); renderVtEscalas(); }
function removeVtEscala(i) { stateVtEscalas.splice(i, 1); renderVtEscalas(); }
function renderVtEscalas() {
    const c = document.getElementById('list-vtEscalas'); c.innerHTML = '';
    if (stateVtEscalas.length === 0) return c.innerHTML = '<p class="text-muted" style="font-size: 0.85rem">Nenhuma escala.</p>';
    stateVtEscalas.forEach((item, i) => {
        const div = document.createElement('div'); div.className = 'dynamic-item';
        div.innerHTML = `
            <input type="text" placeholder="Escala" value="${item.nome}" onchange="stateVtEscalas[${i}].nome = this.value" style="flex: 2;">
            <input type="number" placeholder="Valor (R$)" value="${item.valor}" step="0.01" onchange="stateVtEscalas[${i}].valor = parseFloat(this.value) || 0" style="flex: 1;">
            <button type="button" class="btn-icon" onclick="removeVtEscala(${i})"><i class="fa-solid fa-xmark"></i></button>`;
        c.appendChild(div);
    });
}

// --- Coringas ---
function addCoringaPosto() { stateCoringasPostos.push({ nome: '', qtd: 0 }); renderCoringasPostos(); }
function removeCoringaPosto(i) { stateCoringasPostos.splice(i, 1); renderCoringasPostos(); }
function renderCoringasPostos() {
    const c = document.getElementById('list-coringasPostos'); c.innerHTML = '';
    if (stateCoringasPostos.length === 0) return c.innerHTML = '<p class="text-muted" style="font-size: 0.85rem">Nenhum posto.</p>';
    stateCoringasPostos.forEach((item, i) => {
        const div = document.createElement('div'); div.className = 'dynamic-item';
        div.innerHTML = `
            <input type="text" placeholder="Posto" value="${item.nome}" onchange="stateCoringasPostos[${i}].nome = this.value" style="flex: 2;">
            <input type="number" placeholder="Qtd" value="${item.qtd}" onchange="stateCoringasPostos[${i}].qtd = parseInt(this.value) || 0" style="flex: 1;">
            <button type="button" class="btn-icon" onclick="removeCoringaPosto(${i})"><i class="fa-solid fa-xmark"></i></button>`;
        c.appendChild(div);
    });
}
function addCoringaUsuario() { stateCoringasUsuarios.push({ nome: '', qtd: 0 }); renderCoringasUsuarios(); }
function removeCoringaUsuario(i) { stateCoringasUsuarios.splice(i, 1); renderCoringasUsuarios(); }
function renderCoringasUsuarios() {
    const c = document.getElementById('list-coringasUsuarios'); c.innerHTML = '';
    if (stateCoringasUsuarios.length === 0) return c.innerHTML = '<p class="text-muted" style="font-size: 0.85rem">Nenhum usuário.</p>';
    stateCoringasUsuarios.forEach((item, i) => {
        const div = document.createElement('div'); div.className = 'dynamic-item';
        div.innerHTML = `
            <input type="text" placeholder="Usuário" value="${item.nome}" onchange="stateCoringasUsuarios[${i}].nome = this.value" style="flex: 2;">
            <input type="number" placeholder="Qtd" value="${item.qtd}" onchange="stateCoringasUsuarios[${i}].qtd = parseInt(this.value) || 0" style="flex: 1;">
            <button type="button" class="btn-icon" onclick="removeCoringaUsuario(${i})"><i class="fa-solid fa-xmark"></i></button>`;
        c.appendChild(div);
    });
}
function renderDailyGrid(type, dataObj) {
    const container = document.getElementById(`grid-${type}`);
    container.innerHTML = '';

    for (let i = 1; i <= 31; i++) {
        const val = dataObj[i] || 0;
        const div = document.createElement('div');
        div.className = 'daily-grid-item';
        div.innerHTML = `
            <label>Dia ${i}</label>
            <input type="number" min="0" class="input-${type}" data-day="${i}" value="${val}" onchange="recalcTotals()">
        `;
        container.appendChild(div);
    }
}

function recalcTotals() {
    let totalFaltas = 0;
    ['faltas-diurna', 'faltas-noturna', 'faltas-limpeza'].forEach(type => {
        document.querySelectorAll(`.input-${type}`).forEach(input => {
            totalFaltas += parseInt(input.value) || 0;
        });
    });
    document.getElementById('faltas').value = totalFaltas;
}

function renderDemissoesGridTabela(dataObj) {
    const tbody = document.querySelector('#table-demissoes-diarias tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    for (let i = 1; i <= 31; i++) {
        const item = dataObj[i] || { empresa: 0, pedido: 0, experiencia: 0, justa_causa: 0 };
        const tr = document.createElement('tr');

        tr.innerHTML = `
            <td style="font-weight: bold; text-align: center; color: var(--primary-color);">${i}</td>
            <td><input type="number" min="0" class="input-dem-empresa" data-day="${i}" value="${item.empresa || 0}" onchange="recalcDemissoesTabela()"></td>
            <td><input type="number" min="0" class="input-dem-pedido" data-day="${i}" value="${item.pedido || 0}" onchange="recalcDemissoesTabela()"></td>
            <td><input type="number" min="0" class="input-dem-experiencia" data-day="${i}" value="${item.experiencia || 0}" onchange="recalcDemissoesTabela()"></td>
            <td><input type="number" min="0" class="input-dem-justa" data-day="${i}" value="${item.justa_causa || 0}" onchange="recalcDemissoesTabela()"></td>
            <td style="font-weight: bold; color: var(--danger); text-align: center; background-color: #f8fafc;" id="total-dem-dia-${i}">0</td>
        `;
        tbody.appendChild(tr);
    }
    recalcDemissoesTabela(); // initial calc
}

function recalcDemissoesTabela() {
    let totalMes = 0;
    for (let i = 1; i <= 31; i++) {
        const emp = parseInt(document.querySelector(`.input-dem-empresa[data-day="${i}"]`).value) || 0;
        const ped = parseInt(document.querySelector(`.input-dem-pedido[data-day="${i}"]`).value) || 0;
        const exp = parseInt(document.querySelector(`.input-dem-experiencia[data-day="${i}"]`).value) || 0;
        const jus = parseInt(document.querySelector(`.input-dem-justa[data-day="${i}"]`).value) || 0;

        const totalDia = emp + ped + exp + jus;
        document.getElementById(`total-dem-dia-${i}`).innerText = totalDia;
        totalMes += totalDia;
    }
    const demEl = document.getElementById('demissoes');
    if (demEl) demEl.value = totalMes;
}

async function saveMonthData(e) {
    e.preventDefault();
    const year = document.getElementById('data-year').value;
    const month = document.getElementById('data-month').value;

    const existingData = (await getDataByMonth(year, month)) || {};
    const payload = { ...existingData };

    formFields.forEach(field => {
        const el = document.getElementById(field);
        if (el) {
            payload[field] = el.step ? parseFloat(el.value) || 0 : parseInt(el.value, 10) || 0;
        }
    });

    const getFaltasGrid = (type) => {
        const obj = {};
        document.querySelectorAll(`.input-${type}`).forEach(input => {
            obj[input.dataset.day] = parseInt(input.value) || 0;
        });
        return obj;
    };
    payload.faltasDiurna = getFaltasGrid('faltas-diurna');
    payload.faltasNoturna = getFaltasGrid('faltas-noturna');
    payload.faltasLimpeza = getFaltasGrid('faltas-limpeza');

    const demissoesMotivosDiarios = {};
    const demissoesDiarias = {};
    const demissoesMotivos = { empresa: 0, pedido: 0, experiencia: 0, justa_causa: 0 };

    for (let i = 1; i <= 31; i++) {
        const emp = parseInt(document.querySelector(`.input-dem-empresa[data-day="${i}"]`).value) || 0;
        const ped = parseInt(document.querySelector(`.input-dem-pedido[data-day="${i}"]`).value) || 0;
        const exp = parseInt(document.querySelector(`.input-dem-experiencia[data-day="${i}"]`).value) || 0;
        const jus = parseInt(document.querySelector(`.input-dem-justa[data-day="${i}"]`).value) || 0;

        demissoesMotivosDiarios[i] = { empresa: emp, pedido: ped, experiencia: exp, justa_causa: jus };
        demissoesDiarias[i] = emp + ped + exp + jus;

        demissoesMotivos.empresa += emp;
        demissoesMotivos.pedido += ped;
        demissoesMotivos.experiencia += exp;
        demissoesMotivos.justa_causa += jus;
    }

    payload.demissoesMotivosDiarios = demissoesMotivosDiarios;
    payload.demissoesDiarias = demissoesDiarias;
    payload.demissoesMotivos = demissoesMotivos;

    const getRes = (id, name) => ({
        escala: name,
        atual: parseInt(document.getElementById(id + '_atual').value) || 0,
        ideal: parseInt(document.getElementById(id + '_ideal').value) || 0
    });

    payload.reservas = {
        limpeza: [
            getRes('res_limp_diurno', 'Auxiliar de limpeza 5x1 diurno'),
            getRes('res_limp_vesp', 'Auxiliar de limpeza 5x1 vespertino'),
            getRes('res_limp_5x2', 'Auxiliar de limpeza 5x2'),
            getRes('res_limp_12x36', 'Auxiliar de limpeza 12x36'),
            getRes('res_limp_coringa', 'Coringas')
        ],
        portariaDia: [
            getRes('res_portdia_par', 'Porteiro Par'),
            getRes('res_portdia_impar', 'Porteiro Impar'),
            getRes('res_portdia_manu', 'Auxiliar de manuntenção'),
            getRes('res_portdia_zel', 'Zelador'),
            getRes('res_portdia_coringa', 'Coringas')
        ],
        portariaNoite: [
            getRes('res_portnoite_par', 'Porteiro Par'),
            getRes('res_portnoite_impar', 'Porteiro Impar'),
            getRes('res_portnoite_limp', 'Auxiliar de limpeza noturno'),
            getRes('res_portnoite_coringa', 'Coringas')
        ]
    };

    payload.supervisores99 = [...stateSupervisores99];
    payload.supervisoresContele = [...stateSupervisoresContele];
    payload.movMotivos = [...stateMovMotivos];
    payload.movSupervisores = [...stateMovSupervisores];
    payload.movTransportes = [...stateMovTransportes];
    payload.folgasMotivos = [...stateFolgasMotivos];
    payload.punicoesMotivos = [...statePunicoesMotivos];
    payload.punicoesTipos = [...statePunicoesTipos];
    payload.pontoSupervisores = [...statePontoSupervisores];
    payload.app99Motivos = [...stateApp99Motivos];
    payload.vtCidades = [...stateVtCidades];
    payload.vtEscalas = [...stateVtEscalas];
    payload.coringasPostos = [...stateCoringasPostos];
    payload.coringasUsuarios = [...stateCoringasUsuarios];
    payload.topClientesFaltas = [...stateTopClientesFaltas];
    payload.topClientesDemissoes = [...stateTopClientesDemissoes];
    payload.topClientesFaltasPerc = [...stateTopClientesFaltas];
    payload.topClientesDemissoesPerc = [...stateTopClientesDemissoes];

    try {
        await saveData(year, month, payload);
        showAdminAlert(`Dados de ${month}/${year} salvos com sucesso! A Dashboard foi atualizada.`, 'success');
    } catch (err) {
        showAdminAlert(`Erro ao salvar dados: ${err.message}`, 'warning');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteMonthData() {
    const year = document.getElementById('data-year').value;
    const month = document.getElementById('data-month').value;

    if (confirm(`Tem certeza que deseja excluir TODOS os dados de ${month}/${year}?`)) {
        const ok = await deleteData(year, month);
        if (ok) {
            showAdminAlert(`Dados de ${month}/${year} foram excluídos.`, 'success');
            document.getElementById('data-form').style.display = 'none';
        } else {
            showAdminAlert(`Não havia dados salvos para ${month}/${year}.`, 'warning');
        }
    }
}

// --- Top Clientes Faltas ---
function addTopClienteFaltas() { stateTopClientesFaltas.push({ nome: '', faltas: 0, percentual: 0 }); renderTopClientesFaltas(); }
function removeTopClienteFaltas(i) { stateTopClientesFaltas.splice(i, 1); renderTopClientesFaltas(); }
function renderTopClientesFaltas() {
    const c = document.getElementById('list-topClientesFaltas'); c.innerHTML = '';
    if (!c) return;
    if (stateTopClientesFaltas.length === 0) { c.innerHTML = '<p class="text-muted" style="font-size: 0.85rem">Nenhum cliente adicionado.</p>'; return; }
    stateTopClientesFaltas.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'dynamic-item';
        div.innerHTML = `
            <input type="text" placeholder="Cliente" value="${item.nome}" onchange="stateTopClientesFaltas[${index}].nome = this.value" style="flex: 2;">
            <input type="number" placeholder="Faltas" value="${item.faltas}" onchange="stateTopClientesFaltas[${index}].faltas = parseInt(this.value) || 0" style="flex: 1;">
            <input type="number" placeholder="%" value="${item.percentual}" step="0.1" onchange="stateTopClientesFaltas[${index}].percentual = parseFloat(this.value) || 0" style="flex: 1;">
            <button type="button" class="btn-icon" onclick="removeTopClienteFaltas(${index})" title="Remover"><i class="fa-solid fa-xmark"></i></button>
        `;
        c.appendChild(div);
    });
}

// --- Top Clientes Demissoes ---
function addTopClienteDemissoes() { stateTopClientesDemissoes.push({ nome: '', demissoes: 0, percentual: 0 }); renderTopClientesDemissoes(); }
function removeTopClienteDemissoes(i) { stateTopClientesDemissoes.splice(i, 1); renderTopClientesDemissoes(); }
function renderTopClientesDemissoes() {
    const c = document.getElementById('list-topClientesDemissoes'); c.innerHTML = '';
    if (!c) return;
    if (stateTopClientesDemissoes.length === 0) { c.innerHTML = '<p class="text-muted" style="font-size: 0.85rem">Nenhum cliente adicionado.</p>'; return; }
    stateTopClientesDemissoes.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'dynamic-item';
        div.innerHTML = `
            <input type="text" placeholder="Cliente" value="${item.nome}" onchange="stateTopClientesDemissoes[${index}].nome = this.value" style="flex: 2;">
            <input type="number" placeholder="Demissões" value="${item.demissoes}" onchange="stateTopClientesDemissoes[${index}].demissoes = parseInt(this.value) || 0" style="flex: 1;">
            <input type="number" placeholder="%" value="${item.percentual}" step="0.1" onchange="stateTopClientesDemissoes[${index}].percentual = parseFloat(this.value) || 0" style="flex: 1;">
            <button type="button" class="btn-icon" onclick="removeTopClienteDemissoes(${index})" title="Remover"><i class="fa-solid fa-xmark"></i></button>
        `;
        c.appendChild(div);
    });
}

function showAdminAlert(message, type = 'info') {
    const container = document.getElementById('admin-alerts');
    container.innerHTML = '';

    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;

    let icon = 'fa-info-circle';
    if (type === 'warning') icon = 'fa-exclamation-triangle';
    if (type === 'success') icon = 'fa-check-circle';

    alertDiv.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    container.appendChild(alertDiv);

    setTimeout(() => {
        if (container.contains(alertDiv)) {
            alertDiv.remove();
        }
    }, 5000);
}
