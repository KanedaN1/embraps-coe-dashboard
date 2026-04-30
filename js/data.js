const DATA_KEY = 'embraps_coe_data';

// Helper: gera dados padrão (mock) para o ano de 2026
function generateMockData() {
    const mock = {};
    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    
    // Supervisores fixos para mock
    const nomesSupervisores = ['João Silva', 'Maria Souza', 'Carlos Oliveira', 'Ana Costa'];

    months.forEach(month => {
        const key = `2026-${month}`;
        
        // Arrays de supervisores mockados
        const supervisores99 = nomesSupervisores.map(nome => ({
            nome: nome,
            gasto: Math.floor(Math.random() * 500) + 100
        }));

        const supervisoresContele = nomesSupervisores.map(nome => ({
            nome: nome,
            visitas: Math.floor(Math.random() * 40) + 10,
            foto: '' // Vazio no mock
        }));

            // Generate Faltas and Demissões
            let faltasDiarias = {};
            let demissoesDiarias = {};
            let demissoesMotivosDiarios = {};
            let totalFaltas = 0;
            let totalDemissoes = 0;

            let motivosMensais = { empresa: 0, pedido: 0, experiencia: 0, justa_causa: 0 };

            for (let i = 1; i <= 31; i++) {
                let f = Math.floor(Math.random() * 5);
                faltasDiarias[i] = f;
                totalFaltas += f;
                
                let m_emp = Math.random() > 0.6 ? 1 : 0;
                let m_ped = Math.random() > 0.7 ? 1 : 0;
                let m_exp = Math.random() > 0.8 ? 1 : 0;
                let m_jus = Math.random() > 0.9 ? 1 : 0;
                
                let total_d = m_emp + m_ped + m_exp + m_jus;
                
                demissoesMotivosDiarios[i] = {
                    empresa: m_emp,
                    pedido: m_ped,
                    experiencia: m_exp,
                    justa_causa: m_jus
                };
                
                motivosMensais.empresa += m_emp;
                motivosMensais.pedido += m_ped;
                motivosMensais.experiencia += m_exp;
                motivosMensais.justa_causa += m_jus;

                demissoesDiarias[i] = total_d;
                totalDemissoes += total_d;
            }

        mock[key] = {
            gastosFolgas: Math.floor(Math.random() * 5000) + 15000,
            punicoes: Math.floor(Math.random() * 20) + 5,
            pendenciasPonto: Math.floor(Math.random() * 50) + 10,
            custo99: Math.floor(Math.random() * 2000) + 3000,
            custoPorUsuario99: Math.floor(Math.random() * 50) + 150,
            horasExtrasGeral: Math.floor(Math.random() * 10000) + 20000,
            horasExtrasIntra: Math.floor(Math.random() * 3000) + 5000,
            horasExtras100: Math.floor(Math.random() * 2000) + 2000,
            valeTransporte: Math.floor(Math.random() * 8000) + 40000,
            visitasContele: Math.floor(Math.random() * 100) + 200,
            divergenciaFuncao: Math.floor(Math.random() * 15) + 5,
            divergenciasResolvidas: Math.floor(Math.random() * 10),
            faltas: totalFaltas, 
            faltasDiarias: faltasDiarias,
            demissoes: totalDemissoes,
            demissoesDiarias: demissoesDiarias,
            reservasDiurna: Math.floor(Math.random() * 10) + 5,
            reservasNoturna: Math.floor(Math.random() * 8) + 4,
            reservasLimpeza: Math.floor(Math.random() * 5) + 2,
            topClientesFaltas: [
                { nome: 'Cliente Alpha', faltas: Math.floor(Math.random() * 50) + 20 },
                { nome: 'Cliente Beta', faltas: Math.floor(Math.random() * 40) + 15 },
                { nome: 'Cliente Gamma', faltas: Math.floor(Math.random() * 30) + 10 },
                { nome: 'Cliente Delta', faltas: Math.floor(Math.random() * 25) + 5 },
                { nome: 'Cliente Epsilon', faltas: Math.floor(Math.random() * 20) + 5 },
            ],
            supervisores99: supervisores99,
            supervisoresContele: supervisoresContele,
            demissoesMotivosDiarios: demissoesMotivosDiarios,
            demissoesMotivos: motivosMensais,
            topClientesFaltasPerc: [
                { nome: 'Cliente Alpha', percentual: Math.floor(Math.random() * 10) + 5 },
                { nome: 'Cliente Beta', percentual: Math.floor(Math.random() * 5) + 3 },
                { nome: 'Cliente Gamma', percentual: Math.floor(Math.random() * 4) + 2 },
                { nome: 'Cliente Delta', percentual: Math.floor(Math.random() * 3) + 1 },
                { nome: 'Cliente Epsilon', percentual: Math.floor(Math.random() * 2) + 1 },
            ],
            topClientesDemissoes: [
                { nome: 'Cliente Omega', demissoes: Math.floor(Math.random() * 15) + 5 },
                { nome: 'Cliente Sigma', demissoes: Math.floor(Math.random() * 10) + 4 },
                { nome: 'Cliente Zeta', demissoes: Math.floor(Math.random() * 8) + 3 },
                { nome: 'Cliente Kappa', demissoes: Math.floor(Math.random() * 6) + 2 },
                { nome: 'Cliente Iota', demissoes: Math.floor(Math.random() * 5) + 1 },
            ],
            topClientesDemissoesPerc: [
                { nome: 'Cliente Omega', percentual: Math.floor(Math.random() * 12) + 4 },
                { nome: 'Cliente Sigma', percentual: Math.floor(Math.random() * 8) + 3 },
                { nome: 'Cliente Zeta', percentual: Math.floor(Math.random() * 6) + 2 },
                { nome: 'Cliente Kappa', percentual: Math.floor(Math.random() * 4) + 1 },
                { nome: 'Cliente Iota', percentual: Math.floor(Math.random() * 3) + 1 },
            ],
            reservas: {
                limpeza: [
                    { escala: 'Auxiliar de limpeza 5x1 diurno', atual: Math.floor(Math.random() * 15), ideal: 9 },
                    { escala: 'Auxiliar de limpeza 5x1 vespertino', atual: Math.floor(Math.random() * 5), ideal: 3 },
                    { escala: 'Auxiliar de limpeza 5x2', atual: Math.floor(Math.random() * 3), ideal: 2 },
                    { escala: 'Auxiliar de limpeza 12x36', atual: Math.floor(Math.random() * 3), ideal: 2 },
                    { escala: 'Coringas', atual: Math.floor(Math.random() * 8), ideal: 7 }
                ],
                portariaDia: [
                    { escala: 'Porteiro Par', atual: Math.floor(Math.random() * 12), ideal: 8 },
                    { escala: 'Porteiro Impar', atual: Math.floor(Math.random() * 10), ideal: 8 },
                    { escala: 'Auxiliar de manuntenção', atual: Math.floor(Math.random() * 3), ideal: 2 },
                    { escala: 'Zelador', atual: Math.floor(Math.random() * 3), ideal: 2 },
                    { escala: 'Coringas', atual: Math.floor(Math.random() * 5), ideal: 4 }
                ],
                portariaNoite: [
                    { escala: 'Porteiro Par', atual: Math.floor(Math.random() * 5), ideal: 4 },
                    { escala: 'Porteiro Impar', atual: Math.floor(Math.random() * 5), ideal: 4 },
                    { escala: 'Auxiliar de limpeza noturno', atual: Math.floor(Math.random() * 3), ideal: 1 },
                    { escala: 'Coringas', atual: Math.floor(Math.random() * 6), ideal: 5 }
                ]
            }
        };
    });
    
    return mock;
}

// Inicializa dados se não existirem
function initData() {
    if (!localStorage.getItem(DATA_KEY)) {
        localStorage.setItem(DATA_KEY, JSON.stringify(generateMockData()));
    }
}

// Retorna todos os dados
function getAllData() {
    const data = localStorage.getItem(DATA_KEY);
    return data ? JSON.parse(data) : {};
}

// Retorna dados de um mês específico
function getDataByMonth(year, month) {
    const data = getAllData();
    const key = `${year}-${month.padStart(2, '0')}`;
    return data[key] || null;
}

// Salva dados de um mês
function saveData(year, month, payload) {
    const data = getAllData();
    const key = `${year}-${month.padStart(2, '0')}`;
    data[key] = payload;
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
}

// Exclui dados de um mês
function deleteData(year, month) {
    const data = getAllData();
    const key = `${year}-${month.padStart(2, '0')}`;
    if (data[key]) {
        delete data[key];
        localStorage.setItem(DATA_KEY, JSON.stringify(data));
        return true;
    }
    return false;
}

// Exportar dados para JSON
function exportData() {
    const data = localStorage.getItem(DATA_KEY) || "{}";
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `embraps_coe_data_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
}

// Importar dados de arquivo JSON
function importData(file, callback) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const json = JSON.parse(e.target.result);
            if (typeof json === 'object' && json !== null) {
                localStorage.setItem(DATA_KEY, JSON.stringify(json));
                if (callback) callback(true, "Dados importados com sucesso!");
            } else {
                if (callback) callback(false, "Arquivo JSON inválido.");
            }
        } catch (err) {
            if (callback) callback(false, "Erro ao ler o arquivo JSON.");
        }
    };
    reader.readAsText(file);
}

// Executa init ao carregar o script
initData();
