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
        os_resumo: await gerarResumoSemanalOS()
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
