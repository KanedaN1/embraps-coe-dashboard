/**
 * EMAIL SERVICE — email-service.js
 * Centraliza a integração com o EmailJS
 */

// CONFIGURAÇÃO - Preencha com as suas chaves do EmailJS
const EMAILJS_CONFIG = {
    PUBLIC_KEY: "fVBdgX9K12y2bCTjR",      // Cole sua Public Key aqui
    SERVICE_ID: "service_i0he87l",      // Cole seu Service ID aqui
    TEMPLATE_ALERTA: "template_u3lpjw4", // ID do template de atraso
    TEMPLATE_RELATORIO: "template_rnb7oox" // ID do template de resumo
};

// Inicialização
if (EMAILJS_CONFIG.PUBLIC_KEY !== "YOUR_PUBLIC_KEY") {
    emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY);
}

/**
 * Envia alerta de tarefa atrasada
 */
async function sendLateTaskEmail(task, operatorName) {
    if (EMAILJS_CONFIG.PUBLIC_KEY === "YOUR_PUBLIC_KEY") {
        console.warn("[EmailJS] Chaves não configuradas no email-service.js");
        return;
    }

    const templateParams = {
        atividade_nome: task.name,
        operador_nome: operatorName,
        prazo: new Date(task.deadline).toLocaleString('pt-BR'),
        gestor_nome: "Gestor COE"
    };

    try {
        const response = await emailjs.send(
            EMAILJS_CONFIG.SERVICE_ID,
            EMAILJS_CONFIG.TEMPLATE_ALERTA,
            templateParams
        );
        console.log("[EmailJS] Alerta de atraso enviado!", response.status, response.text);
        return true;
    } catch (error) {
        console.error("[EmailJS] Erro ao enviar alerta:", error);
        return false;
    }
}

/**
 * Envia o resumo semanal da dashboard
 */
async function sendWeeklyReportEmail(data) {
    if (EMAILJS_CONFIG.PUBLIC_KEY === "YOUR_PUBLIC_KEY") {
        alert("Por favor, configure suas chaves do EmailJS no arquivo js/email-service.js");
        return;
    }

    const templateParams = {
        data_envio: new Date().toLocaleDateString('pt-BR'),
        reserva_total: data.reservaTotal || 0,
        folga_portaria: data.folgaPortaria || "0,00",
        folga_limpeza: data.folgaLimpeza || "0,00",
        agenda_sla: data.agendaSla || 0,
        os_resumo: await gerarResumoSemanalOS(),
        experiencias_vencendo: await gerarResumoExperienciasVencendo(),
        vagas_atrasadas: await gerarResumoVagasAtrasadas()
    };

    try {
        const response = await emailjs.send(
            EMAILJS_CONFIG.SERVICE_ID,
            EMAILJS_CONFIG.TEMPLATE_RELATORIO,
            templateParams
        );
        console.log("[EmailJS] Relatório enviado com sucesso!", response.status, response.text);
        alert("Relatório enviado com sucesso para o e-mail cadastrado!");
        return true;
    } catch (error) {
        console.error("[EmailJS] Erro ao enviar relatório:", error);
        alert("Erro ao enviar e-mail. Verifique o console para mais detalhes.");
        return false;
    }
}

/**
 * Busca as OS com vencimento nos próximos 7 dias no Firestore
 */
async function gerarResumoSemanalOS() {
    let resumoHtml = '<h3>Ordens de Serviço a Realizar / Vencer (Próximos 7 Dias)</h3>';
    
    try {
        const db = firebase.firestore();
        const snapshot = await db.collection('ordens_servico').orderBy('dataVencimento', 'asc').get();
        let possuiOS = false;
        resumoHtml += '<ul>';

        // Hoje zerado
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        snapshot.docs.forEach(doc => {
            const os = doc.data();
            let status = 'No Prazo';
            
            if (os.dataVencimento) {
                const parts = os.dataVencimento.split('-');
                if(parts.length === 3) {
                    const ano = parts[0];
                    const mes = parts[1];
                    const dia = parts[2];
                    const dataVenc = new Date(ano, mes - 1, dia);
                    const diffDays = Math.ceil((dataVenc - hoje) / (1000 * 60 * 60 * 24));

                    if (diffDays >= 0 && diffDays <= 3) status = 'Alerta';
                    else if (diffDays > 3 && diffDays <= 7) status = 'A Vencer';

                    if (status === 'Alerta' || status === 'A Vencer') {
                        possuiOS = true;
                        const dataFormatada = dia + '/' + mes + '/' + ano;
                        resumoHtml += '<li><strong>' + dataFormatada + '</strong> - OS ' + os.numero + ' | Cliente: ' + os.cliente + ' (' + os.funcao + ') - ' + os.motivo + ' [Status: ' + status + ']</li>';
                    }
                }
            }
        });

        resumoHtml += '</ul>';

        if (!possuiOS) {
            resumoHtml = '<h3>Ordens de Serviço a Realizar</h3><p>Nenhuma ordem de serviço crítica ou a vencer nos próximos 7 dias.</p>';
        }

        return resumoHtml;
    } catch (error) {
        console.error('[EmailJS] Erro ao gerar resumo de OS: ', error);
        return '<p>Erro ao carregar Ordens de Serviço.</p>';
    }
}

/**
 * Busca experiências a vencer nos próximos 7 dias e retorna HTML resumo
 */
async function gerarResumoExperienciasVencendo() {
    try {
        const db = firebase.firestore();
        const snapshot = await db.collection('experiencia').where('status', '==', 'PENDENTE').get();

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const limite = new Date(hoje);
        limite.setDate(hoje.getDate() + 7);

        let count = 0;
        snapshot.forEach(doc => {
            const exp = doc.data();
            const checkDate = (isoDate) => {
                if (!isoDate) return false;
                const d = new Date(isoDate);
                return d >= hoje && d <= limite;
            };
            if (checkDate(exp.exp1) || checkDate(exp.exp2)) {
                count++;
            }
        });

        if (count === 0) {
            return '<p>Nenhuma experiência a vencer nos próximos 7 dias.</p>';
        }
        return `<p><strong>${count} colaborador(es)</strong> com período de experiência a vencer nos próximos 7 dias. Acesse o módulo de Controle de Experiência para detalhes.</p>`;
    } catch (error) {
        console.error('[EmailJS] Erro ao gerar resumo de experiências: ', error);
        return '<p>Erro ao carregar dados de experiências.</p>';
    }
}

/**
 * Busca vagas abertas há mais de 15 dias e retorna HTML com quantidade e nomes dos coordenadores
 */
async function gerarResumoVagasAtrasadas() {
    try {
        const db = firebase.firestore();
        const snapshot = await db.collection('vagas').where('status', '!=', 'Efetivado').get();

        const hoje = new Date();
        const vagasAtrasadas = [];

        snapshot.forEach(doc => {
            const vaga = doc.data();
            if (vaga.dataAbertura) {
                const [ano, mes, dia] = vaga.dataAbertura.split('-');
                const dataAbert = new Date(ano, mes - 1, dia);
                const diffDays = Math.ceil(Math.abs(hoje - dataAbert) / (1000 * 60 * 60 * 24));
                if (diffDays > 15) {
                    vagasAtrasadas.push({ ...vaga, diffDays });
                }
            }
        });

        if (vagasAtrasadas.length === 0) {
            return '<p>Nenhuma vaga com SLA estourado no momento.</p>';
        }

        // Agrupar coordenadores únicos
        const coordsMap = {};
        vagasAtrasadas.forEach(v => {
            const coord = v.coord || 'Não informado';
            coordsMap[coord] = (coordsMap[coord] || 0) + 1;
        });

        const coordsList = Object.entries(coordsMap)
            .map(([nome, qtd]) => `${nome} (${qtd} vaga${qtd > 1 ? 's' : ''})`)
            .join(', ');

        return `<p><strong>${vagasAtrasadas.length} vaga(s)</strong> com SLA estourado (abertas há mais de 15 dias). Coordenadores responsáveis: <strong>${coordsList}</strong>. Acesse o módulo de Gestão de Vagas para acompanhamento.</p>`;
    } catch (error) {
        console.error('[EmailJS] Erro ao gerar resumo de vagas: ', error);
        return '<p>Erro ao carregar dados de vagas.</p>';
    }
}
