// Estado global
let currentVagas = [];
let loggedUser = null;

// PINS de acesso (Em produção, o ideal seria armazenar isso no Firebase Auth)
const PINS = {
    'Admin': '9999',
    'Carlos Leme': '1111',
    'Isaias Belchior': '2222',
    'Rejiane Teles': '3333',
    'Renato Augusto': '4444',
    'Ricardo Faustino': '5555'
};

document.addEventListener('DOMContentLoaded', () => {
    verificarLogin();
});

// ==========================================
// AUTENTICAÇÃO E LOGIN
// ==========================================
function verificarLogin() {
    const adminSession = sessionStorage.getItem('admin_logged') === 'true';
    const coordSession = sessionStorage.getItem('coord_logged');

    if (adminSession) {
        loggedUser = 'Admin';
        liberarAcesso('Admin');
    } else if (coordSession) {
        loggedUser = coordSession;
        liberarAcesso(coordSession);
    } else {
        // Modo Público: Não mostra login, apenas oculta botões de coordenador
        loggedUser = null;
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('admin-panel').style.display = 'flex';
        document.getElementById('span-logged-user').innerText = 'Visitante';
        document.getElementById('btn-logout').style.display = 'none';
        document.getElementById('btn-fazer-login').style.display = 'inline-block';
        carregarVagas();
    }
}

function forcarLogin() {
    document.getElementById('login-overlay').style.display = 'flex';
}

function autenticarVagas() {
    const coord = document.getElementById('login-coord').value;
    const pin = document.getElementById('login-pin').value;
    const erro = document.getElementById('login-erro');

    if (!coord) {
        erro.innerText = 'Selecione um coordenador!';
        erro.style.display = 'block';
        return;
    }

    if (PINS[coord] === pin) {
        erro.style.display = 'none';
        
        if (coord === 'Admin') {
            sessionStorage.setItem('admin_logged', 'true');
        } else {
            sessionStorage.setItem('coord_logged', coord);
        }
        
        loggedUser = coord;
        liberarAcesso(coord);
    } else {
        erro.innerText = 'PIN Incorreto!';
        erro.style.display = 'block';
    }
}

function liberarAcesso(nome) {
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'flex';
    document.getElementById('span-logged-user').innerText = nome;
    document.getElementById('btn-logout').style.display = 'block';
    document.getElementById('btn-fazer-login').style.display = 'none';
    
    // Se for um coordenador específico, trava o select de coordenador no formulário
    const selectCoord = document.getElementById('vaga-coord');
    if (nome !== 'Admin') {
        selectCoord.value = nome;
        // selectCoord.disabled = true; // Desabilita para não preencher por outro
    }

    carregarVagas();
}

function logoutVagas() {
    sessionStorage.removeItem('admin_logged');
    sessionStorage.removeItem('coord_logged');
    window.location.reload();
}

// ==========================================
// OPERAÇÕES FIREBASE (CRUD)
// ==========================================
async function carregarVagas() {
    const tbody = document.getElementById('tbody-vagas');
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;">Carregando...</td></tr>';
    
    try {
        const db = firebase.firestore();
        const snapshot = await db.collection('vagas').orderBy('dataAbertura', 'desc').get();
        currentVagas = [];
        
        snapshot.forEach(doc => {
            currentVagas.push({ id: doc.id, ...doc.data() });
        });
        
        atualizarDashboard();
        renderizarTabela(currentVagas);
    } catch (error) {
        console.error('Erro ao buscar vagas:', error);
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:red;">Erro ao carregar os dados.</td></tr>';
    }
}

function calcularDiasAberto(dataAberturaStr, status, dataFechamentoStr) {
    if (!dataAberturaStr) return 0;
    
    const [ano, mes, dia] = dataAberturaStr.split('-');
    const dataAbert = new Date(ano, mes - 1, dia);
    
    let dataFim = new Date(); // Hoje
    
    // Se a vaga já foi efetivada, calcula até o dia do fechamento (ou hoje se não tiver a data registrada)
    if (status === 'Efetivado' && dataFechamentoStr) {
        const [fAno, fMes, fDia] = dataFechamentoStr.split('-');
        dataFim = new Date(fAno, fMes - 1, fDia);
    }
    
    // Retorna a diferença em dias
    const diffTime = Math.abs(dataFim - dataAbert);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
}

function atualizarDashboard() {
    let atrasadas = 0;
    let pendentes = 0;
    let fechadasMes = 0;
    let somaDiasSLA = 0;
    let qtdEfetivadas = 0;
    
    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();

    currentVagas.forEach(vaga => {
        const dias = calcularDiasAberto(vaga.dataAbertura, vaga.status, vaga.dataFechamento);
        
        // Vagas em aberto / Pendente / Em treinamento
        if (vaga.status !== 'Efetivado') {
            pendentes++;
            if (dias > 15) atrasadas++;
        } 
        else {
            // Efetivado
            if (vaga.dataFechamento) {
                const [anoF, mesF, diaF] = vaga.dataFechamento.split('-');
                if (parseInt(mesF) - 1 === mesAtual && parseInt(anoF) === anoAtual) {
                    fechadasMes++;
                }
            }
            somaDiasSLA += dias;
            qtdEfetivadas++;
        }
    });

    const mediaSLA = qtdEfetivadas > 0 ? Math.round(somaDiasSLA / qtdEfetivadas) : 0;

    document.getElementById('kpi-vagas-atrasadas').innerText = atrasadas;
    document.getElementById('kpi-vagas-abertas').innerText = pendentes;
    document.getElementById('kpi-vagas-fechadas').innerText = fechadasMes;
    document.getElementById('kpi-sla-medio').innerText = mediaSLA;

    const alertContainer = document.getElementById('vagas-alerts-container');
    if (alertContainer) {
        if (atrasadas > 0) {
            alertContainer.innerHTML = `
                <div class="custom-alert danger shake-alert">
                    <div class="alert-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
                    <div class="alert-content">
                        <h4>Atenção: Vagas com SLA Estourado</h4>
                        <p>Existem <strong>${atrasadas} movimentações</strong> abertas há mais de 15 dias sem implantação efetiva. Por favor, regularize as informações.</p>
                    </div>
                </div>
            `;
        } else {
            alertContainer.innerHTML = '';
        }
    }
}

function filtrarTabelaVagas() {
    const textFilter = document.getElementById('filtro-vagas').value.toLowerCase();
    const statusFilter = document.getElementById('filtro-status').value;
    const coordFilter = document.getElementById('filtro-coord').value;
    
    const filtradas = currentVagas.filter(vaga => {
        const matchText = vaga.posto.toLowerCase().includes(textFilter) || 
                          vaga.nomeSaiu.toLowerCase().includes(textFilter) || 
                          (vaga.reSaiu && vaga.reSaiu.toString().includes(textFilter));
        
        const matchStatus = statusFilter === "" || vaga.status === statusFilter;
        const matchCoord = coordFilter === "" || vaga.coord === coordFilter;
        
        return matchText && matchStatus && matchCoord;
    });
    
    renderizarTabela(filtradas);
}

function formatarDataBR(dataIso) {
    if (!dataIso) return '';
    const [ano, mes, dia] = dataIso.split('-');
    return `${dia}/${mes}/${ano}`;
}

function renderizarTabela(lista) {
    const tbody = document.getElementById('tbody-vagas');
    tbody.innerHTML = '';
    
    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;">Nenhuma vaga encontrada.</td></tr>';
        return;
    }
    
    lista.forEach(vaga => {
        const dias = calcularDiasAberto(vaga.dataAbertura, vaga.status, vaga.dataFechamento);
        const estaAtrasada = (vaga.status !== 'Efetivado' && dias > 15);
        
        let rowClass = estaAtrasada ? 'row-atrasada' : '';
        let badgeClass = 'badge-pendente';
        
        if (vaga.status === 'Em treinamento') badgeClass = 'badge-treinamento';
        else if (vaga.status === 'Efetivado') badgeClass = 'badge-efetivado';
        
        // Bloquear edição para quem não é dono nem admin
        const podeEditar = (loggedUser === 'Admin' || loggedUser === vaga.coord);
        const actionHtml = podeEditar 
            ? `<button class="action-btn edit" onclick="editarVaga('${vaga.id}')"><i class="fa-solid fa-pen-to-square"></i></button>
               <button class="action-btn delete" onclick="excluirVaga('${vaga.id}')"><i class="fa-solid fa-trash"></i></button>`
            : `<span style="font-size:0.75rem; color:#94a3b8;"><i class="fa-solid fa-lock"></i> Sem perm.</span>`;

        const tr = document.createElement('tr');
        if (rowClass) tr.className = rowClass;
        
        const impHtml = vaga.implantado ? vaga.implantado : `<span style="color:var(--danger);font-size:0.75rem;font-weight:bold;"><i class="fa-solid fa-circle-exclamation"></i> PENDENTE</span>`;
        
        tr.innerHTML = `
            <td><strong>${vaga.reSaiu || '-'}</strong></td>
            <td>${vaga.nomeSaiu || '-'}</td>
            <td><strong>${vaga.numVaga || '-'}</strong></td>
            <td>${vaga.posto}</td>
            <td>${vaga.escala || '-'}</td>
            <td>${vaga.funcao || '-'}</td>
            <td>${vaga.supervisor || '-'}</td>
            <td>${vaga.punicao || '-'}</td>
            <td>${vaga.motivo}</td>
            <td>${formatarDataBR(vaga.dataAbertura)}</td>
            <td><strong style="color: ${estaAtrasada ? 'var(--danger)' : 'inherit'}">${dias} dias</strong></td>
            <td><span class="badge-status ${badgeClass}">${vaga.status}</span></td>
            <td>${impHtml}</td>
            <td>${vaga.coord}</td>
            <td style="text-align: center;">${actionHtml}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ==========================================
// MODAL DE REGISTRO
// ==========================================
function abrirModalVaga() {
    if (!loggedUser) {
        forcarLogin();
        return;
    }

    document.getElementById('vaga-id').value = '';
    document.getElementById('vaga-re-saiu').value = '';
    document.getElementById('vaga-nome-saiu').value = '';
    document.getElementById('vaga-num').value = '';
    document.getElementById('vaga-posto').value = '';
    document.getElementById('vaga-escala').value = '';
    document.getElementById('vaga-funcao').value = '';
    document.getElementById('vaga-supervisor').value = '';
    document.getElementById('vaga-punicao').value = 'Nenhuma';
    document.getElementById('vaga-motivo').value = '';
    document.getElementById('vaga-abertura').value = new Date().toISOString().split('T')[0];
    document.getElementById('vaga-status').value = 'Pendente';
    document.getElementById('vaga-implantado').value = '';
    
    if (loggedUser !== 'Admin') {
        document.getElementById('vaga-coord').value = loggedUser;
    } else {
        document.getElementById('vaga-coord').value = '';
    }

    document.getElementById('modal-vaga-title').innerHTML = '<i class="fa-solid fa-plus"></i> Registrar Movimentação';
    document.getElementById('modal-vaga').style.display = 'flex';
}

function fecharModalVaga() {
    document.getElementById('modal-vaga').style.display = 'none';
}

function editarVaga(id) {
    const vaga = currentVagas.find(v => v.id === id);
    if (!vaga) return;

    document.getElementById('vaga-id').value = vaga.id;
    document.getElementById('vaga-re-saiu').value = vaga.reSaiu || '';
    document.getElementById('vaga-nome-saiu').value = vaga.nomeSaiu || '';
    document.getElementById('vaga-num').value = vaga.numVaga || '';
    document.getElementById('vaga-posto').value = vaga.posto || '';
    document.getElementById('vaga-escala').value = vaga.escala || '';
    document.getElementById('vaga-funcao').value = vaga.funcao || '';
    document.getElementById('vaga-supervisor').value = vaga.supervisor || '';
    document.getElementById('vaga-punicao').value = vaga.punicao || 'Nenhuma';
    document.getElementById('vaga-motivo').value = vaga.motivo || '';
    document.getElementById('vaga-abertura').value = vaga.dataAbertura || '';
    document.getElementById('vaga-status').value = vaga.status || 'Pendente';
    document.getElementById('vaga-implantado').value = vaga.implantado || '';
    document.getElementById('vaga-coord').value = vaga.coord || '';

    document.getElementById('modal-vaga-title').innerHTML = '<i class="fa-solid fa-pen"></i> Editar Movimentação';
    document.getElementById('modal-vaga').style.display = 'flex';
}

async function salvarVaga() {
    const id = document.getElementById('vaga-id').value;
    const reSaiu = document.getElementById('vaga-re-saiu').value;
    const nomeSaiu = document.getElementById('vaga-nome-saiu').value;
    const numVaga = document.getElementById('vaga-num').value;
    const posto = document.getElementById('vaga-posto').value;
    const escala = document.getElementById('vaga-escala').value;
    const funcao = document.getElementById('vaga-funcao').value;
    const supervisor = document.getElementById('vaga-supervisor').value;
    const punicao = document.getElementById('vaga-punicao').value;
    const motivo = document.getElementById('vaga-motivo').value;
    const dataAbertura = document.getElementById('vaga-abertura').value;
    const status = document.getElementById('vaga-status').value;
    const implantado = document.getElementById('vaga-implantado').value;
    const coord = document.getElementById('vaga-coord').value;

    // Validações básicas
    if (!reSaiu || !nomeSaiu || !numVaga || !posto || !escala || !funcao || !supervisor || !motivo || !dataAbertura || !coord) {
        alert('Por favor, preencha todos os campos obrigatórios (*).');
        return;
    }

    // Trava de Efetivado
    if (status === 'Efetivado' && !implantado.trim()) {
        alert('ATENÇÃO: Para alterar o status para EFETIVADO, você deve preencher o nome/RE do Colaborador Implantado.');
        return;
    }

    const db = firebase.firestore();
    const dataFechamento = (status === 'Efetivado') ? new Date().toISOString().split('T')[0] : null;

    const vagaData = {
        reSaiu: parseInt(reSaiu) || reSaiu,
        nomeSaiu,
        numVaga,
        posto,
        escala,
        funcao,
        supervisor,
        punicao,
        motivo,
        dataAbertura,
        status,
        implantado,
        coord,
        dataFechamento, // Guarda o dia em que efetivou
        atualizadoEm: new Date().toISOString()
    };

    try {
        if (id) {
            // Atualizar
            // Não sobrescrever a dataFechamento se já existir e não mudou status
            const vagaAntiga = currentVagas.find(v => v.id === id);
            if (vagaAntiga && vagaAntiga.status === 'Efetivado' && status === 'Efetivado') {
                vagaData.dataFechamento = vagaAntiga.dataFechamento; // mantém a data antiga de efetivação
            }

            await db.collection('vagas').doc(id).update(vagaData);
            alert('Registro atualizado com sucesso!');
        } else {
            // Criar
            vagaData.criadoEm = new Date().toISOString();
            await db.collection('vagas').add(vagaData);
            alert('Vaga registrada com sucesso!');
        }
        fecharModalVaga();
        carregarVagas();
    } catch (error) {
        console.error("Erro ao salvar: ", error);
        alert('Erro ao salvar os dados.');
    }
}

async function excluirVaga(id) {
    if (confirm('Tem certeza que deseja excluir esta movimentação? Essa ação é irreversível.')) {
        try {
            const db = firebase.firestore();
            await db.collection('vagas').doc(id).delete();
            carregarVagas();
        } catch (error) {
            console.error('Erro ao deletar:', error);
            alert('Erro ao excluir registro.');
        }
    }
}

// ==========================================
// EXPORTAÇÃO
// ==========================================
function exportarPDFVagas() {
    const tableContainer = document.querySelector('.form-section');
    if (!tableContainer) return;

    // Remove temporariamente botões de ação e campos não importantes
    const elementsToHide = document.querySelectorAll('.action-btn, .print-btn, #filtro-vagas, #filtro-status, #filtro-coord');
    elementsToHide.forEach(el => el.style.display = 'none');

    const opt = {
        margin:       0.2,
        filename:     'Gestao_de_Vagas.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, windowWidth: 1600 },
        jsPDF:        { unit: 'in', format: 'a3', orientation: 'landscape' }
    };

    html2pdf().set(opt).from(tableContainer).save().then(() => {
        // Restaura elementos
        elementsToHide.forEach(el => el.style.display = '');
    });
}
