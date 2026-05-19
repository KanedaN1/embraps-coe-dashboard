/**
 * CONTROLE DE EXPERIÊNCIA — exp.js
 * Gerencia a importação de XLSX, prazos e avisos de desligamento.
 */

let expData = [];
let currentFilteredExp = [];
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
                // Limpar chaves para evitar espaços ou acentos problemáticos
                const cleanRow = {};
                Object.keys(row).forEach(k => {
                    const cleanKey = k.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                    cleanRow[cleanKey] = row[k];
                });

                const mapped = {
                    empresa: cleanRow['empresa'] || '',
                    re: cleanRow['re'] || '',
                    nome: cleanRow['funcionario'] || cleanRow['nome'] || '',
                    cargo: cleanRow['cargo'] || '',
                    area: cleanRow['area'] || cleanRow['supervisao'] || '',
                    cliente: cleanRow['cliente'] || '',
                    admissao: formatDate(row['Admissão'] || row['ADMISSÃO'] || cleanRow['admissao']),
                    exp1: formatDate(row['1 EXP'] || row['1ª EXP'] || cleanRow['1 exp'] || cleanRow['exp1']),
                    exp2: formatDate(row['2 EXP'] || row['2ª EXP'] || cleanRow['2 exp'] || cleanRow['exp2']),
                    status: 'PENDENTE',
                    finalizadoEm: null,
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
    const isAdmin = sessionStorage.getItem('admin_logged') === 'true';

    currentFilteredExp = expData.filter(d => {
        const matchArea = !filterArea || d.area === filterArea;
        const matchStatus = !filterStatus || d.status === filterStatus;
        const matchSearch = (d.nome || "").toLowerCase().includes(search) || (d.re || "").toString().includes(search);
        
        let matchAlert = true;
        if (filterAlert === 'vencendo') {
            const exp1 = new Date(d.exp1);
            const exp2 = new Date(d.exp2);
            const diff1 = (exp1 - today) / (1000*60*60*24);
            const diff2 = (exp2 - today) / (1000*60*60*24);
            matchAlert = (diff1 >= 0 && diff1 <= 10) || (diff2 >= 0 && diff2 <= 10);
        } else if (filterAlert === 'vencido') {
            const exp1 = new Date(d.exp1);
            const exp2 = new Date(d.exp2);
            matchAlert = (exp1 < today || exp2 < today) && d.status === 'PENDENTE';
        }

        return matchArea && matchStatus && matchSearch && matchAlert;
    });

    if (currentFilteredExp.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:3rem; color:var(--text-muted);">Nenhum colaborador encontrado.</td></tr>';
        return;
    }

    currentFilteredExp.forEach(d => {
        const exp1 = new Date(d.exp1);
        const diff1 = (exp1 - today) / (1000*60*60*24);
        
        let rowClass = '';
        if (d.status === 'PENDENTE') {
            if (exp1 < today) rowClass = 'row-overdue';
            else if (diff1 <= 10) rowClass = 'row-attention';
        }

        const tr = document.createElement('tr');
        tr.className = rowClass;
        tr.innerHTML = `
            <td style="font-weight:700;">${d.re} - ${d.nome}</td>
            <td>${d.cargo}</td>
            <td style="font-size:0.8rem;">${d.area}</td>
            <td>${d.cliente}</td>
            <td>${formatBRDate(d.admissao)}</td>
            <td><span class="date-badge ${diff1 <= 10 && d.status === 'PENDENTE' ? 'highlight' : ''}">${formatBRDate(d.exp1)}</span></td>
            <td><span class="date-badge">${formatBRDate(d.exp2)}</span></td>
            <td>
                <span class="status-pill status-${d.status.toLowerCase()}">${d.status}</span>
            </td>
            <td>
                ${isAdmin ? `
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

// 4. Mudar Status Manualmente
async function toggleStatus(id, currentStatus) {
    let next = 'PENDENTE';
    if (currentStatus === 'PENDENTE') next = 'SUFICIENTE';
    else if (currentStatus === 'SUFICIENTE') next = 'INSUFICIENTE';
    else if (currentStatus === 'INSUFICIENTE') next = 'PENDENTE';

    try {
        const finalizadoEm = next !== 'PENDENTE' ? new Date().toISOString() : null;
        await dbExp.collection('experiencia').doc(id).update({ 
            status: next,
            finalizadoEm: finalizadoEm
        });
        const idx = expData.findIndex(d => d.id === id);
        expData[idx].status = next;
        expData[idx].finalizadoEm = finalizadoEm;
        renderTable();
        renderSLACharts();
    } catch (err) {
        alert("Erro ao atualizar status");
    }
}

// 5. Enviar E-mail de Desligamento (Template conforme solicitação)
function sendTerminationEmail(id) {
    const emp = expData.find(d => d.id === id);
    if (!emp) return;

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

    // Criar um link invisível para forçar o disparo do mailto
    const mailtoUrl = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const l = document.createElement('a');
    l.href = mailtoUrl;
    l.target = '_blank';
    document.body.appendChild(l);
    l.click();
    document.body.removeChild(l);
}

// 5.1 Tabela de Desempenho (SLA)
function renderSLACharts() {
    const tbodySup = document.getElementById('sup-performance-body');
    if (!tbodySup) return;

    const completed = expData.filter(d => d.status !== 'PENDENTE');
    
    const withinDeadline = completed.filter(d => {
        if (!d.finalizadoEm) return false;
        const done = new Date(d.finalizadoEm);
        const dead = new Date(d.exp1);
        return done <= dead;
    });

    // SLA Geral
    const slaPerc = completed.length > 0 ? Math.round((withinDeadline.length / completed.length) * 100) : 0;
    const slaEl = document.getElementById('sla-perc-value');
    if (slaEl) {
        slaEl.textContent = slaPerc + '%';
        slaEl.style.color = slaPerc >= 90 ? 'var(--exp-ok)' : (slaPerc >= 70 ? 'var(--exp-pending)' : 'var(--exp-fail)');
    }

    // Tabela por Supervisor
    const supMap = {};
    expData.forEach(d => {
        if (!supMap[d.area]) supMap[d.area] = { total: 0, ok: 0, pending: 0 };
        supMap[d.area].total++;
        
        if (d.status === 'PENDENTE') {
            supMap[d.area].pending++;
        } else {
            const done = new Date(d.finalizadoEm);
            const dead = new Date(d.exp1);
            if (done <= dead) supMap[d.area].ok++;
        }
    });

    tbodySup.innerHTML = '';
    const sortedSups = Object.keys(supMap).sort((a,b) => supMap[b].total - supMap[a].total);
    
    sortedSups.forEach(sup => {
        const s = supMap[sup];
        const perc = s.total - s.pending > 0 ? Math.round((s.ok / (s.total - s.pending)) * 100) : 0;
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

// 8. Imprimir Relatório
function exp_print() {
    const printWindow = window.open('', '_blank');
    const today = new Date();
    today.setHours(0,0,0,0);

    const rows = currentFilteredExp.map(d => {
        return `
        <tr>
            <td>${d.re} - ${d.nome}</td>
            <td>${d.cargo}</td>
            <td>${d.area}</td>
            <td>${d.cliente}</td>
            <td>${formatBRDate(d.admissao)}</td>
            <td>${formatBRDate(d.exp1)}</td>
            <td>${formatBRDate(d.exp2)}</td>
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
                        <th>1ª EXP (45d)</th>
                        <th>2ª EXP (90d)</th>
                        <th>Avaliação</th>
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
