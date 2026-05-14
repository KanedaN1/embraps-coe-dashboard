// Inicializa Firestore
const db = firebase.firestore();

let ordensServico = [];

document.addEventListener('DOMContentLoaded', () => {
    carregarOS();

    // Mobile menu toggle
    const btnMenu = document.getElementById('btn-menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (btnMenu && sidebar && overlay) {
        btnMenu.addEventListener('click', () => {
            sidebar.classList.add('active');
            overlay.classList.add('active');
        });

        overlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        });
    }
});

// Verifica Status com base na Data de Vencimento
function calcularStatus(dataVencimentoStr) {
    if (!dataVencimentoStr) return { classe: 'badge-prazo', texto: 'No Prazo' };

    // Converter YYYY-MM-DD para objeto Date (considerando fuso local)
    const [ano, mes, dia] = dataVencimentoStr.split('-');
    const dataVencimento = new Date(ano, mes - 1, dia);
    
    // Hoje zerado para não interferir nas horas
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const diffTime = dataVencimento - hoje;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 3) {
        return { classe: 'badge-alerta', texto: 'Alerta' };
    } else if (diffDays <= 7) {
        return { classe: 'badge-vencer', texto: 'A Vencer' };
    } else {
        return { classe: 'badge-prazo', texto: 'No Prazo' };
    }
}

async function carregarOS() {
    const tbody = document.getElementById('tbody-os');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Carregando...</td></tr>';
    
    try {
        const snapshot = await db.collection('ordens_servico').orderBy('dataVencimento', 'asc').get();
        ordensServico = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        atualizarKPIs();
        renderizarTabela();
    } catch (error) {
        console.error("Erro ao carregar OS: ", error);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: var(--danger);">Erro ao carregar dados. Verifique a conexão.</td></tr>';
    }
}

function renderizarTabela(lista = ordensServico) {
    const tbody = document.getElementById('tbody-os');
    tbody.innerHTML = '';

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: var(--text-muted);">Nenhuma Ordem de Serviço encontrada.</td></tr>';
        return;
    }

    lista.forEach(os => {
        const status = calcularStatus(os.dataVencimento);
        const tr = document.createElement('tr');
        
        // Formatar data para DD/MM/YYYY
        let dataFormatada = os.dataVencimento;
        if (os.dataVencimento) {
            const [ano, mes, dia] = os.dataVencimento.split('-');
            dataFormatada = `${dia}/${mes}/${ano}`;
        }

        tr.innerHTML = `
            <td><span class="badge-status ${status.classe}">${status.texto}</span></td>
            <td>${dataFormatada}</td>
            <td><strong>${os.numero}</strong></td>
            <td>${os.motivo}</td>
            <td>${os.cliente}</td>
            <td>${os.funcao}</td>
            <td style="text-align: center;">
                <button class="action-btn" title="Abrir PDF no Drive" onclick="window.open('${os.link}', '_blank')"><i class="fa-solid fa-link"></i></button>
                <button class="action-btn whatsapp" title="Avisar Supervisor" onclick="notificarWhatsApp('${os.id}')"><i class="fa-brands fa-whatsapp"></i></button>
                <button class="action-btn edit" title="Editar" onclick="abrirModalEditarOS('${os.id}')"><i class="fa-solid fa-pen"></i></button>
                <button class="action-btn delete" title="Excluir" onclick="excluirOS('${os.id}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filtrarTabelaOS() {
    const termo = document.getElementById('filtro-os').value.toLowerCase();
    const listaFiltrada = ordensServico.filter(os => 
        os.cliente.toLowerCase().includes(termo) || 
        os.numero.toLowerCase().includes(termo) ||
        os.motivo.toLowerCase().includes(termo)
    );
    renderizarTabela(listaFiltrada);
}

function atualizarKPIs() {
    let alerta = 0;
    let vencer = 0;
    let prazo = 0;

    ordensServico.forEach(os => {
        const status = calcularStatus(os.dataVencimento);
        if (status.texto === 'Alerta') alerta++;
        else if (status.texto === 'A Vencer') vencer++;
        else prazo++;
    });

    document.getElementById('kpi-alerta').innerText = alerta;
    document.getElementById('kpi-vencer').innerText = vencer;
    document.getElementById('kpi-prazo').innerText = prazo;
    document.getElementById('kpi-total').innerText = ordensServico.length;
}

// === MODAL ===
function abrirModalNovaOS() {
    document.getElementById('os-id').value = '';
    document.getElementById('os-data-venc').value = '';
    document.getElementById('os-numero').value = '';
    document.getElementById('os-motivo').value = '';
    document.getElementById('os-cliente').value = '';
    document.getElementById('os-funcao').value = '';
    document.getElementById('os-link').value = '';
    
    document.getElementById('modal-os-title').innerHTML = '<i class="fa-solid fa-plus"></i> Nova Ordem de Serviço';
    document.getElementById('modal-os').style.display = 'flex';
}

function abrirModalEditarOS(id) {
    const os = ordensServico.find(o => o.id === id);
    if (!os) return;

    document.getElementById('os-id').value = os.id;
    document.getElementById('os-data-venc').value = os.dataVencimento;
    document.getElementById('os-numero').value = os.numero;
    document.getElementById('os-motivo').value = os.motivo;
    document.getElementById('os-cliente').value = os.cliente;
    document.getElementById('os-funcao').value = os.funcao;
    document.getElementById('os-link').value = os.link;

    document.getElementById('modal-os-title').innerHTML = '<i class="fa-solid fa-pen"></i> Editar Ordem de Serviço';
    document.getElementById('modal-os').style.display = 'flex';
}

function fecharModalOS() {
    document.getElementById('modal-os').style.display = 'none';
}

async function salvarOS() {
    const id = document.getElementById('os-id').value;
    const dataVencimento = document.getElementById('os-data-venc').value;
    const numero = document.getElementById('os-numero').value;
    const motivo = document.getElementById('os-motivo').value.toUpperCase();
    const cliente = document.getElementById('os-cliente').value.toUpperCase();
    const funcao = document.getElementById('os-funcao').value.toUpperCase();
    const link = document.getElementById('os-link').value;

    if (!dataVencimento || !numero || !motivo || !cliente || !funcao || !link) {
        alert("Preencha todos os campos obrigatórios.");
        return;
    }

    const osData = {
        dataVencimento, numero, motivo, cliente, funcao, link,
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        if (id) {
            // Atualizar
            await db.collection('ordens_servico').doc(id).update(osData);
        } else {
            // Criar novo
            await db.collection('ordens_servico').add(osData);
        }
        fecharModalOS();
        carregarOS();
    } catch (error) {
        console.error("Erro ao salvar OS:", error);
        alert("Erro ao salvar a Ordem de Serviço.");
    }
}

async function excluirOS(id) {
    if (confirm("Tem certeza que deseja excluir esta Ordem de Serviço?")) {
        try {
            await db.collection('ordens_servico').doc(id).delete();
            carregarOS();
        } catch (error) {
            console.error("Erro ao excluir OS:", error);
            alert("Erro ao excluir a Ordem de Serviço.");
        }
    }
}

// === WHATSAPP NOTIFICATION ===
function notificarWhatsApp(id) {
    const os = ordensServico.find(o => o.id === id);
    if (!os) return;

    // Formatar data
    let dataFormatada = os.dataVencimento;
    if (os.dataVencimento) {
        const [ano, mes, dia] = os.dataVencimento.split('-');
        dataFormatada = `${dia}/${mes}/${ano}`;
    }

    const mensagem = `Olá! Temos uma Nova Ordem de Serviço (OS: ${os.numero})\n\n` +
                     `*Cliente:* ${os.cliente}\n` +
                     `*Motivo:* ${os.motivo}\n` +
                     `*Função:* ${os.funcao}\n` +
                     `*Vencimento:* ${dataFormatada}\n\n` +
                     `*Link do Documento (Drive):*\n${os.link}`;

    const urlWhatsApp = `https://api.whatsapp.com/send?text=${encodeURIComponent(mensagem)}`;
    window.open(urlWhatsApp, '_blank');
}

// === INTEGRAÇÃO EMAIL.JS ===
/*
    Esta função foi solicitada pelo usuário para ser adicionada no "aviso de email.js"
    que informa o resumo semanal.
    Ela busca as OS com vencimento nos próximos 7 dias (ou atrasadas).
*/
async function gerarResumoSemanalOS() {
    let resumoHtml = "<h3>Ordens de Serviço a Realizar / Vencer (Próximos 7 Dias)</h3>";
    
    try {
        const snapshot = await db.collection('ordens_servico').orderBy('dataVencimento', 'asc').get();
        let possuiOS = false;
        resumoHtml += "<ul>";

        snapshot.docs.forEach(doc => {
            const os = doc.data();
            const status = calcularStatus(os.dataVencimento);
            
            // Só inclui se for "Alerta" ou "A Vencer" (<= 7 dias)
            if (status.texto === 'Alerta' || status.texto === 'A Vencer') {
                possuiOS = true;
                
                let dataFormatada = os.dataVencimento;
                if (os.dataVencimento) {
                    const [ano, mes, dia] = os.dataVencimento.split('-');
                    dataFormatada = `${dia}/${mes}/${ano}`;
                }

                resumoHtml += `<li><strong>${dataFormatada}</strong> - OS ${os.numero} | Cliente: ${os.cliente} (${os.funcao}) - ${os.motivo} [Status: ${status.texto}]</li>`;
            }
        });

        resumoHtml += "</ul>";

        if (!possuiOS) {
            resumoHtml = "<h3>Ordens de Serviço a Realizar</h3><p>Nenhuma ordem de serviço crítica ou a vencer nos próximos 7 dias.</p>";
        }

        return resumoHtml;
    } catch (error) {
        console.error("Erro ao gerar resumo de OS: ", error);
        return "<p>Erro ao carregar Ordens de Serviço.</p>";
    }
}
