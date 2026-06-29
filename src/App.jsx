import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  RefreshCw, Database, FileText, CheckCircle2, 
  Building2, SlidersHorizontal, TableProperties
} from 'lucide-react';

const COLORS = ['#4f46e5', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

export default function App() {
  // Estados de filtros
  const [selectedOrgao, setSelectedOrgao] = useState('Todos');
  const [selectedStatus, setSelectedStatus] = useState('Todos');
  const [limitRecords, setLimitRecords] = useState(2000);

  // Opções de filtros dinâmicas
  const [filterOptions, setFilterOptions] = useState({ orgaos: [], status: [] });

  // Estados dos dados da API local
  const [summary, setSummary] = useState(null);
  const [charts, setCharts] = useState(null);
  const [detailedData, setDetailedData] = useState([]);

  // Estados de controle de carregamento
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasData, setHasData] = useState(false);

  // Carregar dados iniciais e sempre que os filtros mudarem
  useEffect(() => {
    fetchDashboardData();
  }, [selectedOrgao, selectedStatus]);

  async function fetchDashboardData() {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        orgao: selectedOrgao,
        status: selectedStatus
      }).toString();

      // Buscar sumários e filtros em paralelo do backend do Express
      const [summaryRes, chartsRes, dataRes, filtersRes] = await Promise.all([
        fetch(`/api/summary?${queryParams}`),
        fetch(`/api/charts?${queryParams}`),
        fetch(`/api/data?${queryParams}`),
        fetch('/api/filters')
      ]);

      if (summaryRes.ok && chartsRes.ok && dataRes.ok && filtersRes.ok) {
        const summaryData = await summaryRes.json();
        const chartsData = await chartsRes.json();
        const detailedList = await dataRes.json();
        const filtersData = await filtersRes.json();

        setSummary(summaryData);
        setCharts(chartsData);
        setDetailedData(detailedList);
        setFilterOptions(filtersData);
        
        // Verifica se há dados gravados no banco SQLite local
        setHasData(summaryData.totalAnalises > 0);
      } else {
        setHasData(false);
      }
    } catch (error) {
      console.error('Erro ao buscar dados do dashboard:', error);
      setHasData(false);
    } finally {
      setIsLoading(false);
    }
  }

  // Executa a extração / sincronização
  async function handleSync() {
    setIsSyncing(true);
    try {
      const response = await fetch(`/api/sync?limit=${limitRecords}`);
      const result = await response.json();
      if (result.success) {
        alert(result.message);
        // Recarregar os dados após sincronizar
        setSelectedOrgao('Todos');
        setSelectedStatus('Todos');
        fetchDashboardData();
      } else {
        alert('Erro ao sincronizar: ' + result.message);
      }
    } catch (error) {
      alert('Erro na comunicação com o servidor: ' + error.message);
    } finally {
      setIsSyncing(false);
    }
  }

  // Formatação de data simples
  function formatDate(isoString) {
    if (!isoString) return '-';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('pt-BR');
    } catch {
      return isoString;
    }
  }

  // Tela Inicial (Sem dados no SQLite)
  if (!isLoading && !hasData && !isSyncing) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="welcome-card">
          <div className="welcome-icon">
            <Database size={32} />
          </div>
          <h2 className="welcome-title">Carregamento de Dados Inicial</h2>
          <p className="welcome-desc">
            Não existem dados carregados no banco de dados local SQLite. É necessário sincronizar as informações a partir do endpoint público do Transferegov.br.
          </p>
          
          <div className="steps-list">
            <div className="step-item">
              <span className="step-number">1.</span>
              <span>Defina a quantidade de registros que quer puxar da API (limite padrão: 2000).</span>
            </div>
            <div className="step-item">
              <span className="step-number">2.</span>
              <span>Clique no botão abaixo para baixar os dados históricos de análises de planos de trabalho das Transferências Especiais.</span>
            </div>
          </div>

          <div className="form-group" style={{ width: '100%', maxWidth: '280px', marginTop: '10px' }}>
            <label className="form-label">Limite de Registros:</label>
            <input 
              type="number" 
              className="form-input"
              value={limitRecords} 
              onChange={(e) => setLimitRecords(Number(e.target.value))}
              min="100" 
              max="50000" 
            />
          </div>

          <button className="btn btn-primary" onClick={handleSync} style={{ maxWidth: '280px' }}>
            <RefreshCw size={16} /> Sincronizar com a API
          </button>
        </div>
      </div>
    );
  }

  // Tela de Sincronização Ativa
  if (isSyncing) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="welcome-card">
          <div className="welcome-icon" style={{ animation: 'spin 2s linear infinite' }}>
            <RefreshCw size={32} />
          </div>
          <h2 className="welcome-title">Sincronizando Dados...</h2>
          <p className="welcome-desc">
            O backend local está buscando os dados de Transferências Especiais da API oficial do governo e gerando os índices no SQLite. Isso pode levar alguns segundos.
          </p>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Barra Lateral de Controles */}
      <aside className="sidebar">
        <div className="sidebar-title">
          <span>📊 Transferegov</span>
        </div>
        <div className="sidebar-subtitle">Painel de Transferências Especiais</div>

        <hr style={{ border: '0', borderTop: '1px solid var(--border-color)' }} />

        {/* Seção Filtros */}
        <div className="sidebar-section">
          <div className="sidebar-section-title">
            <SlidersHorizontal size={14} style={{ display: 'inline', marginRight: '6px' }} />
            Filtros
          </div>
          
          <div className="form-group">
            <label className="form-label">Órgão Analisador</label>
            <select 
              className="form-select"
              value={selectedOrgao} 
              onChange={(e) => setSelectedOrgao(e.target.value)}
            >
              <option value="Todos">Todos os Órgãos</option>
              {filterOptions.orgaos.map((org, index) => (
                <option key={index} value={org}>{org}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Situação da Análise</label>
            <select 
              className="form-select"
              value={selectedStatus} 
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="Todos">Todas as Situações</option>
              {filterOptions.status.map((stat, index) => (
                <option key={index} value={stat}>{stat}</option>
              ))}
            </select>
          </div>
        </div>

        <hr style={{ border: '0', borderTop: '1px solid var(--border-color)' }} />

        {/* Seção Sincronização */}
        <div className="sidebar-section">
          <div className="sidebar-section-title">Base de Dados (SQLite)</div>
          <div className="form-group">
            <label className="form-label">Limite para Nova Carga</label>
            <input 
              type="number" 
              className="form-input" 
              value={limitRecords} 
              onChange={(e) => setLimitRecords(Number(e.target.value))}
            />
          </div>
          <button 
            className="btn btn-primary" 
            onClick={handleSync}
            disabled={isLoading}
          >
            <RefreshCw size={14} /> Atualizar Banco Local
          </button>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="main-content">
        <header className="header">
          <h1 className="header-title">Histórico de Análise de Planos de Trabalho</h1>
          <div className="header-desc">Monitoramento analítico das emendas parlamentares na modalidade de transferência especial.</div>
        </header>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
            Carregando dados estatísticos...
          </div>
        ) : (
          <>
            {/* Grid de KPIs */}
            <section className="kpi-grid">
              <div className="kpi-card">
                <div className="kpi-icon-wrapper" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
                  <FileText size={20} />
                </div>
                <div className="kpi-info">
                  <span className="kpi-title">Total de Análises</span>
                  <span className="kpi-value">{summary?.totalAnalises}</span>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-icon-wrapper" style={{ backgroundColor: '#ecfdf5', color: '#059669' }}>
                  <CheckCircle2 size={20} />
                </div>
                <div className="kpi-info">
                  <span className="kpi-title">Planos Únicos</span>
                  <span className="kpi-value">{summary?.totalPlanos}</span>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-icon-wrapper" style={{ backgroundColor: '#fef3c7', color: '#d97706' }}>
                  <Building2 size={20} />
                </div>
                <div className="kpi-info">
                  <span className="kpi-title">Órgãos Envolvidos</span>
                  <span className="kpi-value">{summary?.totalOrgaos}</span>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-icon-wrapper" style={{ backgroundColor: '#f5f3ff', color: '#7c3aed' }}>
                  <RefreshCw size={20} />
                </div>
                <div className="kpi-info">
                  <span className="kpi-title">Taxa Conclusão</span>
                  <span className="kpi-value">{summary?.taxaConclusao}%</span>
                </div>
              </div>
            </section>

            {/* Grid de Gráficos */}
            <section className="charts-grid">
              {/* Gráfico 1: Status da Análise (Pie) */}
              <div className="chart-card">
                <h3 className="chart-title">Status da Análise</h3>
                <div style={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={charts?.statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {charts?.statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} análises`, 'Quantidade']} />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Gráfico 2: Parecer Técnico (Bar) */}
              <div className="chart-card">
                <h3 className="chart-title">Parecer Técnico</h3>
                <div style={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer>
                    <BarChart
                      data={charts?.parecerData}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={90} fontSize={11} />
                      <Tooltip formatter={(value) => [`${value} análises`, 'Quantidade']} />
                      <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Gráfico 3: Top 10 Órgãos (Bar) */}
              <div className="chart-card">
                <h3 className="chart-title">Top 10 Órgãos por Volume de Análises</h3>
                <div style={{ width: '100%', height: 280 }}>
                  <ResponsiveContainer>
                    <BarChart
                      data={charts?.orgaosData}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        width={120} 
                        fontSize={9} 
                        tickFormatter={(value) => value && value.length > 25 ? `${value.substring(0, 22)}...` : value}
                      />
                      <Tooltip formatter={(value) => [`${value} análises`, 'Quantidade']} />
                      <Bar dataKey="value" fill="#4f46e5" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Gráfico 4: Evolução Mensal (Line) */}
              <div className="chart-card">
                <h3 className="chart-title">Evolução Mensal de Análises</h3>
                <div style={{ width: '100%', height: 280 }}>
                  <ResponsiveContainer>
                    <LineChart
                      data={charts?.timelineData}
                      margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="period" fontSize={11} />
                      <YAxis />
                      <Tooltip formatter={(value) => [`${value} análises`, 'Quantidade']} />
                      <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>

            {/* Tabela de Dados Detalhados */}
            <section className="data-card">
              <h3 className="chart-title">
                <TableProperties size={18} />
                Dados Detalhados (Amostra de 500 registros)
              </h3>
              
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID Plano</th>
                      <th>Órgão Analisador</th>
                      <th>Situação Análise</th>
                      <th>Parecer Técnico</th>
                      <th>Data Análise</th>
                      <th>Analista Responsável</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailedData.map((row) => (
                      <tr key={row.id_plano_trabalho_analise}>
                        <td style={{ fontWeight: 600 }}>{row.id_plano_trabalho_analise}</td>
                        <td style={{ fontSize: '13px' }}>{row.nome_orgao_analise_pt_hist || '-'}</td>
                        <td>
                          <span className={`badge ${
                            row.situacao_analise_pt_hist === 'Concluída' ? 'badge-success' : 
                            row.situacao_analise_pt_hist === 'Em Andamento' ? 'badge-violet' : 'badge-warning'
                          }`}>
                            {row.situacao_analise_pt_hist || '-'}
                          </span>
                        </td>
                        <td>{row.situacao_parecer_analise_pt_hist || '-'}</td>
                        <td>{formatDate(row.data_analise_pt_hist)}</td>
                        <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{row.responsaveis_analise_pt_hist || '-'}</td>
                      </tr>
                    ))}
                    {detailedData.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                          Nenhum registro encontrado correspondente aos filtros ativos.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
