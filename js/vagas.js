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

// ==========================================
// INTEGRAÇÃO GOOGLE SHEETS — ADMISSÕES
// ==========================================
// URL da planilha publicada como CSV (primeira aba)
const SHEETS_CSV_URL = 'https://docs.google.com/spreadsheets/d/1KoWxFgi3RyUzB7ezzGvxcJeGYXwbCCChL1nM99MSOCc/export?format=csv';

/**
 * Parseia o CSV da planilha de admissões.
 * Estrutura confirmada:
 *   Col 2  (índice 2)  → RE (matrícula)
 *   Col 3  (índice 3)  → COLABORADOR (nome)
 *   Col 20 (índice 20) → Nº VAGA
 * Retorna array de { colaborador, numVaga }
 */
function parseAdmissoesCSV(csvText) {
    const linhas = csvText.split('\n').map(l => l.trim()).filter(Boolean);
    const resultado = [];

    // Encontrar a linha de cabeçalho real (contém 'ADMISSÕES' ou 'COLABORADOR')
    let dataStart = -1;
    for (let i = 0; i < linhas.length; i++) {
        if (linhas[i].toUpperCase().includes('ADMISS') || linhas[i].toUpperCase().includes('COLABORADOR')) {
            dataStart = i + 1; // dados começam na linha seguinte
            break;
        }
    }
    if (dataStart === -1) return resultado;

    for (let i = dataStart; i < linhas.length; i++) {
        const cols = parseCSVLine(linhas[i]);
        if (cols.length < 5) continue;

        const re          = (cols[2] || '').trim();
        const colaborador = (cols[3] || '').trim();
        const numVaga     = (cols[20] || '').trim();

        // Validação do número da vaga (evita sincronizar com placeholders genéricos como S/N)
        const isInvalidNum = !numVaga || 
                             numVaga.toUpperCase() === 'S/N' || 
                             numVaga.toUpperCase() === 'SN' || 
                             numVaga.toUpperCase() === 'SEM NÚMERO' ||
                             numVaga.toUpperCase() === 'SEM NUMERO';

        if (colaborador && !isInvalidNum) {
            // Guarda como "RE - Nome" para ficar mais completo na listagem
            const colaboradorFormatado = re ? `${re} - ${colaborador}` : colaborador;
            resultado.push({ colaborador: colaboradorFormatado, numVaga });
        }
    }
    return resultado;
}

/** Parseia uma linha CSV respeitando campos entre aspas */
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    result.push(current);
    return result;
}

/**
 * Sincroniza a planilha de admissões com as vagas pendentes no Firebase.
 * Para cada linha da planilha que tenha numVaga correspondente a uma vaga
 * com status != Efetivado, atualiza: implantado, status, dataFechamento, fonteImplantacao.
 */
async function sincronizarAdmissoes(exibirResultado = true) {
    const statusEl = document.getElementById('sync-status');
    const btnSync  = document.getElementById('btn-sync');

    if (statusEl) {
        statusEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sincronizando com planilha...';
        statusEl.style.color = '#64748b';
    }
    if (btnSync) btnSync.disabled = true;

    try {
        const resp = await fetch(SHEETS_CSV_URL);
        if (!resp.ok) throw new Error('Erro ao buscar planilha');
        const csvText = await resp.text();

        const admissoes = parseAdmissoesCSV(csvText);
        if (admissoes.length === 0) {
            if (statusEl) {
                statusEl.innerHTML = '<i class="fa-solid fa-circle-info"></i> Nenhum dado encontrado na planilha.';
                statusEl.style.color = '#f59e0b';
            }
            if (exibirResultado) {
                alert("Nenhum registro de admissão foi encontrado na planilha.");
            }
            return;
        }

        const db = firebase.firestore();
        const hoje = new Date().toISOString().split('T')[0];
        let atualizadas = 0;

        // Para cada linha da planilha, verificar se há vaga pendente com esse numVaga
        const vagasParaAtualizar = [];
        const matchedVagaIds = new Set();
        for (const adm of admissoes) {
            const vagaMatch = currentVagas.find(v =>
                v.numVaga &&
                String(v.numVaga).trim() === String(adm.numVaga).trim() &&
                v.status !== 'Efetivado' &&
                !matchedVagaIds.has(v.id)
            );
            if (vagaMatch && adm.colaborador) {
                vagasParaAtualizar.push({ vaga: vagaMatch, adm });
                matchedVagaIds.add(vagaMatch.id);
            }
        }

        if (vagasParaAtualizar.length === 0) {
            if (statusEl) {
                const agora = new Date().toLocaleTimeString('pt-BR');
                statusEl.innerHTML = `<i class="fa-solid fa-check"></i> Sincronizado às ${agora} — Nenhuma vaga nova para atualizar.`;
                statusEl.style.color = '#10b981';
            }
            if (btnSync) btnSync.disabled = false;
            if (exibirResultado) {
                alert("Sincronização concluída! Nenhuma nova vaga para atualizar.");
            }
            return;
        }

        // Atualizar no Firebase em batch
        const batch = db.batch();
        for (const { vaga, adm } of vagasParaAtualizar) {
            const ref = db.collection('vagas').doc(vaga.id);
            const updateFields = {
                implantado:       adm.colaborador,
                status:           'Efetivado',
                dataFechamento:   hoje,
                fonteImplantacao: 'automatico',
                atualizadoEm:     new Date().toISOString()
            };
            batch.update(ref, updateFields);

            // Atualizar localmente para evitar dupla consulta ao Firebase
            const localVaga = currentVagas.find(v => v.id === vaga.id);
            if (localVaga) {
                Object.assign(localVaga, updateFields);
            }
            atualizadas++;
        }
        await batch.commit();

        const agora = new Date().toLocaleTimeString('pt-BR');
        if (statusEl) {
            statusEl.innerHTML = `<i class="fa-solid fa-check-double"></i> Sincronizado às ${agora} — <strong>${atualizadas} vaga(s) efetivada(s) automaticamente!</strong>`;
            statusEl.style.color = '#10b981';
        }

        // Atualizar dashboard e tabela localmente para refletir as mudanças sem re-buscar
        atualizarDashboard();
        renderizarTabela(currentVagas);

        if (exibirResultado) {
            alert(`Sincronização concluída! ${atualizadas} vaga(s) foram efetivada(s) com sucesso.`);
        }

    } catch (err) {
        console.error('Erro na sincronização:', err);
        if (statusEl) {
            statusEl.innerHTML = '<i class="fa-solid fa-xmark"></i> Erro ao sincronizar. Verifique o console.';
            statusEl.style.color = '#ef4444';
        }
        if (exibirResultado) {
            alert("Erro ao realizar a sincronização. Por favor, verifique a conexão e o console.");
        }
    } finally {
        if (btnSync) btnSync.disabled = false;
    }
}

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
async function carregarVagas(limite = 150) {
    const tbody = document.getElementById('tbody-vagas');
    tbody.innerHTML = '<tr><td colspan="16" style="text-align:center;">Carregando...</td></tr>';
    
    try {
        const db = firebase.firestore();
        let query = db.collection('vagas').orderBy('dataAbertura', 'desc');
        
        // Aplica o limite se for maior que zero
        if (limite > 0) {
            query = query.limit(limite);
        }

        const snapshot = await query.get();
        currentVagas = [];
        
        snapshot.forEach(doc => {
            currentVagas.push({ id: doc.id, ...doc.data() });
        });
        
        atualizarDashboard();
        renderizarTabela(currentVagas);

        // Se trouxer o máximo do limite, mostra botão para carregar mais
        mostrarBotaoCarregarMais(limite > 0 && currentVagas.length === limite);

        // Sincronizar automaticamente com Google Sheets (sem alert)
        sincronizarAdmissoes(false);

    } catch (error) {
        console.error('Erro ao buscar vagas:', error);
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:red;">Erro ao carregar os dados.</td></tr>';
    }
}

function carregarTodoHistorico() {
    // Passa 0 para não ter limite de carregamento
    carregarVagas(0);
}

function mostrarBotaoCarregarMais(mostrar) {
    let btnContainer = document.getElementById('container-carregar-mais');
    
    if (!btnContainer) {
        btnContainer = document.createElement('div');
        btnContainer.id = 'container-carregar-mais';
        btnContainer.style.textAlign = 'center';
        btnContainer.style.marginTop = '15px';
        btnContainer.innerHTML = `
            <button class="btn-primary" onclick="carregarTodoHistorico()" style="background-color: #64748b; border: none; padding: 8px 15px; font-size: 0.9rem;">
                <i class="fa-solid fa-clock-rotate-left"></i> Carregar Histórico Antigo
            </button>
            <p style="font-size: 0.8rem; color: #64748b; margin-top: 5px;">Atualmente exibindo os últimos registros para garantir performance.</p>
        `;
        document.querySelector('.form-section').appendChild(btnContainer);
    }

    btnContainer.style.display = mostrar ? 'block' : 'none';
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

        // Badge de implantado: automático 🤖 ou manual ✏️
        let impHtml;
        if (vaga.implantado) {
            const isAuto = vaga.fonteImplantacao === 'automatico';
            const badgeIcon  = isAuto
                ? '<i class="fa-solid fa-robot" title="Preenchido automaticamente via planilha"></i>'
                : '<i class="fa-solid fa-pen" title="Preenchido manualmente"></i>';
            const badgeColor = isAuto ? '#7c3aed' : '#0369a1';
            impHtml = `<span style="display:flex;align-items:center;gap:5px;">
                <span style="color:${badgeColor};font-size:0.8rem;">${badgeIcon}</span>
                <span>${vaga.implantado}</span>
            </span>`;
        } else {
            impHtml = `<span style="color:var(--danger);font-size:0.75rem;font-weight:bold;"><i class="fa-solid fa-circle-exclamation"></i> PENDENTE</span>`;
        }

        // Data de conclusão
        const conclusaoHtml = vaga.dataFechamento
            ? `<span style="font-size:0.8rem;color:#64748b;">${formatarDataBR(vaga.dataFechamento)}</span>`
            : `<span style="color:#cbd5e1;font-size:0.75rem;">—</span>`;
        
        tr.innerHTML = `
            <td data-label="RE Saiu"><strong>${vaga.reSaiu || '-'}</strong></td>
            <td data-label="Colab. Substituído">${vaga.nomeSaiu || '-'}</td>
            <td data-label="Nº Vaga"><strong>${vaga.numVaga || '-'}</strong></td>
            <td data-label="Posto">${vaga.posto}</td>
            <td data-label="Escala">${vaga.escala || '-'}</td>
            <td data-label="Função">${vaga.funcao || '-'}</td>
            <td data-label="Supervisor">${vaga.supervisor || '-'}</td>
            <td data-label="Punição">${vaga.punicao || '-'}</td>
            <td data-label="Motivo">${vaga.motivo}</td>
            <td data-label="Abertura">${formatarDataBR(vaga.dataAbertura)}</td>
            <td data-label="Tempo Vaga"><strong style="color: ${estaAtrasada ? 'var(--danger)' : 'inherit'}">${dias} dias</strong></td>
            <td data-label="Status"><span class="badge-status ${badgeClass}">${vaga.status}</span></td>
            <td data-label="Implantado">${impHtml}</td>
            <td data-label="Conclusão">${conclusaoHtml}</td>
            <td data-label="Coord">${vaga.coord}</td>
            <td data-label="Ações" style="text-align: center;">${actionHtml}</td>
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
