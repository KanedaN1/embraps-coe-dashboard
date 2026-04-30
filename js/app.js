// Registrar plugin de DataLabels globalmente
Chart.register(ChartDataLabels);

let charts = {};
let tvModeInterval = null;
let currentSectionIndex = 0;

const chartColors = {
    primary: '#173f8a',
    secondary: '#2c6eb5',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#38bdf8',
    gray: '#cbd5e1',
    app99: '#facc15'
};

document.addEventListener('DOMContentLoaded', () => {
    // Definir data atual
    const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
    document.getElementById('filter-year').value = "2026";
    document.getElementById('filter-month').value = currentMonth;
    
    // Event listeners
    document.getElementById('filter-year').addEventListener('change', updateDashboard);
    document.getElementById('filter-month').addEventListener('change', updateDashboard);
    
    document.getElementById('btn-tv-mode').addEventListener('click', toggleTvMode);

    // ---- Menu Mobile (Hamburger) ----
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const menuToggle = document.getElementById('btn-menu-toggle');

    function openSidebar() {
        sidebar.classList.add('open');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    function closeSidebar() {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    if (menuToggle) menuToggle.addEventListener('click', openSidebar);
    if (overlay)    overlay.addEventListener('click', closeSidebar);

    // Navegação Sidebar (Tabs)
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Atualizar links ativos
            navLinks.forEach(l => l.parentElement.classList.remove('active'));
            e.currentTarget.parentElement.classList.add('active');
            
            // Atualizar seção ativa
            const targetId = e.currentTarget.getAttribute('href').substring(1);
            document.querySelectorAll('.dashboard-section').forEach(sec => {
                sec.classList.remove('active-section');
            });
            const targetSection = document.getElementById(targetId);
            if(targetSection) {
                targetSection.classList.add('active-section');
            }

            // Fechar sidebar no mobile ao clicar num link
            if (window.innerWidth <= 768) closeSidebar();
        });
    });
    
    // Config global Chart.js
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = '#64748b';
    Chart.defaults.plugins.tooltip.backgroundColor = '#0f172a';
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.maintainAspectRatio = false;
    
    // Config Datalabels global
    Chart.defaults.plugins.datalabels = {
        color: '#0f172a',
        font: { weight: 'bold', size: 10 },
        formatter: (value) => value > 0 ? value : '',
        anchor: 'end',
        align: 'start',
        clamp: true,
        padding: 4
    };

    // Adicionar botão de imprimir nas seções
    document.querySelectorAll('.section-title').forEach(title => {
        const btn = document.createElement('button');
        btn.className = 'btn-primary print-btn';
        btn.style.marginLeft = 'auto';
        btn.style.fontSize = '0.9rem';
        btn.style.padding = '8px 16px';
        btn.innerHTML = '<i class="fa-solid fa-print"></i> Imprimir A4';
        btn.onclick = () => window.print();
        title.appendChild(btn);
    });

    updateDashboard();
});

function toggleTvMode() {
    const btn = document.getElementById('btn-tv-mode');
    
    if (tvModeInterval) {
        // Parar Modo TV
        clearInterval(tvModeInterval);
        tvModeInterval = null;
        btn.innerHTML = '<i class="fa-solid fa-tv"></i> Modo TV';
        btn.classList.remove('bg-danger');
        btn.style.backgroundColor = 'var(--accent-color)';
        
        // Sair de tela cheia
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(err => console.log(err));
        }
        
    } else {
        // Iniciar Modo TV
        btn.innerHTML = '<i class="fa-solid fa-stop"></i> Parar TV';
        btn.style.backgroundColor = 'var(--danger)';
        
        // Entrar em tela cheia (opcional mas recomendado para TV)
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
            elem.requestFullscreen().catch(err => console.log(err));
        }
        
        const navLinks = Array.from(document.querySelectorAll('.nav-link'));
        let currentIndex = navLinks.findIndex(l => l.parentElement.classList.contains('active'));
        if (currentIndex === -1) currentIndex = 0;
        
        tvModeInterval = setInterval(() => {
            currentIndex++;
            if (currentIndex >= navLinks.length) {
                currentIndex = 0;
            }
            
            // Simular click no link
            navLinks[currentIndex].click();
            
        }, 8000); // 8 segundos por aba
    }
}

async function updateDashboard() {
    const year = document.getElementById('filter-year').value;
    const month = document.getElementById('filter-month').value;

    const allData = await getAllData();

    let yearlyData = [];
    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    const monthLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    months.forEach((m) => {
        const key = `${year}-${m}`;
        if (allData[key]) {
            yearlyData.push({ month: m, ...allData[key] });
        } else {
            yearlyData.push({ month: m, isEmpty: true });
        }
    });

    document.getElementById('alerts-container').innerHTML = '';
    const currentData = yearlyData.find(d => d.month === month);

    updateKPIs(currentData);
    checkAlerts(currentData, month);
    renderCharts(yearlyData, monthLabels, currentData);
    renderContelePodium(currentData);
    updateDivergenciaBlocks(currentData);
    renderReservaOperacional(currentData);

    // Render Calendars
    const faltasDiarias = (currentData && currentData.faltasDiarias) ? currentData.faltasDiarias : {};
    const demissoesDiarias = (currentData && currentData.demissoesDiarias) ? currentData.demissoesDiarias : {};

    renderCalendar('cal-faltas', faltasDiarias, year, month, 'Faltas');
    renderCalendar('cal-demissoes', demissoesDiarias, year, month, 'Demissões');

    renderResumoAnual(yearlyData, monthLabels);
}

const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

function updateKPIs(currentData) {
    let mediaFaltasDia = 0;
    
    if (currentData && !currentData.isEmpty && currentData.faltas) {
        mediaFaltasDia = Math.round(currentData.faltas / 30);
    }
    
    document.getElementById('kpi-media-faltas').textContent = mediaFaltasDia;
    document.getElementById('note-media-faltas').textContent = mediaFaltasDia;

    if (currentData && !currentData.isEmpty) {
        document.getElementById('kpi-reservas-diurna').textContent = currentData.reservasDiurna || 0;
        document.getElementById('kpi-reservas-noturna').textContent = currentData.reservasNoturna || 0;
        document.getElementById('kpi-reservas-limpeza').textContent = currentData.reservasLimpeza || 0;
    } else {
        document.getElementById('kpi-reservas-diurna').textContent = '0';
        document.getElementById('kpi-reservas-noturna').textContent = '0';
        document.getElementById('kpi-reservas-limpeza').textContent = '0';
    }
}

function checkAlerts(currentData, month) {
    if (!currentData || currentData.isEmpty) return;

    const faltasDia = currentData.faltas ? Math.round(currentData.faltas / 30) : 0;

    // Faltas: SLA = máx 1.200/mês | média diária SLA = 42/dia
    if (currentData.faltas > 1200) {
        showAlert(`🔴 Alerta Faltas: ${currentData.faltas} faltas no mês ${month} — limite máximo é 1.200.`, 'danger');
    } else if (faltasDia > 42) {
        showAlert(`⚠️ Média de faltas por dia (${faltasDia}) ultrapassou o limite diário de 42 no mês ${month}.`, 'warning');
    }

    // Demissões: SLA = máx 100/mês
    if (currentData.demissoes > 100) {
        showAlert(`🔴 Alerta Demissões: ${currentData.demissoes} demissões no mês ${month} — limite é 100.`, 'danger');
    }

    // Motivos de demissão
    if (currentData.demissoesMotivos) {
        const m = currentData.demissoesMotivos;
        if (m.experiencia >= 20) {
            showAlert(`⚠️ Término de experiência atingiu ${m.experiencia} casos no mês ${month} (limite: 20).`, 'warning');
        }
        if (m.justa_causa > 10) {
            showAlert(`🔴 Justa Causa: ${m.justa_causa} casos no mês ${month} — limite é 10.`, 'danger');
        }
    }

    // Punições (Disciplina): SLA = máx 150/mês
    if (currentData.punicoes > 150) {
        showAlert(`🔴 Punições: ${currentData.punicoes} no mês ${month} — limite máximo é 150.`, 'danger');
    }

    // Pendências Cartão de Ponto: SLA = máx 100/mês
    if (currentData.pendenciasPonto > 100) {
        showAlert(`⚠️ Cartão de Ponto: ${currentData.pendenciasPonto} pendências no mês ${month} — limite é 100.`, 'warning');
    }

    // Folgas Trabalhadas: SLA = máx R$ 100.000/mês
    if (currentData.gastosFolgas > 100000) {
        showAlert(`🔴 Folgas Trabalhadas: ${formatCurrency(currentData.gastosFolgas)} no mês ${month} — limite é R$ 100.000.`, 'danger');
    }

    // Vale Transporte: SLA = máx R$ 18.000/mês
    if (currentData.valeTransporte > 18000) {
        showAlert(`⚠️ Vale Transporte: ${formatCurrency(currentData.valeTransporte)} no mês ${month} — limite é R$ 18.000.`, 'warning');
    }

    // Horas Extras: SLA = até R$ 23.000/mês
    if (currentData.horasExtrasGeral > 23000) {
        showAlert(`⚠️ Horas Extras: ${formatCurrency(currentData.horasExtrasGeral)} no mês ${month} — acima do padrão de R$ 23.000.`, 'warning');
    }

    // App 99: SLA = máx R$ 18.000/mês
    if (currentData.custo99 > 18000) {
        showAlert(`🔴 App 99: ${formatCurrency(currentData.custo99)} no mês ${month} — limite é R$ 18.000 (14 usuários ativos).`, 'danger');
    }

    // Contele: SLA = mínimo 3.000 visitas/mês
    if (currentData.visitasContele && currentData.visitasContele < 3000) {
        showAlert(`⚠️ Contele: apenas ${currentData.visitasContele} visitas no mês ${month} — mínimo esperado é 3.000.`, 'warning');
    }

    // Divergências: 100% devem ser resolvidas no mês
    if (currentData.divergenciaFuncao > 0 && currentData.divergenciasResolvidas < currentData.divergenciaFuncao) {
        const pendentes = currentData.divergenciaFuncao - (currentData.divergenciasResolvidas || 0);
        showAlert(`🔴 Divergências: ${pendentes} ocorrência(s) não resolvida(s) no mês ${month} — SLA exige 100% de resolução.`, 'danger');
    }
}

function showAlert(message, type = 'info') {
    const container = document.getElementById('alerts-container');
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    
    let icon = 'fa-info-circle';
    if (type === 'warning') icon = 'fa-exclamation-triangle';
    if (type === 'danger') icon = 'fa-times-circle';

    alertDiv.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    container.appendChild(alertDiv);
}

const getValues = (data, key) => data.map(d => d.isEmpty ? 0 : (d[key] || 0));

// Função genérica para criar gráficos de barra
function renderBarChart(canvasId, labels, datasets, options = {}) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    if (charts[canvasId]) {
        charts[canvasId].destroy();
    }
    
    const isCurrency = options.isCurrency || false;
    const isPercentage = options.isPercentage || false;
    delete options.isCurrency; // Remover pra n bugar o chartjs
    delete options.isPercentage;

    const chartType = options.type || 'bar';
    delete options.type;

    const isStacked = options.stacked || false;
    delete options.stacked;

    const defaultOptions = {
        responsive: true,
        plugins: {
            legend: {
                display: datasets.length > 1,
                position: 'bottom'
            },
            datalabels: {
                color: '#0f172a',
                font: {
                    weight: 'bold',
                    size: 10
                },
                display: function(context) {
                    return context.dataset.data[context.dataIndex] > 0;
                },
                formatter: (value) => {
                    if(value === 0 || !value) return '';
                    if(isCurrency) {
                        // Formato compacto para não transbordar: R$ 15k
                        if(value >= 1000000) return 'R$' + (value/1000000).toFixed(1) + 'M';
                        if(value >= 1000) return 'R$' + (value/1000).toFixed(0) + 'k';
                        return 'R$' + value;
                    }
                    if(isPercentage) return value + '%';
                    return value;
                },
                anchor: 'end',
                align: 'start',
                clamp: true,
                padding: 4
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        const val = context.raw;
                        if (val !== null && val !== undefined) {
                            label += isCurrency ? formatCurrency(val) : (isPercentage ? val + '%' : val);
                        }
                        return label;
                    }
                }
            }
        },
        scales: chartType === 'pie' || chartType === 'doughnut' ? {} : {
            y: { beginAtZero: true, stacked: isStacked },
            x: {
                stacked: isStacked,
                ticks: {
                    color: '#475569',
                    font: { weight: '600' }
                }
            }
        }
    };

    charts[canvasId] = new Chart(ctx, {
        type: chartType,
        data: { labels, datasets },
        options: { ...defaultOptions, ...options }
    });
}

function renderCharts(yearlyData, monthLabels, currentData) {
    
    // Dashboard Resumo
    renderBarChart('chartResumoFaltas', monthLabels, [{
        label: 'Faltas',
        data: getValues(yearlyData, 'faltas'),
        backgroundColor: chartColors.warning,
        borderRadius: 4
    }]);

    renderBarChart('chartResumoFts', monthLabels, [{
        label: 'Folgas Trabalhadas',
        data: getValues(yearlyData, 'gastosFolgas'),
        backgroundColor: chartColors.success,
        borderRadius: 4
    }], { isCurrency: true });

    // Visão Geral - Folgas
    renderBarChart('chartVgFolgas', monthLabels, [{
        label: 'Gastos (R$)',
        data: getValues(yearlyData, 'gastosFolgas'),
        backgroundColor: chartColors.success,
        borderRadius: 4
    }], { isCurrency: true });

    const semanas = ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'];
    let gastosPortaria = [0, 0, 0, 0];
    let gastosLimpeza = [0, 0, 0, 0];
    
    if (currentData && !currentData.isEmpty && currentData.gastosFolgas) {
        const total = currentData.gastosFolgas;
        const portariaTotal = total * 0.7; 
        const limpezaTotal = total * 0.3; 
        
        gastosPortaria = [portariaTotal * 0.2, portariaTotal * 0.3, portariaTotal * 0.25, portariaTotal * 0.25];
        gastosLimpeza = [limpezaTotal * 0.25, limpezaTotal * 0.2, limpezaTotal * 0.3, limpezaTotal * 0.25];
    }
    
    renderBarChart('chartVgFolgasPortaria', semanas, [{
        label: 'Portaria (R$)',
        data: gastosPortaria,
        backgroundColor: 'rgba(56, 189, 248, 0.2)',
        borderColor: chartColors.primary,
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: chartColors.primary
    }], { isCurrency: true, type: 'line' });

    renderBarChart('chartVgFolgasLimpeza', semanas, [{
        label: 'Limpeza (R$)',
        data: gastosLimpeza,
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        borderColor: chartColors.success,
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: chartColors.success
    }], { isCurrency: true, type: 'line' });

    // Punições
    renderBarChart('chartVgPunicoes', monthLabels, [{
        label: 'Punições',
        data: getValues(yearlyData, 'punicoes'),
        backgroundColor: chartColors.danger,
        borderRadius: 4
    }]);

    // Ponto
    renderBarChart('chartVgPonto', monthLabels, [{
        label: 'Pendências',
        data: getValues(yearlyData, 'pendenciasPonto'),
        backgroundColor: chartColors.primary,
        borderRadius: 4
    }]);

    // App 99
    renderBarChart('chartVgApp99', monthLabels, [{
        label: 'Gasto App 99 (R$)',
        data: getValues(yearlyData, 'custo99'),
        backgroundColor: chartColors.app99,
        borderRadius: 4
    }], { isCurrency: true });

    // App 99 por Supervisor (Mensal)
    let app99Labels = [];
    let app99Data = [];
    if (currentData && !currentData.isEmpty && currentData.supervisores99) {
        currentData.supervisores99.forEach(s => {
            app99Labels.push(s.nome);
            app99Data.push(s.gasto);
        });
    }
    renderBarChart('chartVgApp99Supervisor', app99Labels, [{
        label: 'Gasto (R$)',
        data: app99Data,
        backgroundColor: chartColors.app99,
        borderRadius: 4
    }], { isCurrency: true });

    // Horas Extras
    renderBarChart('chartVgHeGeral', monthLabels, [{
        label: 'HE Geral (R$)',
        data: getValues(yearlyData, 'horasExtrasGeral'),
        backgroundColor: chartColors.primary,
        borderRadius: 4
    }], { isCurrency: true });
    renderBarChart('chartVgHe100', monthLabels, [{
        label: 'HE 100% (R$)',
        data: getValues(yearlyData, 'horasExtras100'),
        backgroundColor: chartColors.secondary,
        borderRadius: 4
    }], { isCurrency: true });
    renderBarChart('chartVgHeIntra', monthLabels, [{
        label: 'HE Intra (R$)',
        data: getValues(yearlyData, 'horasExtrasIntra'),
        backgroundColor: chartColors.info,
        borderRadius: 4
    }], { isCurrency: true });

    // Vale Transporte Bimestral
    const vtValues = getValues(yearlyData, 'valeTransporte');
    const bimestres = ['Jan/Fev', 'Mar/Abr', 'Mai/Jun', 'Jul/Ago', 'Set/Out', 'Nov/Dez'];
    const vtBimestral = [
        vtValues[0] + vtValues[1],
        vtValues[2] + vtValues[3],
        vtValues[4] + vtValues[5],
        vtValues[6] + vtValues[7],
        vtValues[8] + vtValues[9],
        vtValues[10] + vtValues[11]
    ];
    renderBarChart('chartVgVt', bimestres, [{
        label: 'Vale Transporte (R$)',
        data: vtBimestral,
        backgroundColor: chartColors.primary,
        borderRadius: 4
    }], { isCurrency: true });

    // Contele
    renderBarChart('chartVgContele', monthLabels, [{
        label: 'Visitas',
        data: getValues(yearlyData, 'visitasContele'),
        backgroundColor: chartColors.info,
        borderRadius: 4
    }]);

    let conteleLabels = [];
    let conteleData = [];
    if (currentData && !currentData.isEmpty && currentData.supervisoresContele) {
        currentData.supervisoresContele.forEach(s => {
            conteleLabels.push(s.nome);
            conteleData.push(s.visitas);
        });
    }
    renderBarChart('chartVgConteleSupervisor', conteleLabels, [{
        label: 'Visitas',
        data: conteleData,
        backgroundColor: chartColors.info,
        borderRadius: 4
    }]);

    // Divergência
    renderBarChart('chartVgDivergencia', monthLabels, [{
        label: 'Divergências',
        data: getValues(yearlyData, 'divergenciaFuncao'),
        backgroundColor: chartColors.warning,
        borderRadius: 4
    }]);

    // Faltas (Anual repetido na aba Faltas conforme solicitado)
    renderBarChart('chartVgFaltas', monthLabels, [{
        label: 'Faltas',
        data: getValues(yearlyData, 'faltas'),
        backgroundColor: chartColors.warning,
        borderRadius: 4
    }]);

    // Top Clientes
    let topClientesLabels = [];
    let topClientesData = [];
    if (currentData && !currentData.isEmpty && currentData.topClientesFaltas) {
        const sorted = currentData.topClientesFaltas.sort((a,b) => b.faltas - a.faltas);
        topClientesLabels = sorted.map(c => c.nome);
        topClientesData = sorted.map(c => c.faltas);
    }
    renderBarChart('chartVgTopClientes', topClientesLabels, [{
        label: 'Faltas',
        data: topClientesData,
        backgroundColor: chartColors.secondary,
        borderRadius: 4
    }], { indexAxis: 'y' });

    let topFaltasPercLabels = [];
    let topFaltasPercData = [];
    if (currentData && !currentData.isEmpty && currentData.topClientesFaltasPerc) {
        const sorted = currentData.topClientesFaltasPerc.sort((a,b) => b.percentual - a.percentual);
        topFaltasPercLabels = sorted.map(c => c.nome);
        topFaltasPercData = sorted.map(c => c.percentual);
    }
    renderBarChart('chartVgTopClientesPerc', topFaltasPercLabels, [{
        label: 'Faltas (%)',
        data: topFaltasPercData,
        backgroundColor: chartColors.info,
        borderRadius: 4
    }], { indexAxis: 'y', isPercentage: true });

    // Demissões
    renderBarChart('chartVgDemissoes', monthLabels, [{
        label: 'Demissões',
        data: getValues(yearlyData, 'demissoes'),
        backgroundColor: chartColors.danger,
        borderRadius: 4
    }]);

    // Demissões Motivos Diários (Stacked Bar)
    let stackedLabels = [];
    let dsEmpresa = [];
    let dsPedido = [];
    let dsExperiencia = [];
    let dsJustaCausa = [];
    
    if (currentData && !currentData.isEmpty && currentData.demissoesMotivosDiarios) {
        for(let i=1; i<=31; i++) {
            stackedLabels.push('Dia ' + i);
            let m = currentData.demissoesMotivosDiarios[i] || {empresa:0, pedido:0, experiencia:0, justa_causa:0};
            dsEmpresa.push(m.empresa || 0);
            dsPedido.push(m.pedido || 0);
            dsExperiencia.push(m.experiencia || 0);
            dsJustaCausa.push(m.justa_causa || 0);
        }
    }
    
    renderBarChart('chartVgDemissoesMotivosDiarios', stackedLabels, [
        { label: 'Empresa', data: dsEmpresa, backgroundColor: chartColors.primary },
        { label: 'Pedido', data: dsPedido, backgroundColor: chartColors.info },
        { label: 'Experiência', data: dsExperiencia, backgroundColor: chartColors.warning },
        { label: 'Justa Causa', data: dsJustaCausa, backgroundColor: chartColors.danger }
    ], { stacked: true });

    // Motivos de Demissão (Doughnut)
    let motivosLabels = ['Empresa', 'Pedido', 'Experiência', 'Justa Causa'];
    let motivosData = [0, 0, 0, 0];
    if (currentData && !currentData.isEmpty && currentData.demissoesMotivos) {
        motivosData = [
            currentData.demissoesMotivos.empresa || 0,
            currentData.demissoesMotivos.pedido || 0,
            currentData.demissoesMotivos.experiencia || 0,
            currentData.demissoesMotivos.justa_causa || 0
        ];
    }
    renderBarChart('chartVgDemissoesMotivos', motivosLabels, [{
        label: 'Motivos',
        data: motivosData,
        backgroundColor: [chartColors.primary, chartColors.info, chartColors.warning, chartColors.danger]
    }], { type: 'doughnut', plugins: { legend: { display: true, position: 'right' } } });

    // Top Demissoes (Qtd)
    let topDemissoesLabels = [];
    let topDemissoesData = [];
    if (currentData && !currentData.isEmpty && currentData.topClientesDemissoes) {
        const sorted = currentData.topClientesDemissoes.sort((a,b) => b.demissoes - a.demissoes);
        topDemissoesLabels = sorted.map(c => c.nome);
        topDemissoesData = sorted.map(c => c.demissoes);
    }
    renderBarChart('chartVgTopDemissoes', topDemissoesLabels, [{
        label: 'Demissões',
        data: topDemissoesData,
        backgroundColor: chartColors.danger,
        borderRadius: 4
    }], { indexAxis: 'y' });

    // Top Demissoes (%)
    let topDemissoesPercLabels = [];
    let topDemissoesPercData = [];
    if (currentData && !currentData.isEmpty && currentData.topClientesDemissoesPerc) {
        const sorted = currentData.topClientesDemissoesPerc.sort((a,b) => b.percentual - a.percentual);
        topDemissoesPercLabels = sorted.map(c => c.nome);
        topDemissoesPercData = sorted.map(c => c.percentual);
    }
    renderBarChart('chartVgTopDemissoesPerc', topDemissoesPercLabels, [{
        label: 'Demissões (%)',
        data: topDemissoesPercData,
        backgroundColor: chartColors.warning,
        borderRadius: 4
    }], { indexAxis: 'y', isPercentage: true });
}

function renderReservaOperacional(currentData) {
    const container = document.getElementById('reserva-container');
    if (!container) return;
    
    if (!currentData || currentData.isEmpty || !currentData.reservas) {
        container.innerHTML = '<p class="text-muted">Sem dados de reserva para este mês.</p>';
        return;
    }

    const { limpeza, portariaDia, portariaNoite } = currentData.reservas;
    
    container.innerHTML = '';
    
    const criarCartao = (titulo, dados, icone, classe) => {
        let linhas = '';
        dados.forEach(item => {
            const dif = item.atual - item.ideal;
            const sinal = dif > 0 ? '+' : '';
            const pillClass = dif >= 0 ? 'positivo' : 'negativo';
            linhas += `
                <tr>
                    <td>${item.escala}</td>
                    <td>${item.atual}</td>
                    <td>${item.ideal}</td>
                    <td><span class="reserva-pill ${pillClass}">${sinal}${dif}</span></td>
                </tr>
            `;
        });

        return `
            <div class="reserva-card">
                <div class="reserva-header ${classe}">
                    <i class="fa-solid ${icone}"></i> ${titulo}
                </div>
                <table class="reserva-table">
                    <thead>
                        <tr>
                            <th>Escala</th>
                            <th>Atual</th>
                            <th>Ideal</th>
                            <th>Dif.</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${linhas}
                    </tbody>
                </table>
            </div>
        `;
    };

    container.innerHTML += criarCartao('LIMPEZA', limpeza, 'fa-broom', 'limpeza');
    container.innerHTML += criarCartao('PORTARIA DIA', portariaDia, 'fa-sun', 'portaria-dia');
    container.innerHTML += criarCartao('PORTARIA NOITE', portariaNoite, 'fa-moon', 'portaria-noite');
}

function updateDivergenciaBlocks(currentData) {
    if(currentData && !currentData.isEmpty) {
        document.getElementById('block-div-total').textContent = currentData.divergenciaFuncao || 0;
        document.getElementById('block-div-resolvidas').textContent = currentData.divergenciasResolvidas || 0;
    } else {
        document.getElementById('block-div-total').textContent = 0;
        document.getElementById('block-div-resolvidas').textContent = 0;
    }
}

function renderContelePodium(currentData) {
    const container = document.getElementById('contele-podium');
    container.innerHTML = ''; // Limpar
    
    if (!currentData || currentData.isEmpty || !currentData.supervisoresContele) {
        container.innerHTML = '<p class="text-muted">Sem dados no mês selecionado para montar o pódio.</p>';
        return;
    }

    const sorted = [...currentData.supervisoresContele].sort((a,b) => b.visitas - a.visitas).slice(0, 3);
    
    if (sorted.length === 0) return;

    // Rearranjar para pódio visual: [2º, 1º, 3º]
    const podiumOrder = [];
    if(sorted[1]) podiumOrder.push({ pos: 2, data: sorted[1] });
    if(sorted[0]) podiumOrder.push({ pos: 1, data: sorted[0] });
    if(sorted[2]) podiumOrder.push({ pos: 3, data: sorted[2] });

    podiumOrder.forEach(item => {
        const imgSrc = item.data.foto && item.data.foto.trim() !== '' 
            ? `assets/img/supervisores/${item.data.foto}` 
            : 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2394a3b8"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';

        const html = `
            <div class="podium-item pos-${item.pos}">
                <img src="${imgSrc}" class="podium-avatar" alt="Supervisor" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 24 24\\' fill=\\'%2394a3b8\\'><path d=\\'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z\\'/></svg>'">
                <div class="podium-base">
                    <span class="podium-score">${item.data.visitas}</span>
                    <span style="font-size: 0.7rem; opacity: 0.8;">Visitas</span>
                </div>
                <div class="podium-name">${item.data.nome}</div>
            </div>
        `;
        container.innerHTML += html;
    });
}

function renderCalendar(idPrefix, dataObj, yearStr, monthStr, typeName) {
    const year = parseInt(yearStr);
    const month = parseInt(monthStr) - 1; // 0-11
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 (Dom) a 6 (Sab)
    
    let total = 0;
    const weeklyTotals = [0, 0, 0, 0, 0, 0];
    
    // Calcular totais e heat threshold
    let maxDayVal = 1;
    for(let i = 1; i <= daysInMonth; i++) {
        const val = dataObj[i] || 0;
        total += val;
        if(val > maxDayVal) maxDayVal = val;
        
        // Calcular semana
        const offsetDate = firstDayIndex + i - 1;
        const weekIndex = Math.floor(offsetDate / 7);
        weeklyTotals[weekIndex] += val;
    }
    
    const media = daysInMonth > 0 ? Math.round(total / daysInMonth) : 0;
    
    // Atualizar KPIs do calendario
    document.getElementById(`${idPrefix}-total`).textContent = total;
    document.getElementById(`${idPrefix}-media`).textContent = media;
    
    // Renderizar Blocos de Semana
    const semanasContainer = document.getElementById(`${idPrefix}-semanas`);
    semanasContainer.innerHTML = '';
    weeklyTotals.forEach((val, idx) => {
        // Ignorar semana que nao teve dias (semanas no final de meses curtos)
        if(idx * 7 >= firstDayIndex + daysInMonth && val === 0) return;
        
        semanasContainer.innerHTML += `
            <div class="cal-week-block">
                <h4>Semana ${idx + 1}</h4>
                <span>${val}</span>
            </div>
        `;
    });
    
    // Renderizar Grid Mensal
    const gridContainer = document.getElementById(`${idPrefix}-grid`);
    gridContainer.innerHTML = `
        <div style="font-weight: bold; color: var(--text-muted); margin-bottom: 10px;">Dom</div>
        <div style="font-weight: bold; color: var(--text-muted); margin-bottom: 10px;">Seg</div>
        <div style="font-weight: bold; color: var(--text-muted); margin-bottom: 10px;">Ter</div>
        <div style="font-weight: bold; color: var(--text-muted); margin-bottom: 10px;">Qua</div>
        <div style="font-weight: bold; color: var(--text-muted); margin-bottom: 10px;">Qui</div>
        <div style="font-weight: bold; color: var(--text-muted); margin-bottom: 10px;">Sex</div>
        <div style="font-weight: bold; color: var(--text-muted); margin-bottom: 10px;">Sab</div>
    `;
    
    // Dias vazios inicio do mes
    for(let i = 0; i < firstDayIndex; i++) {
        gridContainer.innerHTML += `<div class="cal-day-cell cal-empty"></div>`;
    }
    
    // Dias reais
    for(let i = 1; i <= daysInMonth; i++) {
        const val = dataObj[i] || 0;
        
        // Calcular classe de calor (0 a 5)
        let heatClass = 'heat-0';
        if (val > 0) {
            let heat = Math.ceil((val / maxDayVal) * 5);
            if (heat < 1) heat = 1;
            if (heat > 5) heat = 5;
            heatClass = `heat-${heat}`;
        }

        gridContainer.innerHTML += `
            <div class="cal-day-cell ${heatClass}">
                <span class="cal-day-num">${i}</span>
                <span class="cal-day-val">${val}</span>
            </div>
        `;
    }
}

// ===================== RESUMO ANUAL & KPIs =====================
function renderResumoAnual(yearlyData, monthLabels) {
    let totalFaltas = 0, totalDemissoes = 0, totalCustoExtra = 0;
    let totalDivOcorridas = 0, totalDivResolvidas = 0;
    let motivosAnual = { empresa: 0, pedido: 0, experiencia: 0, justa_causa: 0 };
    let clientesMap = {};

    yearlyData.forEach(d => {
        if (d.isEmpty) return;
        totalFaltas += d.faltas || 0;
        totalDemissoes += d.demissoes || 0;
        totalCustoExtra += (d.custo99 || 0) + (d.gastosFolgas || 0) + (d.horasExtrasGeral || 0);
        totalDivOcorridas += d.divergenciaFuncao || 0;
        totalDivResolvidas += d.divergenciasResolvidas || 0;

        if (d.demissoesMotivos) {
            motivosAnual.empresa += d.demissoesMotivos.empresa || 0;
            motivosAnual.pedido += d.demissoesMotivos.pedido || 0;
            motivosAnual.experiencia += d.demissoesMotivos.experiencia || 0;
            motivosAnual.justa_causa += d.demissoesMotivos.justa_causa || 0;
        }
        if (d.topClientesFaltas) {
            d.topClientesFaltas.forEach(c => {
                clientesMap[c.nome] = (clientesMap[c.nome] || 0) + c.faltas;
            });
        }
    });

    // SLAs Anuais: derivados dos limites mensais reais da Embraps
    // Faltas: 1.200/mês × 12 = 14.400/ano
    // Demissões: 100/mês × 12 = 1.200/ano
    // Custo extra (App99 + Folgas + HE): (18.000 + 100.000 + 23.000) × 12 = 1.692.000/ano
    // Divergências: 100% de resolução sempre
    const SLA_FALTAS = 14400;       // 1.200/mês × 12
    const SLA_DEMISSOES = 1200;     // 100/mês × 12
    const SLA_CUSTOS = 1692000;     // (18k+100k+23k) × 12
    const SLA_DIV_PERC = 100;       // 100% de resolução
    const taxaDiv = totalDivOcorridas > 0 ? Math.round((totalDivResolvidas / totalDivOcorridas) * 100) : 100;

    function setKPICard(cardId, valueElId, slaElId, value, displayVal, limit, lowerIsBetter) {
        const card = document.getElementById(cardId);
        const sla = document.getElementById(slaElId);
        const valEl = document.getElementById(valueElId);
        if (!card || !sla || !valEl) return;
        valEl.textContent = displayVal;
        let status, slaLabel;
        if (lowerIsBetter) {
            const ratio = value / limit;
            if (ratio <= 0.75) { status = 'sla-ok'; slaLabel = '✅ Dentro do SLA'; }
            else if (ratio <= 1) { status = 'sla-warn'; slaLabel = '⚠️ Próximo do limite'; }
            else { status = 'sla-danger'; slaLabel = '🔴 SLA Excedido'; }
        } else {
            if (value >= limit) { status = 'sla-ok'; slaLabel = '✅ SLA Atingido'; }
            else if (value >= limit * 0.85) { status = 'sla-warn'; slaLabel = '⚠️ Próximo da meta'; }
            else { status = 'sla-danger'; slaLabel = '🔴 Abaixo do SLA'; }
        }
        card.className = `anual-kpi-card ${status}`;
        sla.className = `anual-kpi-sla ${status.replace('sla-', '')}`;
        sla.textContent = slaLabel;
    }

    setKPICard('kpi-anual-faltas-card',     'kpi-anual-faltas',     'kpi-anual-faltas-sla',     totalFaltas,     totalFaltas.toLocaleString('pt-BR'), SLA_FALTAS,    true);
    setKPICard('kpi-anual-demissoes-card',  'kpi-anual-demissoes',  'kpi-anual-demissoes-sla',  totalDemissoes,  totalDemissoes.toLocaleString('pt-BR'), SLA_DEMISSOES, true);
    setKPICard('kpi-anual-custos-card',     'kpi-anual-custos',     'kpi-anual-custos-sla',     totalCustoExtra, formatCurrency(totalCustoExtra), SLA_CUSTOS,    true);
    setKPICard('kpi-anual-divergencia-card','kpi-anual-divergencia','kpi-anual-divergencia-sla', taxaDiv,         taxaDiv + '%', SLA_DIV_PERC, false);

    // Sub-KPIs de motivos de demissão
    const motivosRef = { empresa: 9*12, pedido: 50*12, experiencia: 16*12, justa_causa: 10*12 };

    // Gráfico: Tendência de Custos (3 linhas)
    const ctxCustos = document.getElementById('chartAnualCustos');
    if (ctxCustos) {
        if (charts['chartAnualCustos']) charts['chartAnualCustos'].destroy();
        charts['chartAnualCustos'] = new Chart(ctxCustos.getContext('2d'), {
            type: 'line',
            data: {
                labels: monthLabels,
                datasets: [
                    { label: 'App 99 (R$)', data: yearlyData.map(d => d.isEmpty ? 0 : (d.custo99 || 0)), borderColor: chartColors.app99, backgroundColor: 'rgba(250,204,21,0.08)', borderWidth: 2.5, tension: 0.4, fill: true, pointRadius: 4 },
                    { label: 'Folgas Trabalhadas (R$)', data: yearlyData.map(d => d.isEmpty ? 0 : (d.gastosFolgas || 0)), borderColor: chartColors.success, backgroundColor: 'rgba(16,185,129,0.08)', borderWidth: 2.5, tension: 0.4, fill: true, pointRadius: 4 },
                    { label: 'Horas Extras (R$)', data: yearlyData.map(d => d.isEmpty ? 0 : (d.horasExtrasGeral || 0)), borderColor: chartColors.danger, backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 2.5, tension: 0.4, fill: true, pointRadius: 4 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' }, datalabels: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${formatCurrency(ctx.raw)}` } } },
                scales: { y: { beginAtZero: true, ticks: { callback: v => 'R$' + (v / 1000).toFixed(0) + 'k' } } }
            }
        });
    }

    // Gráfico: Termômetro Faltas x Demissões
    const ctxFD = document.getElementById('chartAnualFaltasDemissoes');
    if (ctxFD) {
        if (charts['chartAnualFaltasDemissoes']) charts['chartAnualFaltasDemissoes'].destroy();
        charts['chartAnualFaltasDemissoes'] = new Chart(ctxFD.getContext('2d'), {
            type: 'bar',
            data: {
                labels: monthLabels,
                datasets: [
                    { label: 'Faltas', data: yearlyData.map(d => d.isEmpty ? 0 : (d.faltas || 0)), backgroundColor: chartColors.warning, borderRadius: 4 },
                    { label: 'Demissões', data: yearlyData.map(d => d.isEmpty ? 0 : (d.demissoes || 0)), backgroundColor: chartColors.danger, borderRadius: 4 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' }, datalabels: { display: ctx => ctx.dataset.data[ctx.dataIndex] > 0, color: '#0f172a', font: { weight: 'bold', size: 10 } } },
                scales: { y: { beginAtZero: true } }
            }
        });
    }

    // Gráfico: Punições Anuais
    renderBarChart('chartAnualPunicoes', monthLabels, [{ label: 'Punições', data: yearlyData.map(d => d.isEmpty ? 0 : (d.punicoes || 0)), backgroundColor: chartColors.warning, borderRadius: 4 }]);

    // Gráfico: Divergências Anuais
    renderBarChart('chartAnualDivergencias', monthLabels, [
        { label: 'Ocorridas', data: yearlyData.map(d => d.isEmpty ? 0 : (d.divergenciaFuncao || 0)), backgroundColor: chartColors.danger, borderRadius: 4 },
        { label: 'Resolvidas', data: yearlyData.map(d => d.isEmpty ? 0 : (d.divergenciasResolvidas || 0)), backgroundColor: chartColors.success, borderRadius: 4 }
    ]);

    // Gráfico: Motivos de Demissão Acumulados (Barras Horizontais)
    const ctxMotivos = document.getElementById('chartAnualMotivos');
    if (ctxMotivos) {
        if (charts['chartAnualMotivos']) charts['chartAnualMotivos'].destroy();
        charts['chartAnualMotivos'] = new Chart(ctxMotivos.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['Demissão Empresa', 'Pedido de Demissão', 'Término de Experiência', 'Justa Causa'],
                datasets: [{ label: 'Acumulado no Ano', data: [motivosAnual.empresa, motivosAnual.pedido, motivosAnual.experiencia, motivosAnual.justa_causa], backgroundColor: [chartColors.primary, chartColors.info, chartColors.warning, chartColors.danger], borderRadius: 6 }]
            },
            options: {
                indexAxis: 'y',
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, datalabels: { display: ctx => ctx.dataset.data[ctx.dataIndex] > 0, color: '#fff', font: { weight: 'bold' } } },
                scales: { x: { beginAtZero: true } }
            }
        });
    }

    // Ranking Top Ofensores do Ano
    const tbody = document.getElementById('tbody-top-ofensores');
    if (tbody) {
        const sorted = Object.entries(clientesMap).map(([nome, faltas]) => ({ nome, faltas })).sort((a, b) => b.faltas - a.faltas).slice(0, 10);
        const maxFaltas = sorted.length > 0 ? sorted[0].faltas : 1;
        const grandTotal = sorted.reduce((acc, c) => acc + c.faltas, 0) || 1;
        const medals = ['🥇', '🥈', '🥉'];
        tbody.innerHTML = sorted.length === 0
            ? '<tr><td colspan="4" style="text-align:center; color: var(--text-muted); padding: 20px;">Nenhum dado disponível para o ano selecionado.</td></tr>'
            : sorted.map((c, i) => {
                const perc = ((c.faltas / grandTotal) * 100).toFixed(1);
                const barW = Math.round((c.faltas / maxFaltas) * 100);
                const pos = i < 3 ? medals[i] : (i + 1);
                return `<tr>
                    <td style="text-align:center; font-weight:bold;">${pos}</td>
                    <td>${c.nome}</td>
                    <td style="text-align:center; font-weight:bold;">${c.faltas.toLocaleString('pt-BR')}</td>
                    <td><div class="ofensor-perc-row"><div class="ofensor-bar-bg"><div class="ofensor-bar-fill" style="width:${barW}%"></div></div><span style="font-size:0.8rem;font-weight:600;white-space:nowrap;">${perc}%</span></div></td>
                </tr>`;
            }).join('');
    }
}
