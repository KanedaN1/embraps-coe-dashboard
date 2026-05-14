/**
 * PDF GENERATOR — pdf-generator.js
 * Gera apresentações mensais em PDF com base nos dados do Dashboard
 */

document.addEventListener('DOMContentLoaded', () => {
    const btnPdf = document.getElementById('btn-generate-pdf');
    if (btnPdf) {
        btnPdf.addEventListener('click', generateMonthlyPDF);
    }
});

async function generateMonthlyPDF() {
    const btn = document.getElementById('btn-generate-pdf');
    const originalText = btn.innerHTML;
    
    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gerando Slides...';

        const year = document.getElementById('filter-year').value;
        const month = document.getElementById('filter-month').value;
        const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        const monthLabel = monthNames[parseInt(month) - 1];

        // 1. Buscar Dados
        const allData = await getAllData();
        const currentKey = `${year}-${month}`;
        const prevMonthVal = parseInt(month) - 1;
        const prevYearVal = prevMonthVal === 0 ? parseInt(year) - 1 : parseInt(year);
        const prevMonthStr = prevMonthVal === 0 ? "12" : prevMonthVal.toString().padStart(2, '0');
        const prevKey = `${prevYearVal}-${prevMonthStr}`;

        const currentData = allData[currentKey] || { isEmpty: true };
        const prevData = allData[prevKey] || { isEmpty: true };

        // Dados anuais para tendências
        const yearlyData = [];
        for (let m = 1; m <= 12; m++) {
            const mStr = m.toString().padStart(2, '0');
            const key = `${year}-${mStr}`;
            yearlyData.push(allData[key] || { isEmpty: true });
        }

        // 2. Configurar PDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'px',
            format: [1280, 720] // Resolução HD para slides
        });

        // 3. Carregar Imagem de Fundo
        const bgImage = await loadImage('assets/img/background_slide.png');

        // 4. Definir Slides
        const slides = [
            { title: "Gastos com Folgas Trabalhadas (Anual)", type: "chart", chartId: "chartVgFolgas", dataKey: "gastosFolgas" },
            { title: "Motivos das Folgas Trabalhadas (Mês)", type: "chart", chartId: "chartVgFolgasMotivos" },
            { title: "Folgas Trabalhadas - Portaria (Semanal)", type: "chart", chartId: "chartVgFolgasPortaria", dataKey: "folgasPortaria" },
            { title: "Folgas Trabalhadas - Limpeza (Semanal)", type: "chart", chartId: "chartVgFolgasLimpeza", dataKey: "folgasLimpeza" },
            { title: "Quantidade de Punições Aplicadas (Anual)", type: "chart", chartId: "chartVgPunicoes", dataKey: "punicoes" },
            { title: "Motivos das Punições (Mês)", type: "chart", chartId: "chartVgPunicoesMotivos" },
            { title: "Tipos de Punições Aplicadas (Mês)", type: "chart", chartId: "chartVgPunicoesTipos" },
            { title: "Pendências de Cartão de Ponto (Anual)", type: "chart", chartId: "chartVgPonto", dataKey: "pendenciasPonto" },
            { title: "Pendências por Supervisor (Mês)", type: "chart", chartId: "chartVgPontoSupervisor" },
            { title: "Gastos Mensais com App 99 (Anual)", type: "chart", chartId: "chartVgApp99", dataKey: "custo99" },
            { title: "Gastos por Supervisor no App 99 (Mês)", type: "chart", chartId: "chartVgApp99Supervisor" },
            { title: "Motivos de Viagens App 99 (Mês)", type: "chart", chartId: "chartVgApp99Motivos" },
            { title: "Gastos com HE Geral (Anual)", type: "chart", chartId: "chartVgHeGeral", dataKey: "horasExtrasGeral" },
            { title: "Gastos com HE 100% (Anual)", type: "chart", chartId: "chartVgHe100", dataKey: "horasExtras100" },
            { title: "Gastos com HE Intrajornada (Anual)", type: "chart", chartId: "chartVgHeIntra", dataKey: "horasExtrasIntra" },
            { title: "Vale Transporte (Visão Anual Bimestral)", type: "chart", chartId: "chartVgVt" },
            { title: "Valores por Cidade - VT (Mês)", type: "chart", chartId: "chartVgVtCidades" },
            { title: "Valores por Escala - VT (Mês)", type: "chart", chartId: "chartVgVtEscalas" },
            { title: "Visitas Realizadas no App Contele (Anual)", type: "chart", chartId: "chartVgContele", dataKey: "visitasContele" },
            { title: "Visitas por Supervisor (Mês)", type: "chart", chartId: "chartVgConteleSupervisor" },
            { title: "Divergências de Função", type: "composite", contentId: "vg-divergencia-pdf" },
            { title: "Faltas Mensais (Anual)", type: "composite", contentId: "vg-faltas-pdf" },
            { title: "Top 10 Clientes com Mais Faltas (Quantitativo)", type: "chart", chartId: "chartVgTopClientes" },
            { title: "Top 10 Clientes com Mais Faltas (Percentual)", type: "chart", chartId: "chartVgTopClientesPerc" },
            { title: "Reserva Operacional - Limpeza", type: "reserva", typeRes: "limpeza" },
            { title: "Reserva Operacional - Portaria Dia", type: "reserva", typeRes: "portariaDia" },
            { title: "Reserva Operacional - Portaria Noite", type: "reserva", typeRes: "portariaNoite" },
            { title: "Movimentação Operacional - Total Mês", type: "composite", contentId: "vg-mov-total-pdf" },
            { title: "Motivos das Movimentações", type: "chart", chartId: "chartMovMotivos" },
            { title: "Reservas Movimentadas por Supervisor", type: "chart", chartId: "chartMovSupervisores" },
            { title: "Colaboradores Movimentados por Transporte", type: "chart", chartId: "chartMovTransportes" },
            { title: "Quantidade de Treinamentos Coringa (Anual)", type: "chart", chartId: "chartCoringasTreinamentos", dataKey: "totalTreinamentos" },
            { title: "Usuários em Treinamento (Mês)", type: "chart", chartId: "chartCoringasUsuarios" },
            { title: "Postos com Treinamento (Mês)", type: "chart", chartId: "chartCoringasPostos" },
            { title: "Pós Venda Negativo - Ranking & Gestão", type: "composite", contentId: "vg-posvenda-pdf" },
            { title: "Agenda COE - Ranking & Produtividade", type: "composite", contentId: "vg-agenda-pdf" }
        ];

        // 5. Gerar Slides
        for (let i = 0; i < slides.length; i++) {
            const slide = slides[i];
            if (i > 0) doc.addPage();

            // Fundo
            doc.addImage(bgImage, 'PNG', 0, 0, 1280, 720);

            // Cabeçalho do Slide
            doc.setTextColor(30, 58, 138); // #1e3a8a
            doc.setFontSize(28);
            doc.setFont('helvetica', 'bold');
            doc.text(slide.title, 110, 60);
            
            doc.setFontSize(16);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 116, 139);
            doc.text(`${monthLabel} de ${year}`, 110, 85);

            // Conteúdo do Slide
            const tempDiv = document.createElement('div');
            tempDiv.style.position = 'absolute';
            tempDiv.style.left = '-9999px';
            tempDiv.style.top = '0';
            tempDiv.style.width = '1000px';
            tempDiv.style.height = '500px';
            tempDiv.style.background = 'transparent';
            document.body.appendChild(tempDiv);

            if (slide.type === "chart") {
                await renderChartSlide(tempDiv, slide, currentData, prevData);
            } else if (slide.type === "composite") {
                await renderCompositeSlide(tempDiv, slide, currentData, prevData);
            } else if (slide.type === "reserva") {
                await renderReservaSlide(tempDiv, slide, currentData);
            }

            const canvas = await html2canvas(tempDiv, { scale: 2, backgroundColor: null });
            const imgData = canvas.toDataURL('image/png');
            doc.addImage(imgData, 'PNG', 140, 120, 1000, 500);

            document.body.removeChild(tempDiv);
        }

        // 6. Download
        doc.save(`Relatorio_Mensal_COE_${month}_${year}.pdf`);

    } catch (error) {
        console.error("Erro ao gerar PDF:", error);
        alert("Erro ao gerar o relatório PDF. Verifique o console para mais detalhes.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

/**
 * Renderiza um gráfico formatado para o PDF
 */
async function renderChartSlide(container, slide, currentData, prevData) {
    const originalChart = Chart.getChart(slide.chartId);
    if (!originalChart) {
        container.innerHTML = `<p style="color:red">Gráfico ${slide.chartId} não encontrado.</p>`;
        return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 500;
    container.appendChild(canvas);

    // Calcular Variação MoM
    let variationHtml = '';
    if (slide.dataKey) {
        const curVal = currentData[slide.dataKey] || 0;
        const preVal = prevData[slide.dataKey] || 0;
        if (preVal > 0) {
            const diff = ((curVal - preVal) / preVal) * 100;
            const color = diff > 0 ? '#ef4444' : '#10b981';
            const icon = diff > 0 ? '▲' : '▼';
            variationHtml = `<div style="position:absolute; top:-40px; right:20px; font-size:24px; font-weight:bold; color:${color}">
                ${icon} ${Math.abs(diff).toFixed(1)}% vs mês anterior
            </div>`;
        }
    }

    const varContainer = document.createElement('div');
    varContainer.style.position = 'relative';
    varContainer.innerHTML = variationHtml;
    container.insertBefore(varContainer, canvas);

    // Criar novo gráfico com tema "Projetor"
    const isSupervisorOrCity = slide.chartId.toLowerCase().includes('supervisor') || slide.chartId.toLowerCase().includes('cidade') || slide.chartId.toLowerCase().includes('escala') || slide.chartId.toLowerCase().includes('topclientes');
    
    const config = {
        type: originalChart.config.type,
        data: JSON.parse(JSON.stringify(originalChart.config.data)),
        options: {
            ...originalChart.config.options,
            responsive: false,
            animation: false,
            maintainAspectRatio: false,
            indexAxis: isSupervisorOrCity ? 'y' : (originalChart.config.options.indexAxis || 'x'),
            plugins: {
                ...originalChart.config.options.plugins,
                legend: {
                    ...originalChart.config.options.plugins?.legend,
                    display: true,
                    position: 'bottom',
                    labels: { font: { size: 18, weight: 'bold' }, color: '#1e3a8a', padding: 20 }
                },
                datalabels: {
                    display: true,
                    color: '#1e3a8a',
                    font: { size: 18, weight: 'bold' },
                    anchor: isSupervisorOrCity ? 'end' : 'end',
                    align: isSupervisorOrCity ? 'right' : 'top',
                    offset: 5,
                    formatter: (value) => {
                        if (typeof value === 'number') {
                            if (slide.chartId.toLowerCase().includes('perc')) return value.toFixed(1) + '%';
                            return value.toLocaleString('pt-BR');
                        }
                        return value;
                    }
                }
            },
            scales: originalChart.config.type === 'pie' || originalChart.config.type === 'doughnut' ? {} : {
                x: { 
                    beginAtZero: true,
                    ticks: { font: { size: 16, weight: 'bold' }, color: '#1e3a8a' },
                    grid: { color: 'rgba(226, 232, 240, 0.5)' }
                },
                y: { 
                    ticks: { font: { size: 16, weight: 'bold' }, color: '#1e3a8a' },
                    grid: { display: false }
                }
            }
        }
    };

    new Chart(canvas, config);

    // Forçar cores azuis se não for pizza/rosca
    const newChart = Chart.getChart(canvas);
    if (newChart.config.type !== 'pie' && newChart.config.type !== 'doughnut') {
        newChart.data.datasets.forEach(ds => {
            ds.backgroundColor = '#1e3a8a';
            ds.borderColor = '#1e3a8a';
        });
        newChart.update();
    }
}

/**
 * Renderiza slides compostos (blocos de info + texto)
 */
async function renderCompositeSlide(container, slide, currentData, prevData) {
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.justifyContent = 'center';
    container.style.alignItems = 'center';
    container.style.padding = '20px';
    container.style.fontFamily = 'Inter, sans-serif';

    if (slide.contentId === 'vg-divergencia-pdf') {
        const total = currentData.divergenciaFuncao || 0;
        const res = currentData.divergenciasResolvidas || 0;
        container.innerHTML = `
            <div style="display:flex; gap:40px;">
                <div style="background:#1e3a8a; color:white; padding:40px; border-radius:20px; text-align:center; min-width:300px;">
                    <h2 style="font-size:24px; margin-bottom:10px;">Total Ocorridas</h2>
                    <span style="font-size:80px; font-weight:800;">${total}</span>
                </div>
                <div style="background:#10b981; color:white; padding:40px; border-radius:20px; text-align:center; min-width:300px;">
                    <h2 style="font-size:24px; margin-bottom:10px;">Total Resolvidas</h2>
                    <span style="font-size:80px; font-weight:800;">${res}</span>
                </div>
            </div>
            <p style="margin-top:40px; font-size:24px; font-weight:bold; color:#1e3a8a;">SLA de Resolução: ${total > 0 ? Math.round((res/total)*100) : 100}%</p>
        `;
    } 
    else if (slide.contentId === 'vg-faltas-pdf') {
        const total = currentData.faltas || 0;
        const media = Math.round(total / 30);
        container.innerHTML = `
            <div style="background:#f1f5f9; border-left:10px solid #1e3a8a; padding:40px; border-radius:10px; width:80%;">
                <h2 style="font-size:32px; color:#1e3a8a; margin-bottom:20px;">Resumo Operacional</h2>
                <p style="font-size:28px; line-height:1.5;">Total de faltas no mês: <strong>${total.toLocaleString('pt-BR')}</strong></p>
                <p style="font-size:28px; line-height:1.5;">Média diária: <strong>${media} faltas/dia</strong></p>
            </div>
            <div style="margin-top:40px; width:100%; height:300px;">
                <canvas id="temp-faltas-chart"></canvas>
            </div>
        `;
        // Adicionar o gráfico anual de faltas também
        setTimeout(() => {
            const ctx = document.getElementById('temp-faltas-chart').getContext('2d');
            const original = Chart.getChart('chartVgFaltas');
            new Chart(ctx, {
                type: 'bar',
                data: JSON.parse(JSON.stringify(original.config.data)),
                options: { responsive: false, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { display: true, color: '#1e3a8a', font: { weight: 'bold', size: 14 } } } }
            });
        }, 100);
    }
    else if (slide.contentId === 'vg-mov-total-pdf') {
        const total = currentData.movTotal || 0;
        container.innerHTML = `
            <div style="background:#1e3a8a; color:white; padding:60px; border-radius:30px; text-align:center; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
                <h2 style="font-size:36px; margin-bottom:20px;">Total de Movimentações</h2>
                <span style="font-size:120px; font-weight:900;">${total}</span>
                <p style="font-size:24px; margin-top:20px; opacity:0.8;">Colaboradores remanejados no período</p>
            </div>
        `;
    }
    else if (slide.contentId === 'vg-posvenda-pdf') {
        const rankingHtml = document.getElementById('pv-ranking').innerHTML;
        const kpisHtml = document.getElementById('pv-kpis').innerHTML;
        container.innerHTML = `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; width:100%;">
                <div style="background:white; padding:20px; border-radius:15px; border:1px solid #e2e8f0;">
                    <h3 style="color:#1e3a8a; margin-bottom:20px;">Indicadores de Retorno</h3>
                    ${kpisHtml}
                </div>
                <div style="background:white; padding:20px; border-radius:15px; border:1px solid #e2e8f0;">
                    <h3 style="color:#1e3a8a; margin-bottom:20px;">Ranking Coordenadores</h3>
                    ${rankingHtml}
                </div>
            </div>
        `;
    }
    else if (slide.contentId === 'vg-agenda-pdf') {
        const kpis = document.getElementById('ag-exec-kpis').innerHTML;
        const ranking = document.getElementById('ag-exec-ranking').innerHTML;
        container.innerHTML = `
             <div style="display:grid; grid-template-columns: 1fr 1.2fr; gap:20px; width:100%;">
                <div style="background:white; padding:20px; border-radius:15px; border:1px solid #e2e8f0;">
                    <h3 style="color:#1e3a8a; margin-bottom:20px;">Status das Atividades</h3>
                    ${kpis}
                </div>
                <div style="background:white; padding:20px; border-radius:15px; border:1px solid #e2e8f0;">
                    <h3 style="color:#1e3a8a; margin-bottom:20px;">Ranking de Produtividade</h3>
                    ${ranking}
                </div>
            </div>
        `;
    }
}

/**
 * Renderiza tabelas de reserva
 */
async function renderReservaSlide(container, slide, currentData) {
    if (!currentData || !currentData.reservas) return;
    
    const dados = currentData.reservas[slide.typeRes];
    if (!dados) return;

    let totalAtual = 0;
    let totalIdeal = 0;
    let rows = '';
    
    dados.forEach(item => {
        totalAtual += (item.atual || 0);
        totalIdeal += (item.ideal || 0);
        const dif = item.atual - item.ideal;
        const color = dif >= 0 ? '#10b981' : '#ef4444';
        rows += `
            <tr style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:15px; font-size:20px;">${item.escala}</td>
                <td style="padding:15px; font-size:20px; text-align:center;">${item.atual}</td>
                <td style="padding:15px; font-size:20px; text-align:center;">${item.ideal}</td>
                <td style="padding:15px; font-size:22px; text-align:center; font-weight:bold; color:${color}">${dif > 0 ? '+' : ''}${dif}</td>
            </tr>
        `;
    });

    container.innerHTML = `
        <div style="width:100%; font-family:Inter, sans-serif;">
            <div style="display:flex; justify-content:space-between; align-items:center; background:#1e3a8a; color:white; padding:20px; border-radius:15px 15px 0 0;">
                <h2 style="margin:0; font-size:24px;">Escalas de Operação</h2>
                <div style="display:flex; gap:30px;">
                    <div style="text-align:center;"><span style="display:block; font-size:12px; opacity:0.8;">ATUAL</span><span style="font-size:28px; font-weight:bold;">${totalAtual}</span></div>
                    <div style="text-align:center;"><span style="display:block; font-size:12px; opacity:0.8;">IDEAL</span><span style="font-size:28px; font-weight:bold;">${totalIdeal}</span></div>
                </div>
            </div>
            <table style="width:100%; border-collapse:collapse; background:white; border-radius:0 0 15px 15px; overflow:hidden;">
                <thead style="background:#f8fafc;">
                    <tr>
                        <th style="padding:15px; text-align:left; color:#64748b;">ESCALA</th>
                        <th style="padding:15px; color:#64748b;">ATUAL</th>
                        <th style="padding:15px; color:#64748b;">IDEAL</th>
                        <th style="padding:15px; color:#64748b;">DIF.</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>
    `;
}

/**
 * Utilitário para carregar imagem de forma assíncrona
 */
function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}
