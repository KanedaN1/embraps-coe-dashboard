/**
 * INTEGRAÇÃO GOOGLE LOOKER STUDIO
 * Envia dados do dashboard para o Google Sheets via Webhook
 */

document.addEventListener('DOMContentLoaded', () => {
    const btnLooker = document.getElementById('btn-looker-studio');
    if (btnLooker) {
        btnLooker.addEventListener('click', exportToLookerStudio);
    }
});

// ==========================================
// CONFIGURAÇÕES (Preencha após criar no Google)
// ==========================================
const WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbwy1LE1fMO6wMEyywlyWNUyq7Oqn9XQfmj4As8YiWjv7sjpBN8d7VH01KxJm7FAiqnNiw/exec';
const LOOKER_STUDIO_URL = 'https://lookerstudio.google.com/navigation/reporting';
// ==========================================

async function exportToLookerStudio() {
    if (!WEBHOOK_URL || WEBHOOK_URL.includes('COLE_SUA_URL')) {
        alert('Atenção: A URL do Webhook não foi configurada.\n\nPor favor, abra o arquivo js/looker-integration.js e cole a URL do Google Apps Script na variável WEBHOOK_URL.');
        return;
    }

    const btn = document.getElementById('btn-looker-studio');
    const originalText = btn.innerHTML;

    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Atualizando Planilha...';

        const year = document.getElementById('filter-year').value;
        const month = document.getElementById('filter-month').value;

        // 1. Obter dados brutos do mês (Usando a função existente no app.js)
        let currentData = null;
        if (typeof getAllData === 'function') {
            const allData = await getAllData();
            currentData = allData[`${year}-${month}`] || { isEmpty: true };
        } else {
            throw new Error("Função getAllData não encontrada.");
        }

        // 2. Preparar payload de dados (Achatar a estrutura para enviar para a planilha)
        // Adicione outros campos se quiser mostrar no relatorio
        const payload = {
            ano_mes: `${year}-${month}`,
            ano: year,
            mes: month,
            faltas: currentData.faltas || 0,
            demissoes: currentData.demissoes || 0,
            gastosFolgas: currentData.gastosFolgas || 0,
            punicoes: currentData.punicoes || 0,
            pendenciasPonto: currentData.pendenciasPonto || 0,
            custo99: currentData.custo99 || 0,
            horasExtrasGeral: currentData.horasExtrasGeral || 0,
            horasExtras100: currentData.horasExtras100 || 0,
            valeTransporte: currentData.valeTransporte || 0,
            visitasContele: currentData.visitasContele || 0,
            divergenciaFuncao: currentData.divergenciaFuncao || 0,
            divergenciasResolvidas: currentData.divergenciasResolvidas || 0
        };

        // 3. Enviar requisição POST para o Apps Script
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            mode: 'no-cors', // Evita bloqueio CORS no navegador para chamadas simples
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        // 4. Concluir e abrir Looker
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Abrindo Looker...';
        setTimeout(() => {
            window.open(LOOKER_STUDIO_URL, '_blank');
            btn.disabled = false;
            btn.innerHTML = originalText;
        }, 1000);

    } catch (error) {
        console.error("Erro ao integrar com Looker Studio:", error);
        alert("Erro ao enviar dados para a planilha. Verifique o console.");
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}
