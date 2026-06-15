// Registrar plugin de DataLabels globalmente
Chart.register(ChartDataLabels);

let charts = {};
let tvModeInterval = null;
let tvScrollInterval = null;
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
        if (!sidebar) return;
        sidebar.classList.add('open');
        if (overlay) overlay.classList.add('active');
    }
    function closeSidebar() {
        if (!sidebar) return;
        sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('active');
    }

    if (menuToggle) {
        menuToggle.addEventListener('click', openSidebar);
        menuToggle.addEventListener('touchstart', function(e) {
            e.preventDefault();
            openSidebar();
        }, { passive: false });
    }
    if (overlay) {
        overlay.addEventListener('click', closeSidebar);
        overlay.addEventListener('touchstart', function(e) {
            e.preventDefault();
            closeSidebar();
        }, { passive: false });
    }

    // Navegação Sidebar (Tabs)
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = e.currentTarget.getAttribute('href');
            if (href && !href.startsWith('#')) return; // Deixa o navegador seguir o link se não for uma âncora (#)

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

            // Força atualização da agenda ao trocar de aba
            if (targetId === 'vg-agenda-sla') {
                updateAgendaSummary();
            }
            if (targetId === 'vg-pos-venda') {
                if (typeof pv_loadData === 'function') pv_loadData();
            }
            if (targetId === 'resumo-anual') {
                renderPvSlaChart();
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

    // Adicionar botão de imprimir e IA nas seções
    document.querySelectorAll('.section-title').forEach(title => {
        const btnContainer = document.createElement('div');
        btnContainer.className = 'section-title-actions';
        btnContainer.style.marginLeft = 'auto';
        btnContainer.style.display = 'flex';
        btnContainer.style.gap = '10px';
        btnContainer.style.alignItems = 'center';

        const aiBtn = document.createElement('button');
        aiBtn.className = 'btn-ai-assistant';
        aiBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i>';
        aiBtn.title = "Analisar com IA Gemini";
        const sectionId = title.closest('section')?.id || 'geral';
        aiBtn.onclick = () => openGeminiChat(sectionId);

        const printBtn = document.createElement('button');
        printBtn.className = 'btn-primary print-btn';
        printBtn.style.fontSize = '0.9rem';
        printBtn.style.padding = '8px 16px';
        printBtn.innerHTML = '<i class="fa-solid fa-print"></i> Imprimir A4';
        printBtn.onclick = () => window.print();

        btnContainer.appendChild(aiBtn);
        btnContainer.appendChild(printBtn);
        title.appendChild(btnContainer);
    });

    // Update functions
    updateDashboard();
    
    // Esperar Firebase para a agenda summary
    setTimeout(() => {
        updateAgendaSummary();
    }, 1500);

    // Botão de Enviar Relatório (EmailJS)
    const btnReport = document.getElementById('btn-email-report');
    if (btnReport) {
        btnReport.addEventListener('click', async () => {
            const year = document.getElementById('filter-year').value;
            const month = document.getElementById('filter-month').value;
            
            // Buscar dados brutos para o relatório
            const data = await getDataByMonth(year, month);
            if (!data) {
                alert("Não há dados carregados para este mês para gerar o relatório.");
                return;
            }

            // Calcular totais para o e-mail
            const resTotal = (parseInt(data.reservasDiurna) || 0) + (parseInt(data.reservasNoturna) || 0) + (parseInt(data.reservasLimpeza) || 0);
            
            const ftPortaria = (parseFloat(data.folgasPortaria_1) || 0) + (parseFloat(data.folgasPortaria_2) || 0) + 
                               (parseFloat(data.folgasPortaria_3) || 0) + (parseFloat(data.folgasPortaria_4) || 0);
            
            const ftLimpeza = (parseFloat(data.folgasLimpeza_1) || 0) + (parseFloat(data.folgasLimpeza_2) || 0) + 
                              (parseFloat(data.folgasLimpeza_3) || 0) + (parseFloat(data.folgasLimpeza_4) || 0);
            
            const agendaSla = document.getElementById('kpi-agenda-sla')?.textContent || "100%";

            const reportParams = {
                reservaTotal: resTotal,
                folgaPortaria: ftPortaria.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
                folgaLimpeza: ftLimpeza.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
                agendaSla: agendaSla.replace('%', '')
            };

            btnReport.disabled = true;
            btnReport.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';
            
            await sendWeeklyReportEmail(reportParams);
            
            btnReport.disabled = false;
            btnReport.innerHTML = '<i class="fa-solid fa-envelope"></i> Enviar Relatório';
        });
    }
});

async function updateAgendaSummary() {
    // Delegate to agenda.js which has the correct field names (name, operadorId)
    if (typeof ag_loadSummaryForDashboard === 'function') {
        await ag_loadSummaryForDashboard();
    }
}

function toggleTvMode() {
    const btn = document.getElementById('btn-tv-mode');
    
    if (tvModeInterval) {
        // Parar Modo TV
        clearInterval(tvModeInterval);
        tvModeInterval = null;
        
        if (tvScrollInterval) {
            clearInterval(tvScrollInterval);
            tvScrollInterval = null;
        }

        btn.innerHTML = '<i class="fa-solid fa-tv"></i> Modo TV';
        btn.classList.remove('bg-danger');
        btn.style.backgroundColor = 'var(--accent-color)';
        
        // Sair do modo TV (remove classe)
        document.body.classList.remove('tv-mode');
        
        // Sair de tela cheia
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(err => console.log(err));
        }
        
    } else {
        // Iniciar Modo TV
        btn.innerHTML = '<i class="fa-solid fa-stop"></i> Parar TV';
        btn.style.backgroundColor = 'var(--danger)';
        
        // Entrar no modo TV (adiciona classe)
        document.body.classList.add('tv-mode');
        
        // Entrar em tela cheia (opcional mas recomendado para TV)
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
            elem.requestFullscreen().catch(err => console.log(err));
        }
        
        const navLinks = Array.from(document.querySelectorAll('.nav-link'));
        let currentIndex = navLinks.findIndex(l => l.parentElement.classList.contains('active'));
        if (currentIndex === -1) currentIndex = 0;
        
        // Voltar ao topo imediatamente ao iniciar
        window.scrollTo({ top: 0, behavior: 'instant' });
        const mainContentStart = document.querySelector('.main-content');
        if (mainContentStart) {
            mainContentStart.scrollTo({ top: 0, behavior: 'instant' });
        }
        
        const switchTab = () => {
            if (navLinks[currentIndex] && navLinks[currentIndex].getAttribute('href') === '#vg-pos-venda') {
                currentIndex = 0;
            } else {
                currentIndex++;
                if (currentIndex >= navLinks.length) {
                    currentIndex = 0;
                }
            }
            
            // Simular click no link
            navLinks[currentIndex].click();
            
            // Voltar ao topo imediatamente ao trocar a aba
            window.scrollTo({ top: 0, behavior: 'instant' });
            const mainContent = document.querySelector('.main-content');
            if (mainContent) {
                mainContent.scrollTo({ top: 0, behavior: 'instant' });
            }
        };

        // Scroll suave dentro da aba
        if (tvScrollInterval) clearInterval(tvScrollInterval);
        tvScrollInterval = setInterval(() => {
            window.scrollBy(0, 1);
            const mainContent = document.querySelector('.main-content');
            if (mainContent) {
                mainContent.scrollBy(0, 1);
            }
        }, 15);

        // Troca de aba a cada 50 segundos
        tvModeInterval = setInterval(switchTab, 50000);
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
    verificarAlertasDeVagas();
    const currentData = yearlyData.find(d => d.month === month);
    window.currentSelectedData = currentData;

    updateKPIs(currentData);
    checkAlerts(currentData, month);
    checkExperienceAlerts();
    renderCharts(yearlyData, monthLabels, currentData);
    renderContelePodium(currentData);
    updateDivergenciaBlocks(currentData);
    renderReservaOperacional(currentData);

    // Render Calendars
    const faltasDiurna = (currentData && currentData.faltasDiurna) ? currentData.faltasDiurna : {};
    const faltasNoturna = (currentData && currentData.faltasNoturna) ? currentData.faltasNoturna : {};
    const faltasLimpeza = (currentData && currentData.faltasLimpeza) ? currentData.faltasLimpeza : {};
    const demissoesDiarias = (currentData && currentData.demissoesDiarias) ? currentData.demissoesDiarias : {};

    renderCalendar('cal-faltas-diurna', faltasDiurna, year, month, 'Faltas');
    renderCalendar('cal-faltas-noturna', faltasNoturna, year, month, 'Faltas');
    renderCalendar('cal-faltas-limpeza', faltasLimpeza, year, month, 'Faltas');
    renderCalendar('cal-demissoes', demissoesDiarias, year, month, 'Demissões');

    // Visão Geral - Coringas
    renderBarChart('chartCoringasTreinamentos', monthLabels, [{
        label: 'Treinamentos',
        data: getValues(yearlyData, 'totalTreinamentos'),
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        borderColor: '#10b981',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#10b981'
    }], { type: 'line' });

    if (currentData && currentData.coringasPostos) {
        renderBarChart('chartCoringasPostos', currentData.coringasPostos.map(i => i.nome), [{
            label: 'Postos', data: currentData.coringasPostos.map(i => i.qtd), backgroundColor: '#10b981', borderRadius: 4
        }], { type: 'bar' });
    } else { renderBarChart('chartCoringasPostos', [], []); }

    if (currentData && currentData.coringasUsuarios) {
        renderBarChart('chartCoringasUsuarios', currentData.coringasUsuarios.map(i => i.nome), [{
            label: 'Usuários', data: currentData.coringasUsuarios.map(i => i.qtd), backgroundColor: '#059669', borderRadius: 4
        }], { type: 'bar' });
    } else { renderBarChart('chartCoringasUsuarios', [], []); }


    renderResumoAnual(yearlyData, monthLabels);
    renderResumoAnualOS(year, monthLabels);
    renderResumoVagasAnual();
    updateAgendaSummary();
}

// --- NOVO: Alerta de Experiência no Dashboard ---
async function checkExperienceAlerts() {
    if (typeof db === 'undefined' || !db) return;
    try {
        const snapshot = await db.collection('experiencia').where('status', '==', 'PENDENTE').get();
        const today = new Date();
        today.setHours(0,0,0,0);
        
        let count = 0;
        snapshot.forEach(doc => {
            const d = doc.data();
            const exp1 = new Date(d.exp1);
            const exp2 = new Date(d.exp2);
            const diff1 = (exp1 - today) / (1000*60*60*24);
            const diff2 = (exp2 - today) / (1000*60*60*24);
            
            if ((diff1 >= 0 && diff1 <= 10) || (diff2 >= 0 && diff2 <= 10)) {
                count++;
            }
        });

        const alertsArea = document.getElementById('alerts-container');
        if (count > 0 && alertsArea) {
            const div = document.createElement('div');
            div.style.background = '#fffbeb';
            div.style.borderLeft = '6px solid #f59e0b';
            div.style.padding = '1rem';
            div.style.borderRadius = '8px';
            div.style.marginBottom = '1rem';
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.style.alignItems = 'center';
            div.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            div.innerHTML = `
                <div style="display:flex; align-items:center; gap:12px;">
                    <i class="fa-solid fa-triangle-exclamation" style="color:#f59e0b; font-size:1.2rem;"></i>
                    <span style="color:#92400e; font-weight:600;">Atenção: Você tem ${count} avaliações de experiência vencendo nos próximos 10 dias.</span>
                </div>
                <a href="exp.html" style="background:#f59e0b; color:white; padding:5px 12px; border-radius:6px; text-decoration:none; font-size:0.8rem; font-weight:bold;">Resolver Agora</a>
            `;
            alertsArea.prepend(div);
        }
    } catch (err) {
        console.error("Erro ao checar alertas de experiência:", err);
    }
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
        maintainAspectRatio: false,
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
    
    if (currentData && !currentData.isEmpty) {
        gastosPortaria = [
            currentData.folgasPortaria_1 || 0,
            currentData.folgasPortaria_2 || 0,
            currentData.folgasPortaria_3 || 0,
            currentData.folgasPortaria_4 || 0
        ];
        gastosLimpeza = [
            currentData.folgasLimpeza_1 || 0,
            currentData.folgasLimpeza_2 || 0,
            currentData.folgasLimpeza_3 || 0,
            currentData.folgasLimpeza_4 || 0
        ];
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
        backgroundColor: 'rgba(34, 197, 94, 0.2)',
        borderColor: chartColors.success,
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: chartColors.success
    }], { isCurrency: true, type: 'line' });

    if (currentData && currentData.folgasMotivos) {
        const labels = currentData.folgasMotivos.map(i => i.nome);
        const vals = currentData.folgasMotivos.map(i => i.valor);
        renderBarChart('chartVgFolgasMotivos', labels, [{
            label: 'Motivo (R$)', data: vals, backgroundColor: chartColors.success, borderRadius: 4
        }], { isCurrency: true, type: 'bar' });
    } else { renderBarChart('chartVgFolgasMotivos', [], []); }

    // Punições
    renderBarChart('chartVgPunicoes', monthLabels, [{
        label: 'Quantidade',
        data: getValues(yearlyData, 'punicoes'),
        backgroundColor: chartColors.danger,
        borderRadius: 4
    }]);

    if (currentData && currentData.punicoesMotivos) {
        renderBarChart('chartVgPunicoesMotivos', currentData.punicoesMotivos.map(i => i.nome), [{
            label: 'Qtd', data: currentData.punicoesMotivos.map(i => i.qtd), backgroundColor: chartColors.danger, borderRadius: 4
        }], { type: 'bar' });
    } else { renderBarChart('chartVgPunicoesMotivos', [], []); }

    if (currentData && currentData.punicoesTipos) {
        renderBarChart('chartVgPunicoesTipos', currentData.punicoesTipos.map(i => i.nome), [{
            label: 'Qtd', data: currentData.punicoesTipos.map(i => i.qtd), backgroundColor: chartColors.warning, borderRadius: 4
        }], { type: 'bar' });
    } else { renderBarChart('chartVgPunicoesTipos', [], []); }

    // Ponto
    renderBarChart('chartVgPonto', monthLabels, [{
        label: 'Pendências',
        data: getValues(yearlyData, 'pendenciasPonto'),
        backgroundColor: '#64748b',
        borderRadius: 4
    }]);

    if (currentData && currentData.pontoSupervisores) {
        renderBarChart('chartVgPontoSupervisor', currentData.pontoSupervisores.map(i => i.nome), [{
            label: 'Pendências', data: currentData.pontoSupervisores.map(i => i.qtd), backgroundColor: '#94a3b8', borderRadius: 4
        }], { type: 'bar' });
    } else { renderBarChart('chartVgPontoSupervisor', [], []); }

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

    if (currentData && currentData.app99Motivos) {
        renderBarChart('chartVgApp99Motivos', currentData.app99Motivos.map(i => i.nome), [{
            label: 'Motivo (R$)', data: currentData.app99Motivos.map(i => i.valor), backgroundColor: '#eab308', borderRadius: 4
        }], { isCurrency: true, type: 'bar' });
    } else { renderBarChart('chartVgApp99Motivos', [], []); }

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

    if (currentData && currentData.vtCidades) {
        renderBarChart('chartVgVtCidades', currentData.vtCidades.map(i => i.nome), [{
            label: 'Cidade (R$)', data: currentData.vtCidades.map(i => i.valor), backgroundColor: chartColors.secondary, borderRadius: 4
        }], { isCurrency: true, type: 'bar' });
    } else { renderBarChart('chartVgVtCidades', [], []); }

    if (currentData && currentData.vtEscalas) {
        renderBarChart('chartVgVtEscalas', currentData.vtEscalas.map(i => i.nome), [{
            label: 'Escala (R$)', data: currentData.vtEscalas.map(i => i.valor), backgroundColor: chartColors.info, borderRadius: 4
        }], { isCurrency: true, type: 'bar' });
    } else { renderBarChart('chartVgVtEscalas', [], []); }

    // Contele
    renderBarChart('chartVgContele', monthLabels, [
        {
            label: 'Visitas',
            data: getValues(yearlyData, 'visitasContele'),
            backgroundColor: chartColors.info,
            borderRadius: 4,
            order: 2
        },
        {
            label: 'Supervisores',
            data: getValues(yearlyData, 'totalSupervisoresContele'),
            borderColor: chartColors.danger,
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            type: 'line',
            borderWidth: 2,
            pointRadius: 3,
            order: 1,
            datalabels: { display: true, align: 'top', anchor: 'end' }
        }
    ]);

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
    }], { type: 'doughnut', plugins: { legend: { display: true, position: window.innerWidth < 768 ? 'bottom' : 'right' } } });

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

    // Movimentação Operacional
    if (currentData && !currentData.isEmpty) {
        document.getElementById('kpi-movimentacao-total').textContent = currentData.movTotal || 0;

        let movMotivosLabels = [];
        let movMotivosData = [];
        if (currentData.movMotivos) {
            currentData.movMotivos.forEach(m => {
                movMotivosLabels.push(m.nome);
                movMotivosData.push(m.qtd);
            });
        }
        renderBarChart('chartMovMotivos', movMotivosLabels, [{
            label: 'Motivos',
            data: movMotivosData,
            backgroundColor: chartColors.primary,
            borderRadius: 4
        }]);

        let movSupLabels = [];
        let movSupData = [];
        if (currentData.movSupervisores) {
            currentData.movSupervisores.forEach(s => {
                movSupLabels.push(s.nome);
                movSupData.push(s.qtd);
            });
        }
        renderBarChart('chartMovSupervisores', movSupLabels, [{
            label: 'Movimentações',
            data: movSupData,
            backgroundColor: chartColors.secondary,
            borderRadius: 4
        }]);

        let movTranspLabels = [];
        let movTranspData = [];
        if (currentData.movTransportes) {
            currentData.movTransportes.forEach(t => {
                movTranspLabels.push(t.nome);
                movTranspData.push(t.qtd);
            });
        }
        renderBarChart('chartMovTransportes', movTranspLabels, [{
            label: 'Transportes',
            data: movTranspData,
            backgroundColor: chartColors.info,
            borderRadius: 4
        }]);
    } else {
        document.getElementById('kpi-movimentacao-total').textContent = 0;
        renderBarChart('chartMovMotivos', [], []);
        renderBarChart('chartMovSupervisores', [], []);
        renderBarChart('chartMovTransportes', [], []);
    }
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
        let totalAtual = 0;
        let totalIdeal = 0;
        let linhas = '';
        
        dados.forEach(item => {
            totalAtual += (item.atual || 0);
            totalIdeal += (item.ideal || 0);
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
                    <div style="display:flex; align-items:center; gap:10px;">
                        <i class="fa-solid ${icone}"></i> ${titulo}
                    </div>
                    <div style="display:flex; gap:10px; margin-left:auto;">
                        <div class="reserva-total-box">
                            <span class="label">Atual</span>
                            <span class="value">${totalAtual}</span>
                        </div>
                        <div class="reserva-total-box">
                            <span class="label">Ideal</span>
                            <span class="value">${totalIdeal}</span>
                        </div>
                    </div>
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
    const containerDia = document.getElementById('contele-podium-diurno');
    const containerNoite = document.getElementById('contele-podium-noturno');
    if(containerDia) containerDia.innerHTML = '';
    if(containerNoite) containerNoite.innerHTML = '';

    if (!currentData || currentData.isEmpty) {
        if(containerDia) containerDia.innerHTML = '<p class="text-muted">Sem dados no mês selecionado para montar o pódio.</p>';
        if(containerNoite) containerNoite.innerHTML = '<p class="text-muted">Sem dados no mês selecionado para montar o pódio.</p>';
        return;
    }

    const renderPodio = (arr, container) => {
        if (!container || !arr || arr.length === 0) return;
        
        // Assuming admin entered in order (1, 2, 3), but sorting just in case by visitas if we want
        const top3 = [...arr].slice(0, 3);
        const podiumOrder = [];
        if(top3[1]) podiumOrder.push({ pos: 2, data: top3[1] });
        if(top3[0]) podiumOrder.push({ pos: 1, data: top3[0] });
        if(top3[2]) podiumOrder.push({ pos: 3, data: top3[2] });

        podiumOrder.forEach(item => {
            if (!item.data.nome) return; // Skip empty
            const imgSrc = item.data.foto && item.data.foto.trim() !== '' 
                ? `assets/img/supervisores/${item.data.foto}` 
                : 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2394a3b8"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';

            const html = `
                <div class="podium-item pos-${item.pos}">
                    <img src="${imgSrc}" class="podium-avatar" alt="Supervisor" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 24 24\\' fill=\\'%2394a3b8\\'><path d=\\'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z\\'/></svg>'">
                    <div class="podium-base">
                        <span class="podium-score">${item.data.visitas || 0}</span>
                        <span style="font-size: 0.7rem; opacity: 0.8;">Visitas</span>
                    </div>
                    <div class="podium-name">${item.data.nome}</div>
                </div>
            `;
            container.innerHTML += html;
        });
    };

    if (currentData.podioDiurno) renderPodio(currentData.podioDiurno, containerDia);
    if (currentData.podioNoturno) renderPodio(currentData.podioNoturno, containerNoite);
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
        totalFaltas += Number(d.faltas || 0);
        totalDemissoes += Number(d.demissoes || 0);
        totalCustoExtra += Number(d.custo99 || 0) + Number(d.gastosFolgas || 0) + Number(d.horasExtrasGeral || 0);
        totalDivOcorridas += Number(d.divergenciaFuncao || 0);
        totalDivResolvidas += Number(d.divergenciasResolvidas || 0);

        if (d.demissoesMotivos) {
            motivosAnual.empresa += d.demissoesMotivos.empresa || 0;
            motivosAnual.pedido += d.demissoesMotivos.pedido || 0;
            motivosAnual.experiencia += d.demissoesMotivos.experiencia || 0;
            motivosAnual.justa_causa += d.demissoesMotivos.justa_causa || 0;
        }
        if (d.topClientesFaltas) {
            d.topClientesFaltas.forEach(c => {
                if (!c.nome) return;
                const nomeKey = c.nome.trim().toUpperCase();
                if (!clientesMap[nomeKey]) {
                    clientesMap[nomeKey] = { nome: c.nome.trim(), faltas: 0 };
                }
                clientesMap[nomeKey].faltas += Number(c.faltas || 0);
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
                    { 
                        label: 'App 99 (R$)', 
                        data: yearlyData.map(d => d.isEmpty ? 0 : (d.custo99 || 0)), 
                        borderColor: chartColors.app99, backgroundColor: 'rgba(250,204,21,0.08)', borderWidth: 2.5, tension: 0.4, fill: true, pointRadius: 4 
                    },
                    { 
                        label: 'Folgas Trabalhadas (R$)', 
                        data: yearlyData.map(d => d.isEmpty ? 0 : (d.gastosFolgas || 0)), 
                        borderColor: chartColors.success, backgroundColor: 'rgba(16,185,129,0.08)', borderWidth: 2.5, tension: 0.4, fill: true, pointRadius: 4 
                    },
                    { 
                        label: 'Total Horas Extras (R$)', 
                        data: yearlyData.map(d => d.isEmpty ? 0 : ((d.horasExtrasGeral || 0) + (d.horasExtrasIntra || 0) + (d.horasExtras100 || 0))), 
                        borderColor: chartColors.danger, backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 2.5, tension: 0.4, fill: true, pointRadius: 4 
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' }, datalabels: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${formatCurrency(ctx.raw)}` } } },
                scales: { y: { beginAtZero: true, ticks: { callback: v => 'R$' + (v / 1000).toFixed(0) + 'k' } } }
            }
        });
    }

    // Gráfico: Termômetro Faltas x Demissões x Admissões
    const ctxFD = document.getElementById('chartAnualFaltasDemissoes');
    if (ctxFD) {
        if (charts['chartAnualFaltasDemissoes']) charts['chartAnualFaltasDemissoes'].destroy();
        charts['chartAnualFaltasDemissoes'] = new Chart(ctxFD.getContext('2d'), {
            type: 'bar',
            data: {
                labels: monthLabels,
                datasets: [
                    { label: 'Faltas', data: yearlyData.map(d => d.isEmpty ? 0 : (d.faltas || 0)), backgroundColor: chartColors.warning, borderRadius: 4 },
                    { label: 'Demissões', data: yearlyData.map(d => d.isEmpty ? 0 : (d.demissoes || 0)), backgroundColor: chartColors.danger, borderRadius: 4 },
                    { label: 'Admissões', data: yearlyData.map(d => d.isEmpty ? 0 : (d.admissoes || 0)), backgroundColor: chartColors.success, borderRadius: 4 }
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
        const sorted = Object.values(clientesMap).sort((a, b) => b.faltas - a.faltas).slice(0, 10);
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

    // Gráfico pizza pós-venda
    renderPvSlaChart();
}

// ===================== GRÁFICO PIZZA: PÓS VENDA NEGATIVO vs CLIENTES =====================
/**
 * Salva o número total de clientes no localStorage e atualiza o gráfico.
 */
function pv_salvarTotalClientes(valor) {
    localStorage.setItem('embraps_total_clientes', valor);
    renderPvSlaChart();
}

/**
 * Renderiza o donut de SLA de satisfação:
 *  - Azul claro  → clientes SEM pós-venda negativo
 *  - Vermelho claro → total de pos-vendas negativos registrados
 *  - Centro      → % de SLA (clientes sem ocorrência)
 */
async function renderPvSlaChart() {
    const canvas = document.getElementById('chartPvSla');
    if (!canvas) return;

    // --- Carregar input salvo do mes atual ---
    let totalClientes = 0;
    if (window.currentSelectedData && window.currentSelectedData.totalClientes) {
        totalClientes = parseInt(window.currentSelectedData.totalClientes, 10);
    }

    const displayEl = document.getElementById('display-total-clientes');
    if (displayEl) displayEl.textContent = totalClientes > 0 ? totalClientes : '—';

    // --- Contar total de pos-vendas negativos do Firestore ou LS ---
    let totalPv = 0;
    try {
        if (typeof useFirebase !== 'undefined' && useFirebase && typeof db !== 'undefined' && db) {
            const snap = await db.collection('pos_venda_negativo').get();
            totalPv = snap.size;
        } else {
            const localPv = JSON.parse(localStorage.getItem('embraps_pv_offline') || '[]');
            totalPv = localPv.length;
        }
    } catch (e) {
        const localPv = JSON.parse(localStorage.getItem('embraps_pv_offline') || '[]');
        totalPv = localPv.length;
    }

    // --- Calcular SLA ---
    const clientesSemOcorrencia = Math.max(0, totalClientes - totalPv);
    const sla = totalClientes > 0
        ? Math.round((clientesSemOcorrencia / totalClientes) * 100)
        : (totalPv === 0 ? 100 : 0);
    const slaColor = sla >= 95 ? '#15803d' : sla >= 85 ? '#d97706' : '#dc2626';

    // --- Atualizar label central ---
    const pctEl = document.getElementById('pv-sla-pct');
    if (pctEl) {
        pctEl.textContent = totalClientes > 0 ? sla + '%' : '—';
        pctEl.style.color = slaColor;
    }

    // --- Painel de detalhes lateral ---
    const detailEl = document.getElementById('pv-sla-detail');
    if (detailEl) {
        detailEl.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:#f0fdf4; border-radius:10px; border-left:4px solid #15803d;">
                <div>
                    <div style="font-size:.78rem; color:#64748b; font-weight:600; text-transform:uppercase; letter-spacing:.04em;">Total de Clientes</div>
                    <div style="font-size:1.6rem; font-weight:800; color:#15803d; line-height:1.1;">${totalClientes > 0 ? totalClientes.toLocaleString('pt-BR') : '—'}</div>
                    <div style="font-size:.72rem; color:#64748b; margin-top:2px;">cadastrados no campo acima</div>
                </div>
                <i class="fa-solid fa-users" style="font-size:1.8rem; color:#86efac; opacity:.7;"></i>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:#fff1f2; border-radius:10px; border-left:4px solid #dc2626;">
                <div>
                    <div style="font-size:.78rem; color:#64748b; font-weight:600; text-transform:uppercase; letter-spacing:.04em;">Pós Vendas Negativos</div>
                    <div style="font-size:1.6rem; font-weight:800; color:#dc2626; line-height:1.1;">${totalPv.toLocaleString('pt-BR')}</div>
                    <div style="font-size:.72rem; color:#64748b; margin-top:2px;">casos registrados na aba Pós Venda</div>
                </div>
                <i class="fa-solid fa-headset" style="font-size:1.8rem; color:#fca5a5; opacity:.7;"></i>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:#eff6ff; border-radius:10px; border-left:4px solid #3b82f6;">
                <div>
                    <div style="font-size:.78rem; color:#64748b; font-weight:600; text-transform:uppercase; letter-spacing:.04em;">Clientes sem ocorrência</div>
                    <div style="font-size:1.6rem; font-weight:800; color:#1e3a8a; line-height:1.1;">${clientesSemOcorrencia.toLocaleString('pt-BR')}</div>
                    <div style="font-size:.72rem; color:#64748b; margin-top:2px;">${sla}% da carteira sem negativos</div>
                </div>
                <i class="fa-solid fa-circle-check" style="font-size:1.8rem; color:#93c5fd; opacity:.7;"></i>
            </div>

            ${totalClientes === 0 ? `
            <div style="padding:10px 14px; background:#fffbeb; border-radius:8px; border:1px solid #fde68a; font-size:.82rem; color:#92400e;">
                <i class="fa-solid fa-triangle-exclamation"></i>
                Informe o número total de clientes no campo acima para calcular o SLA.
            </div>` : ''}
        `;
    }

    // --- Dados do gráfico ---
    const chartData = totalClientes > 0
        ? [clientesSemOcorrencia, totalPv]
        : [1, 0]; // placeholder vazio

    if (charts['chartPvSla']) {
        charts['chartPvSla'].destroy();
        delete charts['chartPvSla'];
    }

    charts['chartPvSla'] = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: ['Clientes sem ocorrência', 'Pós Venda Negativo'],
            datasets: [{
                data: chartData,
                backgroundColor: ['#93c5fd', '#fca5a5'],
                borderColor: ['#60a5fa', '#f87171'],
                borderWidth: 2,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { display: false },
                datalabels: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(ctx) {
                            const val = ctx.raw;
                            const pct = totalClientes > 0
                                ? ' (' + Math.round(val / totalClientes * 100) + '%)'
                                : '';
                            return ` ${ctx.label}: ${val.toLocaleString('pt-BR')}${pct}`;
                        }
                    }
                }
            }
        }
    });
}


async function renderResumoAnualOS(year, monthLabels) {
    const ctxOS = document.getElementById('chartAnualOS');
    if (!ctxOS) return;

    let osCounts = new Array(12).fill(0);

    // O db vem do firebase-config.js
    if (typeof useFirebase !== 'undefined' && useFirebase && db) {
        try {
            const snapshot = await db.collection('ordens_servico').get();
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.dataVencimento) {
                    const [anoOS, mesOS] = data.dataVencimento.split('-');
                    if (anoOS === year.toString()) {
                        const monthIndex = parseInt(mesOS, 10) - 1;
                        if (monthIndex >= 0 && monthIndex < 12) {
                            osCounts[monthIndex]++;
                        }
                    }
                }
            });
        } catch (error) {
            console.error("Erro ao carregar OS para gráfico anual:", error);
        }
    }

    if (charts['chartAnualOS']) charts['chartAnualOS'].destroy();
    charts['chartAnualOS'] = new Chart(ctxOS.getContext('2d'), {
        type: 'bar',
        data: {
            labels: monthLabels,
            datasets: [{
                label: 'Ordens de Serviço (Vencimento)',
                data: osCounts,
                backgroundColor: chartColors.primary,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { 
                legend: { display: false }, 
                datalabels: { 
                    display: ctx => ctx.dataset.data[ctx.dataIndex] > 0, 
                    color: '#fff', 
                    font: { weight: 'bold' } 
                } 
            },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}

// ===================== GRÁFICOS DE VAGAS =====================
async function renderResumoVagasAnual() {
    const ctxCoord = document.getElementById('chartVagasCoord');
    const ctxSuper = document.getElementById('chartVagasSuper');
    if (!ctxCoord || !ctxSuper) return;

    if (typeof useFirebase !== 'undefined' && useFirebase && db) {
        try {
            const snapshot = await db.collection('vagas').get();
            const coordCounts = {};
            const superCounts = {};

            snapshot.forEach(doc => {
                const data = doc.data();
                
                // Agrupando por Coordenador
                if (data.coord) {
                    coordCounts[data.coord] = (coordCounts[data.coord] || 0) + 1;
                }
                // Agrupando por Supervisor
                if (data.supervisor) {
                    superCounts[data.supervisor] = (superCounts[data.supervisor] || 0) + 1;
                }
            });

            // Preparando arrays e ordenando para Coordenador
            const coordSorted = Object.entries(coordCounts).sort((a, b) => b[1] - a[1]);
            const coordLabels = coordSorted.map(item => item[0]);
            const coordData = coordSorted.map(item => item[1]);

            // Preparando arrays e ordenando para Supervisor (Top 10)
            const superSorted = Object.entries(superCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
            const superLabels = superSorted.map(item => item[0]);
            const superData = superSorted.map(item => item[1]);

            // Gráfico Coordenadores
            if (charts['chartVagasCoord']) charts['chartVagasCoord'].destroy();
            charts['chartVagasCoord'] = new Chart(ctxCoord.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: coordLabels,
                    datasets: [{
                        label: 'Movimentações no Ano',
                        data: coordData,
                        backgroundColor: chartColors.info,
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { 
                        legend: { display: false },
                        datalabels: { display: ctx => ctx.dataset.data[ctx.dataIndex] > 0, color: '#fff', font: { weight: 'bold' } }
                    },
                    scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
                }
            });

            // Gráfico Supervisores
            if (charts['chartVagasSuper']) charts['chartVagasSuper'].destroy();
            charts['chartVagasSuper'] = new Chart(ctxSuper.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: superLabels,
                    datasets: [{
                        label: 'Movimentações no Ano',
                        data: superData,
                        backgroundColor: chartColors.warning,
                        borderRadius: 4
                    }]
                },
                options: {
                    indexAxis: 'y', // Fica melhor barras horizontais para Top 10 nomes
                    responsive: true, maintainAspectRatio: false,
                    plugins: { 
                        legend: { display: false },
                        datalabels: { display: ctx => ctx.dataset.data[ctx.dataIndex] > 0, color: '#fff', font: { weight: 'bold' } }
                    },
                    scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } }
                }
            });

        } catch (error) {
            console.error("Erro ao carregar gráficos de vagas:", error);
        }
    }
}

// ==========================================
// INTEGRAÇÃO COM MÓDULO DE VAGAS (ALERTAS)
// ==========================================
async function verificarAlertasDeVagas() {
    try {
        const db = firebase.firestore();
        const snapshot = await db.collection('vagas').where('status', '!=', 'Efetivado').get();
        let vagasAtrasadas = [];
        const hoje = new Date();

        snapshot.forEach(doc => {
            const vaga = doc.data();
            if (vaga.dataAbertura) {
                const [ano, mes, dia] = vaga.dataAbertura.split('-');
                const dataAbert = new Date(ano, mes - 1, dia);
                const diffTime = Math.abs(hoje - dataAbert);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays > 15) {
                    vagasAtrasadas.push({...vaga, diffDays});
                }
            }
        });

        if (vagasAtrasadas.length > 0) {
            const container = document.getElementById('alerts-container');
            const alertDiv = document.createElement('div');
            alertDiv.className = 'custom-alert danger shake-alert';
            
            // Agrupar por coordenador
            const coords = [...new Set(vagasAtrasadas.map(v => v.coord))];
            
            alertDiv.innerHTML = `
                <div class="alert-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
                <div class="alert-content">
                    <h4>Alerta Crítico de SLAs (Vagas Abertas > 15 dias)</h4>
                    <p>Existem <strong>${vagasAtrasadas.length} vagas</strong> com SLA estourado aguardando implantação. (Coordenadores: ${coords.join(', ')})</p>
                    <a href="vagas.html" style="color: #991b1b; font-weight: bold; text-decoration: underline; font-size: 0.85rem; margin-top: 5px; display: inline-block;">Visualizar Vagas Pendentes</a>
                </div>
            `;
            container.appendChild(alertDiv);
        }

    } catch (error) {
        console.error("Erro ao verificar vagas atrasadas para alertas", error);
    }
}
