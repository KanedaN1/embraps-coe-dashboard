document.addEventListener('DOMContentLoaded', () => {

    const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');

    document.getElementById('data-year').value = "2026";
    document.getElementById('data-month').value = currentMonth;

    if (sessionStorage.getItem('admin_logged') === 'true') {
        showAdminPanel();
    }

    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const user = document.getElementById('username').value;
        const pass = document.getElementById('password').value;

        if (user === 'admin' && pass === 'admin') {
            sessionStorage.setItem('admin_logged', 'true');
            showAdminPanel();
        } else {
            document.getElementById('login-error').style.display = 'block';
        }
    });

    document.getElementById('btn-logout').addEventListener('click', () => {
        sessionStorage.removeItem('admin_logged');
        location.reload();
    });

    document.getElementById('btn-load').addEventListener('click', loadMonthData);
    document.getElementById('data-form').addEventListener('submit', saveMonthData);
    document.getElementById('btn-delete').addEventListener('click', deleteMonthData);
});

function showAdminPanel() {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'flex';
}

const formFields = [
    'faltas', 'demissoes', 'punicoes', 'divergenciaFuncao', 'divergenciasResolvidas', 'pendenciasPonto',
    'gastosFolgas', 'valeTransporte', 'custo99',
    'horasExtrasGeral', 'horasExtrasIntra', 'horasExtras100',
    'visitasContele', 'reservasDiurna', 'reservasNoturna', 'reservasLimpeza'
];

let stateSupervisores99 = [];
let stateSupervisoresContele = [];

function loadMonthData() {
    const year = document.getElementById('data-year').value;
    const month = document.getElementById('data-month').value;

    const data = getDataByMonth(year, month);

    const form = document.getElementById('data-form');
    form.style.display = 'block';

    if (data) {
        formFields.forEach(field => {
            const el = document.getElementById(field);
            if (el) el.value = data[field] || 0;
        });

        stateSupervisores99 = data.supervisores99 ? [...data.supervisores99] : [];
        stateSupervisoresContele = data.supervisoresContele ? [...data.supervisoresContele] : [];

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

        renderDailyGrid('faltas-diarias', data.faltasDiarias || {});
        renderDemissoesGridTabela(data.demissoesMotivosDiarios || {});

        showAdminAlert(`Dados carregados: ${month}/${year}`, 'success');
    } else {
        formFields.forEach(field => {
            const el = document.getElementById(field);
            if (el) el.value = 0;
        });

        stateSupervisores99 = [];
        stateSupervisoresContele = [];

        renderDemissoesGridTabela({});
        const resIds = ['res_limp_diurno', 'res_limp_vesp', 'res_limp_5x2', 'res_limp_12x36', 'res_limp_coringa', 'res_portdia_par', 'res_portdia_impar', 'res_portdia_manu', 'res_portdia_zel', 'res_portdia_coringa', 'res_portnoite_par', 'res_portnoite_impar', 'res_portnoite_limp', 'res_portnoite_coringa'];
        resIds.forEach(id => {
            const a = document.getElementById(id + '_atual');
            const i = document.getElementById(id + '_ideal');
            if (a) a.value = 0;
            if (i) i.value = 0;
        });

        renderDailyGrid('faltas-diarias', {});
        renderDemissoesGridTabela({});

        showAdminAlert(`Nenhum dado encontrado para ${month}/${year}. Preencha para criar.`, 'warning');
    }

    renderSupervisores99();
    renderSupervisoresContele();
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
    document.querySelectorAll('.input-faltas-diarias').forEach(input => {
        totalFaltas += parseInt(input.value) || 0;
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

function saveMonthData(e) {
    e.preventDefault();
    const year = document.getElementById('data-year').value;
    const month = document.getElementById('data-month').value;

    const existingData = getDataByMonth(year, month) || {};
    const payload = { ...existingData };

    formFields.forEach(field => {
        const el = document.getElementById(field);
        if (el) {
            payload[field] = el.step ? parseFloat(el.value) || 0 : parseInt(el.value, 10) || 0;
        }
    });

    const faltasDiarias = {};
    document.querySelectorAll('.input-faltas-diarias').forEach(input => {
        faltasDiarias[input.dataset.day] = parseInt(input.value) || 0;
    });
    payload.faltasDiarias = faltasDiarias;

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

    saveData(year, month, payload);
    showAdminAlert(`Dados de ${month}/${year} salvos com sucesso! A Dashboard foi atualizada.`, 'success');

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteMonthData() {
    const year = document.getElementById('data-year').value;
    const month = document.getElementById('data-month').value;

    if (confirm(`Tem certeza que deseja excluir TODOS os dados de ${month}/${year}?`)) {
        if (deleteData(year, month)) {
            showAdminAlert(`Dados de ${month}/${year} foram excluídos.`, 'success');
            document.getElementById('data-form').style.display = 'none';
        } else {
            showAdminAlert(`Não havia dados salvos para ${month}/${year}.`, 'warning');
        }
    }
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
