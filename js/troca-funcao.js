/* Lógica de Negócio - Troca de Função */

let TF_USER = null;
let TF_DATA = [];

// PINs de acesso (mesmos do pós-venda)
const TF_PINS = {
    'admin':             '9999',
    'Carlos Leme':       '1111',
    'Isaias Belchior':   '2222',
    'Rejiane Teles':     '3333',
    'Renato Augusto':    '4444',
    'Ricardo Faustino':  '5555'
};

document.addEventListener('DOMContentLoaded', () => {
    // Verificar sessão
    const savedUser = sessionStorage.getItem('tf_logged_user');
    if (savedUser && TF_PINS[savedUser]) {
        tf_liberarAcesso(savedUser);
    }
});

// =============================================
// LOGIN
// =============================================
function tf_login() {
    const user = document.getElementById('tf-op-select').value;
    const pass = document.getElementById('tf-pw').value.trim();
    const err = document.getElementById('tf-login-err');
    
    if (!user || !pass) {
        err.style.display = 'block';
        return;
    }

    if (TF_PINS[user] === pass) {
        sessionStorage.setItem('tf_logged_user', user);
        tf_liberarAcesso(user);
    } else {
        err.style.display = 'block';
    }
}

function tf_liberarAcesso(user) {
    TF_USER = user;
    document.getElementById('tf-login').style.display = 'none';
    document.getElementById('tf-app').style.display = 'block';
    document.getElementById('tf-user-name').innerHTML = `<i class="fa-solid fa-user"></i> ${user}`;
    
    tf_loadData();
}

function tf_logout() {
    sessionStorage.removeItem('tf_logged_user');
    TF_USER = null;
    document.getElementById('tf-pw').value = '';
    document.getElementById('tf-login-err').style.display = 'none';
    document.getElementById('tf-app').style.display = 'none';
    document.getElementById('tf-login').style.display = 'flex';
}

// =============================================
// DADOS (FIREBASE)
// =============================================
function tf_loadData() {
    if (!db) {
        console.error("Firebase db não inicializado.");
        return;
    }

    db.collection('troca_funcao').onSnapshot((snapshot) => {
        TF_DATA = [];
        snapshot.forEach(doc => {
            TF_DATA.push({ id: doc.id, ...doc.data() });
        });
        tf_renderTable();
        tf_updateKPIs();
    }, (error) => {
        console.error("Erro ao carregar dados de Troca de Função:", error);
    });
}

// =============================================
// RENDERIZAÇÃO
// =============================================
function tf_calcularStatus(dataFinalStr) {
    if (!dataFinalStr) return { class: '', text: 'Sem Data', dias: 0 };
    
    // Convert to Date
    const finalDate = new Date(dataFinalStr + 'T23:59:59');
    const today = new Date();
    
    // Difference in milliseconds
    const diffTime = finalDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
        return { class: 'atrasado', text: 'Vencido', dias: diffDays };
    } else if (diffDays <= 15) {
        return { class: 'atencao', text: 'A Vencer', dias: diffDays };
    } else {
        return { class: 'no-prazo', text: 'No Prazo', dias: diffDays };
    }
}

function tf_formatDate(dateStr) {
    if (!dateStr) return '-';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
}

function tf_renderTable() {
    const tbody = document.getElementById('tf-tbody');
    const coordFilter = document.getElementById('tf-filter-coord').value;
    const statusFilter = document.getElementById('tf-filter-status').value;
    
    tbody.innerHTML = '';
    
    // Filtros
    let list = TF_DATA.filter(item => {
        let matchCoord = coordFilter === '' || item.coordenador === coordFilter;
        let st = tf_calcularStatus(item.dataFinal).class;
        let matchStatus = statusFilter === '' || st === statusFilter;
        return matchCoord && matchStatus;
    });

    // Ordenar por data final (mais próximos primeiro)
    list.sort((a, b) => new Date(a.dataFinal) - new Date(b.dataFinal));

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#64748b;">Nenhum processo encontrado.</td></tr>`;
        return;
    }

    list.forEach(item => {
        const st = tf_calcularStatus(item.dataFinal);
        
        let actions = `
            <button class="tf-btn tf-btn-ghost" title="Editar" onclick="tf_editarRegistro('${item.id}')" style="padding: 0.3rem 0.5rem; font-size:0.8rem;">
                <i class="fa-solid fa-pen"></i>
            </button>
            <button class="tf-btn tf-btn-ghost" title="Postergar" onclick="tf_openModalPostergar('${item.id}')" style="padding: 0.3rem 0.5rem; font-size:0.8rem;">
                <i class="fa-solid fa-calendar-plus"></i>
            </button>
            <button class="tf-btn tf-btn-ghost" title="Excluir" onclick="tf_excluirRegistro('${item.id}')" style="padding: 0.3rem 0.5rem; font-size:0.8rem; color:#dc2626;">
                <i class="fa-solid fa-trash"></i>
            </button>
        `;

        const obs = item.observacao ? item.observacao + (item.motivoAdiamento ? `<br><small style="color:#2563eb;"><b>Adiado:</b> ${item.motivoAdiamento}</small>` : '') : (item.motivoAdiamento ? `<small style="color:#2563eb;"><b>Adiado:</b> ${item.motivoAdiamento}</small>` : '-');

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <strong>${item.re}</strong><br>
                <span style="font-size:0.85rem; color:#64748b;">${item.nome}</span>
            </td>
            <td>
                <span style="font-size:0.85rem;">Início: ${tf_formatDate(item.dataInicial)}</span><br>
                <span style="font-size:0.85rem; font-weight:600;">Fim: ${tf_formatDate(item.dataFinal)}</span>
            </td>
            <td>
                <span class="tf-status ${st.class}">${st.text}</span>
                <br>
                <span style="font-size:0.8rem; color:#64748b;">${st.dias} dias</span>
            </td>
            <td>
                <span style="font-size:0.85rem; color:#64748b;">Atual:</span> ${item.cargoAtual}<br>
                <span style="font-size:0.85rem; color:#64748b;">Promoção:</span> <strong>${item.cargoPromo}</strong>
            </td>
            <td style="font-size:0.85rem; max-width: 200px;">${obs}</td>
            <td style="font-size:0.9rem;">${item.coordenador}</td>
            <td style="display:flex; gap:0.2rem;">${actions}</td>
        `;
        tbody.appendChild(tr);
    });
}

function tf_updateKPIs() {
    let total = TF_DATA.length;
    let criticas = 0;
    let atrasadas = 0;
    let meuTime = 0;

    TF_DATA.forEach(item => {
        const st = tf_calcularStatus(item.dataFinal);
        if (st.class === 'atencao') criticas++;
        if (st.class === 'atrasado') atrasadas++;
        if (item.coordenador === TF_USER) meuTime++;
    });

    document.getElementById('kpi-total').innerText = total;
    document.getElementById('kpi-criticas').innerText = criticas;
    document.getElementById('kpi-atrasadas').innerText = atrasadas;
    document.getElementById('kpi-meu-time').innerText = meuTime;
}

// =============================================
// MODAIS E CRUD
// =============================================
function tf_openModalRegistro() {
    document.getElementById('tf-modal-title').innerHTML = `<i class="fa-solid fa-plus"></i> Registrar Promoção`;
    document.getElementById('tf-id').value = '';
    document.getElementById('tf-re').value = '';
    document.getElementById('tf-nome').value = '';
    document.getElementById('tf-cargo-atual').value = '';
    document.getElementById('tf-cargo-promo').value = '';
    document.getElementById('tf-data-inicial').value = '';
    // Selecionar o coordenador logado por padrão
    document.getElementById('tf-coordenador').value = TF_USER;
    document.getElementById('tf-obs').value = '';
    
    document.getElementById('tf-modal-registro').style.display = 'flex';
}

function tf_closeModalRegistro() {
    document.getElementById('tf-modal-registro').style.display = 'none';
}

function tf_salvarRegistro() {
    const id = document.getElementById('tf-id').value;
    const re = document.getElementById('tf-re').value.trim();
    const nome = document.getElementById('tf-nome').value.trim();
    const cargoAtual = document.getElementById('tf-cargo-atual').value.trim();
    const cargoPromo = document.getElementById('tf-cargo-promo').value.trim();
    const dataInicial = document.getElementById('tf-data-inicial').value;
    const coordenador = document.getElementById('tf-coordenador').value;
    const observacao = document.getElementById('tf-obs').value.trim();

    if (!re || !nome || !cargoAtual || !cargoPromo || !dataInicial || !coordenador) {
        alert("Preencha todos os campos obrigatórios (*).");
        return;
    }

    // Calcular data final (inicial + 90 dias)
    // Cuidado com timezone no JS ao usar new Date(string).
    // Para YYYY-MM-DD, a conversão é utc, então usaremos split e construtor local para não errar dia.
    const [y, m, d] = dataInicial.split('-');
    const initDate = new Date(y, m - 1, d);
    initDate.setDate(initDate.getDate() + 90);
    
    // Format back to YYYY-MM-DD
    const finalY = initDate.getFullYear();
    const finalM = String(initDate.getMonth() + 1).padStart(2, '0');
    const finalD = String(initDate.getDate()).padStart(2, '0');
    const dataFinal = `${finalY}-${finalM}-${finalD}`;

    const dataObj = {
        re, nome, cargoAtual, cargoPromo, dataInicial, dataFinal, coordenador, observacao,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (id) {
        // Para edição, não sobrescrever a data final se houver motivoAdiamento e não queremos perder?
        // Mas se a data inicial mudou, recalcular. Aqui recalcula sempre.
        // Se quisermos manter a postergação, precisaríamos de uma lógica mais robusta. 
        // Para simplicidade, vamos atualizar normal.
        db.collection('troca_funcao').doc(id).update(dataObj)
            .then(() => {
                tf_closeModalRegistro();
            })
            .catch(err => console.error("Erro ao atualizar", err));
    } else {
        db.collection('troca_funcao').add(dataObj)
            .then(() => {
                tf_closeModalRegistro();
            })
            .catch(err => console.error("Erro ao adicionar", err));
    }
}

function tf_editarRegistro(id) {
    const item = TF_DATA.find(d => d.id === id);
    if (!item) return;

    document.getElementById('tf-modal-title').innerHTML = `<i class="fa-solid fa-pen"></i> Editar Promoção`;
    document.getElementById('tf-id').value = item.id;
    document.getElementById('tf-re').value = item.re;
    document.getElementById('tf-nome').value = item.nome;
    document.getElementById('tf-cargo-atual').value = item.cargoAtual;
    document.getElementById('tf-cargo-promo').value = item.cargoPromo;
    document.getElementById('tf-data-inicial').value = item.dataInicial;
    document.getElementById('tf-coordenador').value = item.coordenador;
    document.getElementById('tf-obs').value = item.observacao || '';

    document.getElementById('tf-modal-registro').style.display = 'flex';
}

function tf_excluirRegistro(id) {
    if (confirm("Tem certeza que deseja excluir este processo de promoção?")) {
        db.collection('troca_funcao').doc(id).delete().catch(err => console.error(err));
    }
}

// =============================================
// POSTERGAR PRAZO
// =============================================
function tf_openModalPostergar(id) {
    const item = TF_DATA.find(d => d.id === id);
    if (!item) return;

    document.getElementById('tf-postergar-id').value = id;
    document.getElementById('tf-postergar-info').innerHTML = `Colaborador: ${item.nome} <br> <span style="font-size:0.85rem; color:#64748b;">Prazo atual: ${tf_formatDate(item.dataFinal)}</span>`;
    
    // Sugerir +30 dias a partir do prazo atual
    const [y, m, d] = item.dataFinal.split('-');
    const currentDate = new Date(y, m - 1, d);
    currentDate.setDate(currentDate.getDate() + 30);
    const nY = currentDate.getFullYear();
    const nM = String(currentDate.getMonth() + 1).padStart(2, '0');
    const nD = String(currentDate.getDate()).padStart(2, '0');
    
    document.getElementById('tf-nova-data').value = `${nY}-${nM}-${nD}`;
    document.getElementById('tf-motivo').value = '';

    document.getElementById('tf-modal-postergar').style.display = 'flex';
}

function tf_closeModalPostergar() {
    document.getElementById('tf-modal-postergar').style.display = 'none';
}

function tf_salvarPostergar() {
    const id = document.getElementById('tf-postergar-id').value;
    const novaData = document.getElementById('tf-nova-data').value;
    const motivo = document.getElementById('tf-motivo').value.trim();

    if (!novaData || !motivo) {
        alert("Preencha a nova data e o motivo.");
        return;
    }

    db.collection('troca_funcao').doc(id).update({
        dataFinal: novaData,
        motivoAdiamento: motivo
    }).then(() => {
        tf_closeModalPostergar();
    }).catch(err => console.error(err));
}
