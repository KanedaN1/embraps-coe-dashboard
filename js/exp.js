/**
 * CONTROLE DE EXPERIÊNCIA — exp.js
 * Gerencia a importação de XLSX, prazos e avisos de desligamento.
 */

let expData = [];
const dbExp = db; // Usando o db global do firebase-config.js

document.addEventListener('DOMContentLoaded', async () => {
    await loadExpData();
    setupImport();
});

// 1. Carregar Dados do Firebase
async function loadExpData() {
    if (!dbExp) return;

    try {
        const snapshot = await dbExp.collection('experiencia').get();
        expData = [];
        snapshot.forEach(doc => {
            expData.push({ id: doc.id, ...doc.data() });
        });
        
        populateAreaFilter();
        renderTable();
    } catch (err) {
        console.error("Erro ao carregar experiência:", err);
    }
}

// 2. Configurar Importação XLSX
function setupImport() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    dropZone.onclick = () => fileInput.click();

    dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); };
    dropZone.ondragleave = () => dropZone.classList.remove('drag-over');
    dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    };

    fileInput.onchange = (e) => {
        if (e.target.files.length) handleFile(e.target.files[0]);
    };
}

async function handleFile(file) {
    const status = document.getElementById('import-status');
    status.style.display = 'block';
    status.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Lendo arquivo...';

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(sheet);

            if (rows.length === 0) throw new Error("Planilha vazia");

            status.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Salvando ${rows.length} colaboradores...`;

            // Mapear e Salvar no Firebase
            const batch = dbExp.batch();
            rows.forEach(row => {
                // Tenta mapear colunas (case insensitive ou nomes aproximados)
                const mapped = {
                    empresa: row['Empresa'] || row['EMPRESA'] || '',
                    re: row['Re'] || row['RE'] || '',
                    nome: row['Funcionário'] || row['FUNCIONÁRIO'] || row['NOME'] || '',
                    cargo: row['Cargo'] || row['CARGO'] || '',
                    area: row['Área'] || row['ÁREA'] || '',
                    cliente: row['Cliente'] || row['CLIENTE'] || '',
                    admissao: formatDate(row['Admissão'] || row['ADMISSÃO']),
                    exp1: formatDate(row['1 EXP'] || row['1ª EXP'] || row['EXP1']),
                    exp2: formatDate(row['2 EXP'] || row['2ª EXP'] || row['EXP2']),
                    status: 'PENDENTE',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                const ref = dbExp.collection('experiencia').doc();
                batch.set(ref, mapped);
            });

            await batch.commit();
            status.innerHTML = '<i class="fa-solid fa-check"></i> Importação concluída!';
            setTimeout(() => {
                document.getElementById('modal-import').style.display = 'none';
                status.style.display = 'none';
                loadExpData();
            }, 1500);

        } catch (err) {
            console.error(err);
            status.innerHTML = '<i class="fa-solid fa-xmark"></i> Erro ao processar. Verifique as colunas.';
        }
    };
    reader.readAsArrayBuffer(file);
}

// Auxiliar para formatar data do Excel para string YYYY-MM-DD
function formatDate(val) {
    if (!val) return '';
    if (val instanceof Date) return val.toISOString().split('T')[0];
    return val.toString();
}

// 3. Renderizar Tabela
function renderTable() {
    const tbody = document.getElementById('exp-table-body');
    const filterArea = document.getElementById('filter-area').value;
    const filterStatus = document.getElementById('filter-status').value;
    const filterAlert = document.getElementById('filter-alert').value;
    const search = document.getElementById('search-name').value.toLowerCase();

    tbody.innerHTML = '';

    const today = new Date();
    today.setHours(0,0,0,0);

    const filtered = expData.filter(d => {
        const matchArea = !filterArea || d.area === filterArea;
        const matchStatus = !filterStatus || d.status === filterStatus;
        const matchSearch = d.nome.toLowerCase().includes(search) || d.re.toString().includes(search);
        
        let matchAlert = true;
        if (filterAlert === 'vencendo') {
            const exp1 = new Date(d.exp1);
            const exp2 = new Date(d.exp2);
            const diff1 = (exp1 - today) / (1000*60*60*24);
            const diff2 = (exp2 - today) / (1000*60*60*24);
            matchAlert = (diff1 >= 0 && diff1 <= 7) || (diff2 >= 0 && diff2 <= 7);
        } else if (filterAlert === 'vencido') {
            const exp1 = new Date(d.exp1);
            const exp2 = new Date(d.exp2);
            matchAlert = (exp1 < today || exp2 < today) && d.status === 'PENDENTE';
        }

        return matchArea && matchStatus && matchSearch && matchAlert;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:3rem; color:var(--text-muted);">Nenhum colaborador encontrado.</td></tr>';
        return;
    }

    filtered.forEach(d => {
        const exp1 = new Date(d.exp1);
        const exp2 = new Date(d.exp2);
        const diff1 = (exp1 - today) / (1000*60*60*24);
        
        let rowClass = '';
        if (d.status === 'PENDENTE') {
            if (exp1 < today) rowClass = 'row-overdue';
            else if (diff1 <= 7) rowClass = 'row-attention';
        }

        const tr = document.createElement('tr');
        tr.className = rowClass;
        tr.innerHTML = `
            <td style="font-weight:700;">${d.re} - ${d.nome}</td>
            <td>${d.cargo}</td>
            <td style="font-size:0.8rem;">${d.area}</td>
            <td>${d.cliente}</td>
            <td>${formatBRDate(d.admissao)}</td>
            <td><span class="date-badge ${diff1 <= 7 && d.status === 'PENDENTE' ? 'highlight' : ''}">${formatBRDate(d.exp1)}</span></td>
            <td><span class="date-badge">${formatBRDate(d.exp2)}</span></td>
            <td>
                <span class="status-pill status-${d.status.toLowerCase()}">${d.status}</span>
            </td>
            <td>
                <div style="display:flex; gap:5px;">
                    <button class="btn-action btn-status-toggle" onclick="toggleStatus('${d.id}', '${d.status}')" title="Mudar Status">
                        <i class="fa-solid fa-arrows-rotate"></i>
                    </button>
                    ${d.status === 'INSUFICIENTE' ? `
                        <button class="btn-action btn-email" onclick="sendTerminationEmail('${d.id}')" title="Solicitar Desligamento">
                            <i class="fa-solid fa-envelope"></i>
                        </button>
                    ` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function formatBRDate(isoDate) {
    if (!isoDate) return '-';
    const [y, m, d] = isoDate.split('-');
    return `${d}/${m}/${y}`;
}

// 4. Mudar Status Manualmente
async function toggleStatus(id, currentStatus) {
    let next = 'PENDENTE';
    if (currentStatus === 'PENDENTE') next = 'SUFICIENTE';
    else if (currentStatus === 'SUFICIENTE') next = 'INSUFICIENTE';
    else if (currentStatus === 'INSUFICIENTE') next = 'PENDENTE';

    try {
        await dbExp.collection('experiencia').doc(id).update({ status: next });
        const idx = expData.findIndex(d => d.id === id);
        expData[idx].status = next;
        renderTable();
    } catch (err) {
        alert("Erro ao atualizar status");
    }
}

// 5. Enviar E-mail de Desligamento (Template conforme solicitação)
function sendTerminationEmail(id) {
    const emp = expData.find(d => d.id === id);
    if (!emp) return;

    // Destinatários baseados no print
    const to = "adm.dop.embraps@gmail.com";
    const subject = `TÉRMINO DE CONTRATO DE EXPERIÊNCIA: ${emp.nome.toUpperCase()} RE: ${emp.re}`;
    
    const body = `Bom dia,\n\n` +
                 `Por gentileza, solicito o envio do telegrama para a colaboradora, a mesma se encontra na falta.\n\n` +
                 `RE: ${emp.re}\n` +
                 `NOME: ${emp.nome.toUpperCase()}\n` +
                 `PCD: NÃO\n` +
                 `POSTO: ${emp.cliente}\n` +
                 `CARGO: ${emp.cargo}\n` +
                 `TÉRMINO DE 1° CONTRATO DE EXPERIÊNCIA: ${formatBRDate(emp.exp1)}\n\n` +
                 `Att,\nNikolas Cardoso`;

    const mailtoUrl = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
}

// 6. Filtros e Busca
function populateAreaFilter() {
    const select = document.getElementById('filter-area');
    const areas = [...new Set(expData.map(d => d.area))].sort();
    
    // Guardar valor selecionado
    const current = select.value;
    select.innerHTML = '<option value="">Todos</option>';
    areas.forEach(a => {
        if (a) select.innerHTML += `<option value="${a}">${a}</option>`;
    });
    select.value = current;
}

// 7. Limpar Tudo (Arquivar)
async function clearAllData() {
    if (!confirm("Isso excluirá TODOS os registros do mês atual. Você já baixou o relatório final?")) return;

    try {
        const snapshot = await dbExp.collection('experiencia').get();
        const batch = dbExp.batch();
        snapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        
        expData = [];
        renderTable();
        alert("Sistema limpo com sucesso!");
    } catch (err) {
        alert("Erro ao limpar dados.");
    }
}
