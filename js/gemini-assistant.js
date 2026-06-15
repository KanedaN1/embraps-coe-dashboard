// js/gemini-assistant.js

const VERCEL_API_URL = "/api/chat";

let chatHistory = [];
let currentSectionContext = "";

function openGeminiChat(sectionId) {
    const modal = document.getElementById('gemini-chat-modal');
    modal.style.display = 'flex';
    
    // Captura inteligente do título da seção (removendo botões)
    let sectionTitle = "Geral";
    const h2El = document.querySelector(`#${sectionId} h2`);
    if(h2El) {
        const clone = h2El.cloneNode(true);
        const actions = clone.querySelector('.section-title-actions');
        if(actions) actions.remove();
        sectionTitle = clone.innerText.trim();
    }
    
    // Extração profunda dos dados visíveis na tela
    let dataContext = extractSectionData(sectionId);

    currentSectionContext = `Você é um Analista Operacional de Dados especialista do COE. 
O usuário está visualizando a aba: ${sectionTitle} (ID: ${sectionId}).
Aqui estão os dados do dashboard para o mês atual (formato JSON):
${dataContext}

Responda sempre em português, de forma analítica, profissional e direta. Formate a resposta usando Markdown (listas, negrito). Foque em responder a pergunta do usuário baseando-se estritamente nos dados referentes à aba atual.`;

    // Reseta o chat se for a primeira vez ou ao mudar de aba
    const messagesContainer = document.getElementById('gemini-chat-messages');
    
    // Opcional: Se quisermos resetar sempre que abre uma aba nova
    messagesContainer.innerHTML = '';
    chatHistory = [];
    appendMessage('bot', `Olá! Sou seu Assistente de IA de Dados. Estou analisando a aba **${sectionTitle}**. O que você gostaria de saber sobre os indicadores?`);
}

function closeGeminiChat() {
    document.getElementById('gemini-chat-modal').style.display = 'none';
}

function appendMessage(sender, text) {
    const messagesContainer = document.getElementById('gemini-chat-messages');
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-bubble ${sender}`;
    
    if (sender === 'bot') {
        // Usa a biblioteca marked para renderizar markdown
        if (typeof marked !== 'undefined') {
            msgDiv.innerHTML = marked.parse(text);
        } else {
            msgDiv.innerHTML = `<p>${text}</p>`;
        }
    } else {
        msgDiv.textContent = text;
    }
    
    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function sendGeminiMessage() {
    const input = document.getElementById('gemini-chat-input');
    const message = input.value.trim();
    if (!message) return;
    
    input.value = '';
    appendMessage('user', message);
    
    // Mostra indicador de digitação
    const typingId = "typing-" + Date.now();
    const typingDiv = document.createElement('div');
    typingDiv.className = 'chat-bubble bot';
    typingDiv.id = typingId;
    typingDiv.innerHTML = '<i class="fa-solid fa-ellipsis fa-fade"></i> Analisando dados...';
    document.getElementById('gemini-chat-messages').appendChild(typingDiv);
    document.getElementById('gemini-chat-messages').scrollTop = document.getElementById('gemini-chat-messages').scrollHeight;

    // Constrói payload para API do Gemini
    const contents = [];
    
    // Se for a primeira mensagem da sessão, injeta o contexto do dashboard
    if (chatHistory.length === 0) {
        contents.push({
            role: "user",
            parts: [{ text: currentSectionContext }]
        });
        contents.push({
            role: "model",
            parts: [{ text: "Entendido. Estou pronto para analisar os dados e responder as perguntas do usuário com base neles." }]
        });
    }

    // Adiciona o histórico
    chatHistory.forEach(msg => {
        contents.push({
            role: msg.sender === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
        });
    });

    // Adiciona a nova mensagem
    contents.push({
        role: "user",
        parts: [{ text: message }]
    });

    try {
        const response = await fetch(VERCEL_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ contents: contents })
        });

        const data = await response.json();
        const typingEl = document.getElementById(typingId);
        if(typingEl) typingEl.remove();

        if (data.candidates && data.candidates[0].content.parts[0].text) {
            let botResponse = data.candidates[0].content.parts[0].text;
            appendMessage('bot', botResponse);
            
            // Atualiza histórico
            chatHistory.push({ sender: 'user', text: message });
            chatHistory.push({ sender: 'bot', text: botResponse });
        } else {
            console.error("Erro na resposta da API:", data);
            
            if (data.error && data.error.message) {
                appendMessage('bot', `Erro da API: ${data.error.message}`);
            } else {
                appendMessage('bot', "Desculpe, não consegui gerar uma resposta com os dados atuais. Tente novamente.");
            }
        }
    } catch (error) {
        console.error("Erro ao chamar API Gemini:", error);
        const typingEl = document.getElementById(typingId);
        if(typingEl) typingEl.remove();
        appendMessage('bot', "Ocorreu um erro de conexão com a IA. Verifique sua conexão e a chave de API.");
    }
}

function extractSectionData(sectionId) {
    const section = document.getElementById(sectionId);
    if(!section) return "Seção não encontrada.";

    let dataStrings = [];

    // 1. Resumo Json Básico (fallback)
    if (window.currentSelectedData) {
        dataStrings.push("--- RESUMO GERAL DO MÊS ---");
        dataStrings.push(JSON.stringify(window.currentSelectedData, null, 2));
    }

    // 2. Extrair KPIs (cards numéricos visíveis)
    const kpis = section.querySelectorAll('.kpi-card, .info-block, .anual-kpi-card, .reserva-card');
    if(kpis.length > 0) {
        dataStrings.push("\n--- KPIs E CARDS NA TELA ---");
        kpis.forEach(kpi => {
            // Tentativa generica de pegar o rótulo e o valor principal
            const label = kpi.querySelector('h3, h4, .anual-kpi-label, .reserva-header')?.innerText || "";
            const value = kpi.querySelector('h2, span:not(.anual-kpi-label):not(.reserva-pill), .anual-kpi-value, .value')?.innerText || "";
            if(label && value) {
                dataStrings.push(`- ${label.trim()}: ${value.trim()}`);
            }
        });
    }

    // 3. Extrair Gráficos via Chart.js
    const canvases = section.querySelectorAll('canvas');
    if(canvases.length > 0) {
        dataStrings.push("\n--- DADOS DOS GRÁFICOS (CHART.JS) ---");
        canvases.forEach(canvas => {
            // Tenta achar a instância global ou local do Chart.js
            let chart = null;
            if (typeof Chart !== 'undefined' && typeof Chart.getChart === 'function') {
                chart = Chart.getChart(canvas);
            } else if (window.charts && window.charts[canvas.id]) {
                chart = window.charts[canvas.id];
            }

            if(chart && chart.data) {
                const title = canvas.previousElementSibling?.innerText || canvas.id;
                dataStrings.push(`\n[Gráfico: ${title}]`);
                const labels = chart.data.labels || [];
                chart.data.datasets.forEach(ds => {
                    dataStrings.push(` Categoria/Dataset: ${ds.label || 'Valores'}`);
                    labels.forEach((lbl, idx) => {
                        dataStrings.push(`   * ${lbl}: ${ds.data[idx]}`);
                    });
                });
            }
        });
    }

    // 4. Extrair Tabelas e Rankings (se houver)
    const tables = section.querySelectorAll('table');
    if(tables.length > 0) {
        dataStrings.push("\n--- DADOS EM TABELAS ---");
        tables.forEach(table => {
            const rows = table.querySelectorAll('tr');
            rows.forEach(row => {
                const cells = Array.from(row.querySelectorAll('th, td')).map(c => c.innerText.trim());
                dataStrings.push(cells.join(" | "));
            });
            dataStrings.push("-----");
        });
    }
    
    // Capturar também pódios (ranking)
    const podiums = section.querySelectorAll('.podium-item');
    if (podiums.length > 0) {
        dataStrings.push("\n--- RANKINGS / PÓDIO ---");
        podiums.forEach((p, index) => {
            dataStrings.push(`${index + 1}º Lugar: ${p.innerText.replace(/\\n/g, ' ')}`);
        });
    }

    return dataStrings.join('\n');
}
