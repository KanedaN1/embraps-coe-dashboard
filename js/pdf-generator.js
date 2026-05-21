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

const formatBRL = (v) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
};

function adjustLightness(hex, percent) {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);

    if (percent > 0) {
        r = Math.round(r + (255 - r) * percent);
        g = Math.round(g + (255 - g) * percent);
        b = Math.round(b + (255 - b) * percent);
    } else {
        r = Math.round(r * (1 + percent));
        g = Math.round(g * (1 + percent));
        b = Math.round(b * (1 + percent));
    }

    const rHex = Math.min(255, Math.max(0, r)).toString(16).padStart(2, '0');
    const gHex = Math.min(255, Math.max(0, g)).toString(16).padStart(2, '0');
    const bHex = Math.min(255, Math.max(0, b)).toString(16).padStart(2, '0');
    return `#${rHex}${gHex}${bHex}`;
}

const chart3DPlugin = {
    id: 'chart3D',
    beforeDatasetsDraw(chart, args, options) {
        if (chart.config.type !== 'bar') return;
        
        const ctx = chart.ctx;
        const meta = chart.getDatasetMeta(0);
        if (meta.hidden) return;

        const isHorizontal = chart.options.indexAxis === 'y';
        if (isHorizontal) return;

        const dataset = chart.data.datasets[0];
        const data = dataset.data;
        const slide = chart.options.slideConfig;

        ctx.save();

        meta.data.forEach((bar, index) => {
            const val = data[index];
            if (val === null || val === undefined || val === 0) return;

            const { x, y, base, width } = bar;
            const left = x - width / 2;
            const right = x + width / 2;
            const top = y;
            const bottom = base;

            const depth = Math.min(Math.max(width * 0.22, 10), 30);

            let baseColor = dataset.backgroundColor || '#4285F4';
            if (typeof baseColor === 'string') {
                if (baseColor.includes('rgba')) {
                    const match = baseColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                    if (match) {
                        const r = parseInt(match[1]).toString(16).padStart(2, '0');
                        const g = parseInt(match[2]).toString(16).padStart(2, '0');
                        const b = parseInt(match[3]).toString(16).padStart(2, '0');
                        baseColor = `#${r}${g}${b}`;
                    }
                }
            }

            let hexColor = baseColor;
            if (hexColor === '#1e3a8a' || hexColor === '#3b82f6') {
                hexColor = '#4285F4';
            }

            const frontColor = hexColor;
            const topColor = adjustLightness(hexColor, 0.35);
            const sideColor = adjustLightness(hexColor, -0.25);
            const shadowColor = 'rgba(0, 0, 0, 0.08)';

            ctx.fillStyle = shadowColor;
            ctx.beginPath();
            ctx.moveTo(left, bottom);
            ctx.lineTo(right, bottom);
            ctx.lineTo(right + depth, bottom - depth);
            ctx.lineTo(left + depth, bottom - depth);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = frontColor;
            ctx.beginPath();
            ctx.rect(left, top, width, bottom - top);
            ctx.fill();

            ctx.fillStyle = topColor;
            ctx.beginPath();
            ctx.moveTo(left, top);
            ctx.lineTo(right, top);
            ctx.lineTo(right + depth, top - depth);
            ctx.lineTo(left + depth, top - depth);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = sideColor;
            ctx.beginPath();
            ctx.moveTo(right, top);
            ctx.lineTo(right + depth, top - depth);
            ctx.lineTo(right + depth, bottom - depth);
            ctx.lineTo(right, bottom);
            ctx.closePath();
            ctx.fill();

            const barHeight = bottom - top;
            if (barHeight > 25) {
                ctx.fillStyle = '#ffffff';
                const valFontSize = Math.min(Math.max(width * 0.22, 10), 15);
                ctx.font = `bold ${valFontSize}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                let valStr = '';
                const isCurrency = slide && slide.isCurrency;
                const isPerc = slide && slide.chartId && slide.chartId.toLowerCase().includes('perc');
                
                if (isCurrency) {
                    valStr = formatBRL(val);
                } else if (isPerc) {
                    valStr = val.toFixed(1) + '%';
                } else {
                    valStr = val.toLocaleString('pt-BR');
                }
                
                ctx.fillText(valStr, x, top + barHeight / 2);
            }

            if (index > 0) {
                const prevVal = data[index - 1];
                if (prevVal && prevVal > 0) {
                    const diff = ((val - prevVal) / prevVal) * 100;
                    
                    let diffStr = '';
                    if (diff < 0) {
                        diffStr = `(${Math.abs(diff).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%)`;
                    } else {
                        diffStr = diff.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
                    }

                    ctx.fillStyle = '#1e3a8a';
                    const percFontSize = Math.min(Math.max(width * 0.20, 10), 14);
                    ctx.font = `bold ${percFontSize}px sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    
                    const labelX = x + depth / 2;
                    const labelY = top - depth / 2 - 4;
                    
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 3;
                    ctx.strokeText(diffStr, labelX, labelY);
                    
                    ctx.fillText(diffStr, labelX, labelY);
                }
            }
        });

        ctx.restore();
        return false;
    }
};


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

        // 2. Configurar PDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'px',
            format: [1280, 720]
        });

        // 3. Carregar Imagem de Fundo
        const bgImage = await loadImage('assets/img/background_slide.png');

        // 4. Definir Slides Consolidados
        const slides = [
            { title: "Gastos com Folgas Trabalhadas (Anual)", type: "chart", chartId: "chartVgFolgas", isCurrency: true, dataKey: "gastosFolgas" },
            { title: "Motivos das Folgas Trabalhadas (Mês)", type: "chart", chartId: "chartVgFolgasMotivos", isCurrency: true },
            { title: "Folgas Trabalhadas - Portaria (Semanal)", type: "chart", chartId: "chartVgFolgasPortaria", isCurrency: true },
            { title: "Folgas Trabalhadas - Limpeza (Semanal)", type: "chart", chartId: "chartVgFolgasLimpeza", isCurrency: true },
            { title: "Quantidade de Punições Aplicadas (Anual)", type: "chart", chartId: "chartVgPunicoes", dataKey: "punicoes" },
            { title: "Motivos das Punições (Mês)", type: "chart", chartId: "chartVgPunicoesMotivos" },
            { title: "Tipos de Punições Aplicadas (Mês)", type: "chart", chartId: "chartVgPunicoesTipos" },
            { title: "Pendências de Cartão de Ponto (Anual)", type: "chart", chartId: "chartVgPonto", dataKey: "pendenciasPonto" },
            { title: "Pendências por Supervisor (Mês)", type: "chart", chartId: "chartVgPontoSupervisor" },
            { title: "Gastos Mensais com App 99 (Anual)", type: "chart", chartId: "chartVgApp99", isCurrency: true, dataKey: "custo99", compactLabels: true },
            { title: "Gastos por Supervisor no App 99 (Mês)", type: "chart", chartId: "chartVgApp99Supervisor", isCurrency: true },
            { title: "Motivos de Viagens App 99 (Mês)", type: "chart", chartId: "chartVgApp99Motivos", isCurrency: true },
            { title: "Gastos com HE Geral (Anual)", type: "chart", chartId: "chartVgHeGeral", isCurrency: true, dataKey: "horasExtrasGeral" },
            { title: "Gastos com HE 100% (Anual)", type: "chart", chartId: "chartVgHe100", isCurrency: true, dataKey: "horasExtras100" },
            { title: "Gastos com HE Intrajornada (Anual)", type: "chart", chartId: "chartVgHeIntra", isCurrency: true, dataKey: "horasExtrasIntra" },
            { title: "Vale Transporte (Visão Anual Bimestral)", type: "chart", chartId: "chartVgVt", isCurrency: true },
            { title: "Valores por Cidade - VT (Mês)", type: "chart", chartId: "chartVgVtCidades", isCurrency: true },
            { title: "Valores por Escala - VT (Mês)", type: "chart", chartId: "chartVgVtEscalas", isCurrency: true },
            { title: "Visitas Realizadas no App Contele (Anual)", type: "chart", chartId: "chartVgContele", dataKey: "visitasContele" },
            { title: "Visitas por Supervisor (Mês)", type: "chart", chartId: "chartVgConteleSupervisor" },
            { title: "Divergências de Função", type: "composite", contentId: "vg-divergencia-pdf" },
            { title: "Faltas Mensais (Anual)", type: "composite", contentId: "vg-faltas-pdf" },
            { title: "Top 10 Clientes com Mais Faltas (Quantitativo)", type: "chart", chartId: "chartVgTopClientes" },
            { title: "Top 10 Clientes com Mais Faltas (Percentual)", type: "chart", chartId: "chartVgTopClientesPerc" },
            { title: "Reserva Operacional - Visão Geral", type: "reserva_geral" },
            { title: "Motivos das Movimentações", type: "chart", chartId: "chartMovMotivos", showMovBadge: true },
            { title: "Reservas Movimentadas por Supervisor", type: "chart", chartId: "chartMovSupervisores", showMovBadge: true },
            { title: "Colaboradores Movimentados por Transporte", type: "chart", chartId: "chartMovTransportes", showMovBadge: true },
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

            doc.addImage(bgImage, 'PNG', 0, 0, 1280, 720);

            doc.setTextColor(30, 58, 138);
            doc.setFontSize(28);
            doc.setFont('helvetica', 'bold');
            doc.text(slide.title, 110, 60);
            
            doc.setFontSize(16);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 116, 139);
            doc.text(`${monthLabel} de ${year}`, 110, 85);

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
            } else if (slide.type === "reserva_geral") {
                await renderReservaGeralSlide(tempDiv, currentData);
            }

            // Badge de Movimentação (Slide Motivos, Supervisores, Transportes)
            if (slide.showMovBadge) {
                const badge = document.createElement('div');
                badge.style.position = 'absolute';
                badge.style.top = '20px';
                badge.style.right = '20px';
                badge.style.background = '#1e3a8a';
                badge.style.color = 'white';
                badge.style.padding = '15px 25px';
                badge.style.borderRadius = '12px';
                badge.style.textAlign = 'center';
                badge.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                badge.innerHTML = `<span style="display:block; font-size:12px; opacity:0.8; font-weight:bold;">TOTAL MOVIMENTAÇÕES</span><span style="font-size:32px; font-weight:900;">${currentData.movTotal || 0}</span>`;
                tempDiv.appendChild(badge);
            }

            const canvas = await html2canvas(tempDiv, { scale: 1.5, backgroundColor: null, useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            doc.addImage(imgData, 'PNG', 140, 120, 1000, 500);

            document.body.removeChild(tempDiv);
            
            // Pequena pausa para evitar crash de memória (erro motivo 9)
            await new Promise(r => setTimeout(r, 150));
        }

        doc.save(`Apresentacao_Mensal_COE_${month}_${year}.pdf`);

    } catch (error) {
        console.error("Erro ao gerar PDF:", error);
        alert("Erro ao gerar o relatório PDF. Verifique o console.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function renderChartSlide(container, slide, currentData, prevData) {
    const originalChart = Chart.getChart(slide.chartId);
    if (!originalChart) return;

    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 500;
    container.appendChild(canvas);

    // Variação MoM
    if (slide.dataKey) {
        const curVal = currentData[slide.dataKey] || 0;
        const preVal = prevData[slide.dataKey] || 0;
        if (preVal > 0) {
            const diff = ((curVal - preVal) / preVal) * 100;
            const color = diff > 0 ? '#ef4444' : '#10b981';
            const icon = diff > 0 ? '▲' : '▼';
            const vDiv = document.createElement('div');
            vDiv.style.position = 'absolute';
            vDiv.style.top = '-40px';
            vDiv.style.right = '20px';
            vDiv.style.fontSize = '22px';
            vDiv.style.fontWeight = 'bold';
            vDiv.style.color = color;
            vDiv.innerHTML = `${icon} ${Math.abs(diff).toFixed(1)}% vs mês anterior`;
            container.appendChild(vDiv);
        }
    }

    const isHorizontal = slide.chartId.toLowerCase().includes('supervisor') || slide.chartId.toLowerCase().includes('cidade') || slide.chartId.toLowerCase().includes('escala') || slide.chartId.toLowerCase().includes('topclientes');
    
    let chartType = originalChart.config.type;
    if (slide.chartId === 'chartVgFolgasPortaria' || slide.chartId === 'chartVgFolgasLimpeza') {
        chartType = 'bar';
    }

    const config = {
        type: chartType,
        data: JSON.parse(JSON.stringify(originalChart.config.data)),
        options: {
            ...originalChart.config.options,
            responsive: false, animation: false, maintainAspectRatio: false,
            layout: { padding: { top: 45, right: 60, left: 20, bottom: 20 } },
            indexAxis: isHorizontal ? 'y' : (originalChart.config.options.indexAxis || 'x'),
            slideConfig: slide,
            plugins: {
                legend: {
                    display: true, position: 'bottom',
                    labels: { font: { size: 18, weight: 'bold' }, color: '#1e3a8a', padding: 20 }
                },
                datalabels: {
                    display: (chartType === 'bar' && !isHorizontal) ? false : true,
                    color: '#1e3a8a',
                    font: { size: slide.compactLabels ? 14 : 18, weight: 'bold' },
                    anchor: isHorizontal ? 'end' : 'end',
                    align: isHorizontal ? 'right' : 'top',
                    offset: 5,
                    formatter: (value) => {
                        if (typeof value === 'number') {
                            if (slide.chartId.toLowerCase().includes('perc')) return value.toFixed(1) + '%';
                            if (slide.isCurrency) return formatBRL(value);
                            return value.toLocaleString('pt-BR');
                        }
                        return value;
                    }
                }
            },
            scales: chartType === 'pie' || chartType === 'doughnut' ? {} : {
                x: { 
                    beginAtZero: true,
                    ticks: { font: { size: 16, weight: 'bold' }, color: '#1e3a8a' },
                    grid: { display: isHorizontal, color: 'rgba(226, 232, 240, 0.5)' }
                },
                y: { 
                    ticks: { font: { size: 16, weight: 'bold' }, color: '#1e3a8a' },
                    grid: { display: !isHorizontal, color: 'rgba(226, 232, 240, 0.5)' }
                }
            }
        }
    };

    if (chartType === 'bar' && !isHorizontal) {
        config.plugins = [chart3DPlugin];
    }

    if (slide.isLine && chartType === 'line') {
        config.data.datasets.forEach(ds => {
            ds.fill = false;
            ds.borderWidth = 4;
            ds.pointRadius = 6;
        });
    }

    if (chartType !== 'pie' && chartType !== 'doughnut') {
        config.data.datasets.forEach(ds => {
            if (chartType === 'bar' && !isHorizontal) {
                if (slide.chartId.toLowerCase().includes('limpeza')) {
                    ds.backgroundColor = '#10b981';
                    ds.borderColor = '#10b981';
                } else {
                    ds.backgroundColor = '#4285F4';
                    ds.borderColor = '#4285F4';
                }
            } else {
                ds.backgroundColor = slide.isLine ? 'transparent' : '#1e3a8a';
                ds.borderColor = '#1e3a8a';
            }
        });
    }

    new Chart(canvas, config);
}

async function renderCompositeSlide(container, slide, currentData, prevData) {
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.padding = '20px';
    container.style.fontFamily = 'Inter, sans-serif';

    if (slide.contentId === 'vg-divergencia-pdf') {
        const total = currentData.divergenciaFuncao || 0;
        const res = currentData.divergenciasResolvidas || 0;
        container.innerHTML = `
            <div style="display:flex; gap:30px; margin-bottom:30px;">
                <div style="flex:1; background:#1e3a8a; color:white; padding:25px; border-radius:15px; text-align:center;">
                    <h2 style="font-size:20px; margin-bottom:5px;">Ocorridas</h2>
                    <span style="font-size:50px; font-weight:800;">${total}</span>
                </div>
                <div style="flex:1; background:#10b981; color:white; padding:25px; border-radius:15px; text-align:center;">
                    <h2 style="font-size:20px; margin-bottom:5px;">Resolvidas</h2>
                    <span style="font-size:50px; font-weight:800;">${res}</span>
                </div>
                <div style="flex:1; background:#f8fafc; border:2px solid #1e3a8a; color:#1e3a8a; padding:25px; border-radius:15px; text-align:center;">
                    <h2 style="font-size:20px; margin-bottom:5px;">SLA</h2>
                    <span style="font-size:50px; font-weight:800;">${total > 0 ? Math.round((res/total)*100) : 100}%</span>
                </div>
            </div>
            <div style="flex:1; width:100%;"><canvas id="temp-div-anual"></canvas></div>
        `;
        setTimeout(() => {
            const ctx = document.getElementById('temp-div-anual').getContext('2d');
            const original = Chart.getChart('chartVgDivergencia');
            const cloneData = JSON.parse(JSON.stringify(original.config.data));
            cloneData.datasets.forEach(ds => {
                ds.backgroundColor = '#4285F4';
                ds.borderColor = '#4285F4';
            });
            new Chart(ctx, {
                type: 'bar',
                data: cloneData,
                options: { 
                    responsive: false, 
                    maintainAspectRatio: false, 
                    slideConfig: { chartId: 'chartVgDivergencia' },
                    plugins: { 
                        legend: { display: true }, 
                        datalabels: { display: false } 
                    },
                    scales: {
                        x: { ticks: { font: { size: 14, weight: 'bold' }, color: '#1e3a8a' }, grid: { display: false } },
                        y: { ticks: { font: { size: 14, weight: 'bold' }, color: '#1e3a8a' }, grid: { display: true, color: 'rgba(226, 232, 240, 0.5)' } }
                    }
                },
                plugins: [chart3DPlugin]
            });
        }, 100);
    } 
    else if (slide.contentId === 'vg-faltas-pdf') {
        const total = currentData.faltas || 0;
        const media = Math.round(total / 30);
        container.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#f1f5f9; border-left:10px solid #1e3a8a; padding:25px; border-radius:10px; margin-bottom:20px;">
                <h2 style="font-size:24px; color:#1e3a8a; margin:0;">Total Mês: <strong>${total.toLocaleString('pt-BR')}</strong></h2>
                <h2 style="font-size:24px; color:#1e3a8a; margin:0;">Média Diária: <strong>${media} faltas</strong></h2>
            </div>
            <div style="flex:1; width:100%;"><canvas id="temp-faltas-anual"></canvas></div>
        `;
        setTimeout(() => {
            const ctx = document.getElementById('temp-faltas-anual').getContext('2d');
            const original = Chart.getChart('chartVgFaltas');
            const cloneData = JSON.parse(JSON.stringify(original.config.data));
            cloneData.datasets.forEach(ds => {
                ds.backgroundColor = '#4285F4';
                ds.borderColor = '#4285F4';
            });
            new Chart(ctx, {
                type: 'bar',
                data: cloneData,
                options: { 
                    responsive: false, 
                    maintainAspectRatio: false, 
                    slideConfig: { chartId: 'chartVgFaltas' },
                    plugins: { 
                        legend: { display: false }, 
                        datalabels: { display: false } 
                    },
                    scales: {
                        x: { ticks: { font: { size: 14, weight: 'bold' }, color: '#1e3a8a' }, grid: { display: false } },
                        y: { ticks: { font: { size: 14, weight: 'bold' }, color: '#1e3a8a' }, grid: { display: true, color: 'rgba(226, 232, 240, 0.5)' } }
                    }
                },
                plugins: [chart3DPlugin]
            });
        }, 100);
    }
    else if (slide.contentId === 'vg-posvenda-pdf' || slide.contentId === 'vg-agenda-pdf') {
        const isPV = slide.contentId === 'vg-posvenda-pdf';
        const rankingHtml = document.getElementById(isPV ? 'pv-ranking' : 'ag-exec-ranking').innerHTML;
        const kpisHtml = document.getElementById(isPV ? 'pv-kpis' : 'ag-exec-kpis').innerHTML;
        container.innerHTML = `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:25px; width:100%; height:100%;">
                <div style="background:white; padding:25px; border-radius:20px; border:2px solid #1e3a8a; box-shadow: 0 10px 15px rgba(0,0,0,0.05);">
                    <h3 style="color:#1e3a8a; margin-top:0; border-bottom:2px solid #e2e8f0; padding-bottom:10px;">Indicadores</h3>
                    <div class="${isPV ? 'pv-kpi-grid' : 'ag-exec-kpi-grid'}" style="margin-top:20px;">${kpisHtml}</div>
                </div>
                <div style="background:white; padding:25px; border-radius:20px; border:2px solid #1e3a8a; box-shadow: 0 10px 15px rgba(0,0,0,0.05);">
                    <h3 style="color:#1e3a8a; margin-top:0; border-bottom:2px solid #e2e8f0; padding-bottom:10px;">Ranking</h3>
                    <table style="width:100%; margin-top:15px; border-collapse:collapse;"><tbody class="ranking-table-body">${rankingHtml}</tbody></table>
                </div>
            </div>
        `;
    }
}

async function renderReservaGeralSlide(container, currentData) {
    if (!currentData || !currentData.reservas) return;
    container.style.display = 'grid';
    container.style.gridTemplateColumns = '1fr 1fr 1fr';
    container.style.gap = '15px';
    container.style.padding = '10px';

    const renderCard = (title, type, icon) => {
        const dados = currentData.reservas[type];
        let totalA = 0, totalI = 0, rows = '';
        dados.forEach(item => {
            totalA += item.atual; totalI += item.ideal;
            const d = item.atual - item.ideal;
            rows += `<tr style="font-size:12px; border-bottom:1px solid #eee;"><td>${item.escala}</td><td>${item.atual}</td><td>${item.ideal}</td><td style="font-weight:bold; color:${d>=0?'#10b981':'#ef4444'}">${d>0?'+':''}${d}</td></tr>`;
        });
        return `
            <div style="background:white; border-radius:12px; border:1px solid #e2e8f0; overflow:hidden; display:flex; flex-direction:column;">
                <div style="background:#1e3a8a; color:white; padding:10px; font-size:14px; font-weight:bold; display:flex; justify-content:space-between; align-items:center;">
                    <span><i class="fa-solid ${icon}"></i> ${title}</span>
                    <span style="font-size:18px;">${totalA}/${totalI}</span>
                </div>
                <table style="width:100%; border-collapse:collapse; text-align:center;">
                    <thead style="background:#f8fafc; font-size:11px;"><tr><th>ESC</th><th>ATU</th><th>IDE</th><th>DIF</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    };

    container.innerHTML = renderCard('LIMPEZA', 'limpeza', 'fa-broom') + renderCard('PORTARIA DIA', 'portariaDia', 'fa-sun') + renderCard('PORTARIA NOITE', 'portariaNoite', 'fa-moon');
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}
