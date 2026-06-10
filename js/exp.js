/**
 * CONTROLE DE EXPERIÊNCIA — exp.js
 * Novo modelo: campo único 'exp' (data) + 'numExp' (1 ou 2)
 * Retrocompatível com registros antigos que usam exp1/exp2.
 */

let expData = [];
let currentFilteredExp = [];
const dbExp = db; // Usando o db global do firebase-config.js

// ─── Ordenação da Tabela ───────────────────────────────────────────────────
let sortColumn = 'exp'; // Coluna padrão de ordenação: data de vencimento da EXP
let sortAsc = true;

document.addEventListener('DOMContentLoaded', async () => {
    const filterMonth = document.getElementById('filter-month');
    if (filterMonth) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        filterMonth.value = `${yyyy}-${mm}`;
    }
    await loadExpData();
    setupImport();
});

function toggleSort(column) {
    if (sortColumn === column) {
        sortAsc = !sortAsc;
    } else {
        sortColumn = column;
        sortAsc = true;
    }
    renderTable();
}

function updateSortIcons() {
    const columns = ['nome', 'cargo', 'area', 'cliente', 'admissao', 'exp', 'numExp', 'status'];
    columns.forEach(col => {
        const iconEl = document.getElementById(`sort-icon-${col}`);
        if (!iconEl) return;
        
        // Reset classes
        iconEl.className = 'sort-icon fa-solid';
        
        const parentTh = iconEl.parentElement;
        if (parentTh) {
            parentTh.classList.remove('active-sort');
        }

        if (col === sortColumn) {
            parentTh.classList.add('active-sort');
            if (sortAsc) {
                iconEl.classList.add('fa-sort-up');
            } else {
                iconEl.classList.add('fa-sort-down');
            }
        } else {
            iconEl.classList.add('fa-sort');
        }
    });
}

// ─── Helpers de compatibilidade ────────────────────────────────────────────
// Retorna a data de experiência do registro, seja novo modelo (exp) ou antigo (exp1)
function getExpDate(d) {
    return d.exp || d.exp1 || '';
}

// Retorna o número da experiência do registro, seja novo modelo (numExp) ou antigo (deduzido de exp2)
function getNumExp(d) {
    if (d.numExp) return String(d.numExp);
    // Retrocompatibilidade: se tinha exp2, considera que exp1 = 1ª experiência
    if (d.exp1 && !d.exp2) return '1';
    if (d.exp1 && d.exp2) return '1'; // linha era exp1; exp2 era outra linha
    return '';
}

// ─── 1. Carregar Dados do Firebase ─────────────────────────────────────────
async function loadExpData() {
    if (!dbExp) return;

    try {
        const snapshot = await dbExp.collection('experiencia').get();
        expData = [];
        snapshot.forEach(doc => {
            expData.push({ id: doc.id, ...doc.data() });
        });

        checkAdminAccess();
        populateAreaFilter();
        renderTable();
        renderSLACharts();
    } catch (err) {
        console.error("Erro ao carregar experiência:", err);
    }
}

// 1.1 Verificar Acesso Admin
function checkAdminAccess() {
    const isAdmin = sessionStorage.getItem('admin_logged') === 'true';
    const adminElements = document.querySelectorAll('.admin-only');
    adminElements.forEach(el => el.style.display = isAdmin ? 'flex' : 'none');
}

// ─── 2. Configurar Importação XLSX ─────────────────────────────────────────
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

            status.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Salvando ${rows.length} registros...`;

            const mesRef = document.getElementById('filter-month')?.value;
            if (!mesRef) throw new Error("Selecione um mês de referência no filtro superior antes de importar.");

            // ── Mapear e Salvar no Firebase ──
            const batch = dbExp.batch();
            rows.forEach(row => {
                // Normalizar chaves: sem acento, minúsculo, sem espaços extras
                const cleanRow = {};
                Object.keys(row).forEach(k => {
                    const cleanKey = k.trim()
                        .normalize("NFD")
                        .replace(/[\u0300-\u036f]/g, "")
                        .toLowerCase()
                        .replace(/[°º]/g, ''); // remove símbolo de grau (1°/2° → 1/2)
                    cleanRow[cleanKey] = row[k];
                });

                // ── Novo modelo: coluna EXP (data) + coluna 1/2 (número) ──
                // Aceita variações de nome de coluna: "exp", "data exp", "data de exp"
                // Aceita variações do número: "1/2", "num", "numero exp", "n exp"
                const expDate = formatDate(
                    row['EXP'] || row['exp'] || row['Data EXP'] || row['DATA EXP'] ||
                    cleanRow['exp'] || cleanRow['data exp'] || cleanRow['data de exp'] ||
                    // retrocompatibilidade com colunas antigas
                    row['1 EXP'] || row['1ª EXP'] || cleanRow['1 exp'] || cleanRow['exp1']
                );

                const numExpRaw = (
                    row['1/2'] || row['1°/2°'] || row['1º/2º'] ||
                    cleanRow['1/2'] || cleanRow['num'] || cleanRow['numero exp'] ||
                    cleanRow['n exp'] || cleanRow['numexp'] ||
                    // retrocompatibilidade: se não há coluna de número, usa '1' por padrão
                    ''
                );
                // Normaliza para string '1' ou '2'
                const numExp = String(numExpRaw).trim() === '2' ? '2' : '1';

                const mapped = {
                    empresa:       cleanRow['empresa'] || '',
                    re:            cleanRow['re'] || '',
                    nome:          cleanRow['funcionario'] || cleanRow['nome'] || '',
                    cargo:         cleanRow['cargo'] || '',
                    area:          cleanRow['area'] || cleanRow['supervisao'] || '',
                    cliente:       cleanRow['cliente'] || '',
                    admissao:      formatDate(row['Admissão'] || row['ADMISSÃO'] || cleanRow['admissao']),
                    exp:           expDate,      // ← campo único de data
                    numExp:        numExp,        // ← '1' ou '2'
                    mesReferencia: mesRef,
                    status:        'PENDENTE',
                    finalizadoEm:  null,
                    updatedAt:     firebase.firestore.FieldValue.serverTimestamp()
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

// Auxiliar: formatar data do Excel para string YYYY-MM-DD
function formatDate(val) {
    if (!val) return '';
    if (val instanceof Date) return val.toISOString().split('T')[0];
    return val.toString();
}

// ─── 3. Renderizar Tabela ───────────────────────────────────────────────────
function renderTable() {
    const tbody = document.getElementById('exp-table-body');
    const filterMonth  = document.getElementById('filter-month').value;
    const filterArea   = document.getElementById('filter-area').value;
    const filterStatus = document.getElementById('filter-status').value;
    const filterAlert  = document.getElementById('filter-alert').value;
    const search       = document.getElementById('search-name').value.toLowerCase();

    tbody.innerHTML = '';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isAdmin = sessionStorage.getItem('admin_logged') === 'true';

    currentFilteredExp = expData.filter(d => {
        const matchMonth  = !filterMonth  || d.mesReferencia === filterMonth;
        const matchArea   = !filterArea   || d.area === filterArea;
        const matchStatus = !filterStatus || d.status === filterStatus;
        const matchSearch = (d.nome || "").toLowerCase().includes(search)
                         || (d.re  || "").toString().includes(search);

        let matchAlert = true;
        if (filterAlert === 'vencendo') {
            const expDate = new Date(getExpDate(d));
            const diff    = (expDate - today) / (1000 * 60 * 60 * 24);
            matchAlert = diff >= 0 && diff <= 10;
        } else if (filterAlert === 'vencido') {
            const expDate = new Date(getExpDate(d));
            matchAlert = expDate < today && d.status === 'PENDENTE';
        }

        return matchMonth && matchArea && matchStatus && matchSearch && matchAlert;
    });

    // Ordenação dos dados filtrados
    currentFilteredExp.sort((a, b) => {
        let valA = '';
        let valB = '';

        if (sortColumn === 'exp') {
            valA = getExpDate(a);
            valB = getExpDate(b);
        } else if (sortColumn === 'numExp') {
            valA = getNumExp(a);
            valB = getNumExp(b);
        } else if (sortColumn === 'admissao') {
            valA = a.admissao || '';
            valB = b.admissao || '';
        } else if (sortColumn === 'nome') {
            valA = (a.nome || '').toLowerCase();
            valB = (b.nome || '').toLowerCase();
        } else {
            valA = (a[sortColumn] || '').toString().toLowerCase();
            valB = (b[sortColumn] || '').toString().toLowerCase();
        }

        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
    });

    updateSortIcons();

    if (currentFilteredExp.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:3rem; color:var(--text-muted);">Nenhum colaborador encontrado.</td></tr>';
        return;
    }

    currentFilteredExp.forEach(d => {
        const expDateStr = getExpDate(d);
        const expDate    = new Date(expDateStr);
        const diff       = (expDate - today) / (1000 * 60 * 60 * 24);
        const numExp     = getNumExp(d);

        let rowClass = '';
        if (d.status === 'INSUFICIENTE') {
            rowClass = 'row-overdue';
        } else if (d.status === 'CONGELADO') {
            rowClass = 'row-frozen';
        }

        // Badge do número de experiência (1° = azul, 2° = roxo)
        const numColor  = numExp === '2' ? '#7c3aed' : '#1e3a8a';
        const numBg     = numExp === '2' ? '#ede9fe'  : '#dbeafe';
        const numLabel  = numExp === '2' ? '2°' : '1°';

        const tr = document.createElement('tr');
        tr.className = rowClass;
        tr.innerHTML = `
            <td data-label="Funcionário" style="font-weight:700;">${d.re} - ${d.nome}</td>
            <td data-label="Cargo">${d.cargo}</td>
            <td data-label="Área" style="font-size:0.8rem;">${d.area}</td>
            <td data-label="Cliente">${d.cliente}</td>
            <td data-label="Admissão">${formatBRDate(d.admissao)}</td>
            <td data-label="EXP">
                <span class="date-badge ${diff <= 10 && d.status === 'PENDENTE' ? 'highlight' : ''}">
                    ${formatBRDate(expDateStr)}
                </span>
            </td>
            <td data-label="1°/2°">
                <span style="
                    display:inline-block;
                    padding:3px 10px;
                    border-radius:20px;
                    font-size:0.8rem;
                    font-weight:800;
                    background:${numBg};
                    color:${numColor};
                    letter-spacing:0.03em;
                ">${numLabel}</span>
            </td>
            <td data-label="Avaliação">
                <span class="status-pill status-${d.status.toLowerCase()}">${d.status}</span>
            </td>
            <td data-label="Ações">
                ${isAdmin ? `
                    <div style="display:flex; gap:5px;">
                        <button class="btn-action btn-status-toggle" onclick="toggleStatus('${d.id}', '${d.status}')" title="Mudar Status">
                            <i class="fa-solid fa-arrows-rotate"></i>
                        </button>
                        <button class="btn-action btn-freeze ${d.status === 'CONGELADO' ? 'active' : ''}" onclick="toggleFreeze('${d.id}', '${d.status}')" title="${d.status === 'CONGELADO' ? 'Descongelar Contrato' : 'Congelar Contrato'}">
                            <i class="fa-solid fa-snowflake"></i>
                        </button>
                        ${d.status === 'INSUFICIENTE' ? `
                            <button class="btn-action btn-email" onclick="sendTerminationEmail('${d.id}')" title="Solicitar Desligamento">
                                <i class="fa-solid fa-envelope"></i>
                            </button>
                        ` : ''}
                    </div>
                ` : '<span style="color:#cbd5e1; font-size:0.75rem;">Sem permissão</span>'}
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

// ─── 4. Mudar Status Manualmente ───────────────────────────────────────────
async function toggleStatus(id, currentStatus) {
    let next = 'PENDENTE';
    if (currentStatus === 'PENDENTE')          next = 'SUFICIENTE';
    else if (currentStatus === 'SUFICIENTE')    next = 'INSUFICIENTE';
    else if (currentStatus === 'INSUFICIENTE')  next = 'PENDENTE';
    else if (currentStatus === 'CONGELADO')     next = 'PENDENTE';

    try {
        const finalizadoEm = next !== 'PENDENTE' ? new Date().toISOString() : null;
        await dbExp.collection('experiencia').doc(id).update({
            status: next,
            finalizadoEm: finalizadoEm
        });
        const idx = expData.findIndex(d => d.id === id);
        expData[idx].status      = next;
        expData[idx].finalizadoEm = finalizadoEm;
        renderTable();
        renderSLACharts();
    } catch (err) {
        alert("Erro ao atualizar status");
    }
}

// ─── 4.1 Congelar/Descongelar Contrato Manualmente ─────────────────────────
async function toggleFreeze(id, currentStatus) {
    const next = currentStatus === 'CONGELADO' ? 'PENDENTE' : 'CONGELADO';
    try {
        const finalizadoEm = next !== 'PENDENTE' ? new Date().toISOString() : null;
        await dbExp.collection('experiencia').doc(id).update({
            status: next,
            finalizadoEm: finalizadoEm
        });
        const idx = expData.findIndex(d => d.id === id);
        expData[idx].status      = next;
        expData[idx].finalizadoEm = finalizadoEm;
        renderTable();
        renderSLACharts();
    } catch (err) {
        alert("Erro ao alterar o congelamento do contrato");
    }
}

// ─── 5. Enviar E-mail de Desligamento ──────────────────────────────────────
function sendTerminationEmail(id) {
    const emp = expData.find(d => d.id === id);
    if (!emp) return;

    const expDateStr = getExpDate(emp);
    const numExp     = getNumExp(emp);

    const to      = "adm.dop.embraps@gmail.com";
    const subject = `TÉRMINO DE CONTRATO DE EXPERIÊNCIA: ${emp.nome.toUpperCase()} RE: ${emp.re}`;

    const body = `Bom dia,<br><br>` +
                 `Por gentileza, solicito o envio do telegrama para a colaboradora, a mesma se encontra na falta.<br><br>` +
                 `RE: ${emp.re}<br>` +
                 `NOME: ${emp.nome.toUpperCase()}<br>` +
                 `PCD: NÃO<br>` +
                 `POSTO: ${emp.cliente}<br>` +
                 `CARGO: ${emp.cargo}<br>` +
                 `TÉRMINO DE ${numExp}° CONTRATO DE EXPERIÊNCIA: ${formatBRDate(expDateStr)}<br><br>` +
                 `Att,<br>Nikolas Cardoso`;

    enviarEmail(to, subject, body).then(success => {
        if (success) alert("E-mail de desligamento enviado com sucesso!");
        else alert("Falha ao enviar e-mail. Verifique o console ou a configuração do EmailJS.");
    });
}

// ─── 5.1 Tabela de Desempenho (SLA) ────────────────────────────────────────
function renderSLACharts() {
    const tbodySup = document.getElementById('sup-performance-body');
    if (!tbodySup) return;

    const completed = expData.filter(d => d.status !== 'PENDENTE' && d.status !== 'CONGELADO');

    const withinDeadline = completed.filter(d => {
        if (!d.finalizadoEm) return false;
        const done = new Date(d.finalizadoEm);
        const dead = new Date(getExpDate(d));
        return done <= dead;
    });

    // SLA Geral
    const slaPerc = completed.length > 0
        ? Math.round((withinDeadline.length / completed.length) * 100)
        : 0;
    const slaEl = document.getElementById('sla-perc-value');
    if (slaEl) {
        slaEl.textContent = slaPerc + '%';
        slaEl.style.color = slaPerc >= 90
            ? 'var(--exp-ok)'
            : (slaPerc >= 70 ? 'var(--exp-pending)' : 'var(--exp-fail)');
    }

    // Tabela por Supervisor
    const supMap = {};
    expData.forEach(d => {
        if (!supMap[d.area]) supMap[d.area] = { total: 0, ok: 0, pending: 0 };
        supMap[d.area].total++;

        if (d.status === 'PENDENTE' || d.status === 'CONGELADO') {
            supMap[d.area].pending++;
        } else {
            const done = new Date(d.finalizadoEm);
            const dead = new Date(getExpDate(d));
            if (done <= dead) supMap[d.area].ok++;
        }
    });

    tbodySup.innerHTML = '';
    const sortedSups = Object.keys(supMap).sort((a, b) => supMap[b].total - supMap[a].total);

    sortedSups.forEach(sup => {
        const s    = supMap[sup];
        const perc = s.total - s.pending > 0
            ? Math.round((s.ok / (s.total - s.pending)) * 100)
            : 0;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-weight:600;">${sup || 'Não Definido'}</td>
            <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; text-align:center;">${s.total}</td>
            <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; text-align:center; color: var(--exp-ok); font-weight:700;">${s.ok}</td>
            <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; text-align:center; color: ${s.pending > 0 ? 'var(--exp-fail)' : 'var(--text-muted)'}; font-weight:700;">${s.pending}</td>
            <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; text-align:center; font-weight:800; color: ${perc >= 90 ? 'var(--exp-ok)' : 'var(--exp-pending)'}">${perc}%</td>
        `;
        tbodySup.appendChild(tr);
    });
}

// ─── 6. Filtros e Busca ─────────────────────────────────────────────────────
function populateAreaFilter() {
    const select = document.getElementById('filter-area');
    const areas  = [...new Set(expData.map(d => d.area))].sort();

    const current = select.value;
    select.innerHTML = '<option value="">Todos</option>';
    areas.forEach(a => {
        if (a) select.innerHTML += `<option value="${a}">${a}</option>`;
    });
    select.value = current;
}

// ─── 7. Limpar Tudo (Arquivar) ──────────────────────────────────────────────
async function clearAllData() {
    if (!confirm("Isso excluirá TODOS os registros do mês atual. Você já baixou o relatório final?")) return;

    try {
        const snapshot = await dbExp.collection('experiencia').get();
        const batch    = dbExp.batch();
        snapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        expData = [];
        renderTable();
        alert("Sistema limpo com sucesso!");
    } catch (err) {
        alert("Erro ao limpar dados.");
    }
}

// ─── 8. Imprimir Relatório ──────────────────────────────────────────────────
function exp_print() {
    const printWindow = window.open('', '_blank');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rows = currentFilteredExp.map(d => {
        const numExp = getNumExp(d);
        return `
        <tr>
            <td>${d.re} - ${d.nome}</td>
            <td>${d.cargo}</td>
            <td>${d.area}</td>
            <td>${d.cliente}</td>
            <td>${formatBRDate(d.admissao)}</td>
            <td>${formatBRDate(getExpDate(d))}</td>
            <td style="text-align:center; font-weight:700;">${numExp}°</td>
            <td>${d.status}</td>
        </tr>
        `;
    }).join('');

    printWindow.document.write(`
        <html>
        <head>
            <title>Controle de Experiência - Impressão</title>
            <style>
                body { font-family: sans-serif; padding: 20px; color: #333; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 12px; }
                th { background: #f4f4f4; }
                h1 { color: #1e3a8a; font-size: 18px; margin-bottom: 5px; }
                .footer { margin-top: 30px; font-size: 10px; color: #999; text-align: center; }
            </style>
        </head>
        <body>
            <h1>Controle de Experiência - ${new Date().toLocaleDateString('pt-BR')}</h1>
            <p style="color: #666; font-size: 12px; margin-top: 0;">Colaboradores exibidos: ${currentFilteredExp.length}</p>
            <table>
                <thead>
                    <tr>
                        <th>Funcionário</th>
                        <th>Cargo</th>
                        <th>Supervisor / Área</th>
                        <th>Cliente</th>
                        <th>Admissão</th>
                        <th>EXP</th>
                        <th>1°/2°</th>
                        <th>Avaliação</th>
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
