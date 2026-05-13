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
        agenda_sla: data.agendaSla || 0
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
