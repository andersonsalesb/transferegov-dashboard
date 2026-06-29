import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  RefreshCw, FileText, CheckCircle2, Building2, 
  SlidersHorizontal, TableProperties, Database, Globe
} from 'lucide-react';

const COLORS = ['#4f46e5', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

export default function App() {
  // Configuração de carregamento
  const [limitRecords, setLimitRecords] = useState(2000);
  const [rawData, setRawData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Estados de filtros
  const [selectedOrgao, setSelectedOrgao] = useState('Todos');
  const [selectedStatus, setSelectedStatus] = useState('Todos');

  // Carregar dados na primeira inicialização
  useEffect(() => {
    fetchData();
  }, []);

  // Lógica de consulta direta à API do governo via Proxy CORS (allorigins.win)
  async function fetchData() {
    setIsLoading(true);
    setErrorMsg(null);
    
    // URL da API oficial do governo
    const govApiUrl = `https://api.transferegov.dth.api.gov.br/transferenciasespeciais/plano_trabalho_analise_historico_especial?limit=${limitRecords}`;
    
    // Encapsulando no proxy de CORS gratuito AllOrigins
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(govApiUrl)}`;

    try {
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error('Falha na comunicação com o servidor de proxy.');
      }
      
      const envelope = await response.json();
      
      // AllOrigins retorna o JSON original como string dentro do campo "contents"
      const govData = JSON.parse(envelope.contents);
      const dataList = govData.value || [];
      
      setRawData(dataList);
      
      // Resetar filtros ao buscar nova carga de dados
      setSelectedOrgao('Todos');
      setSelectedStatus('Todos');
    } catch (err) {
      console.error('Erro de requisição:', err);
      setErrorMsg('Não foi possível carregar os dados da API pública do governo. Verifique sua conexão ou tente novamente.');
    } finally {
      setIsLoading(false);
    }
  }

  // Filtragem dinâmica dos dados em memória
  const filteredData = useMemo(() => {
    return rawData.filter(item => {
      const matchesOrgao = selectedOrgao === 'Todos' || item.nome_orgao_analise_pt_hist === selectedOrgao;
      const matchesStatus = selectedStatus === 'Todos' || item.situacao_analise_pt_hist === selectedStatus;
      return matchesOrgao && matchesStatus;
    });
  }, [rawData, selectedOrgao, selectedStatus]);

  // Opções únicas para os dropdowns de filtros
  const filterOptions = useMemo(() => {
    const orgaosSet = new Set();
    const statusSet = new Set();
    
    rawData.forEach(item => {
      if (item.nome_orgao_analise_pt_hist) orgaosSet.add(item.nome_orgao_analise_pt_hist);
      if (item.situacao_analise_pt_hist) statusSet.add(item.situacao_analise_pt_hist);
    });

    return {
      orgaos: sortedArray(orgaosSet),
      status: sortedArray(statusSet)
    };
  }, [rawData]);

  function sortedArray(setObj) {
    return Array.from(setObj).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  // Cálculos de KPIs em memória reativos ao filtro
  const kpiData = useMemo(() => {
    const total = filteredData.length;
    
    const planosUnicos = new Set();
    const orgaosUnicos = new Set();
    let concluidas = 0;

    filteredData.forEach(item => {
      if (item.id_plano_trabalho_analise) planosUnicos.add(item.id_plano_trabalho_analise);
      if (item.nome_orgao_analise_pt_hist) orgaosUnicos.add(item.nome_orgao_analise_pt_hist);
      if (item.situacao_analise_pt_hist === 'Concluída') concluidas++;
    });

    const taxa = total > 0 ? ((concluidas / total) * 100).toFixed(1) : '0.0';

    return {
      totalAnalises: total,
      totalPlanos: planosUnicos.size,
      totalOrgaos: orgaosUnicos.size,
      taxaConclusao: parseFloat(taxa)
    };
  }, [filteredData]);

  // Agregações de gráficos em memória reativos ao filtro
  const chartsData = useMemo(() => {
    if (filteredData.length === 0) return { status: [], parecer: [], orgaos: [], timeline: [] };

    const statusMap = {};
    const parecerMap = {};
    const orgaoMap = {};
    const timelineMap = {};

    filteredData.forEach(item => {
      // 1. Status
      const status = item.situacao_analise_pt_hist || 'Não Especificado';
      statusMap[status] = (statusMap[status] || 0) + 1;

      // 2. Parecer
      const parecer = item.situacao_parecer_analise_pt_hist || 'Sem Parecer';
      parecerMap[parecer] = (parecerMap[parecer] || 0) + 1;

      // 3. Órgão
      const orgao = item.nome_orgao_analise_pt_hist || 'Não Especificado';
      orgaoMap[orgao] = (orgaoMap[orgao] || 0) + 1;

      // 4. Timeline (Extrai Ano-Mês)
      if (item.data_analise_pt_hist) {
        const period = item.data_analise_pt_hist.substring(0, 7); // "YYYY-MM"
        timelineMap[period] = (timelineMap[period] || 0) + 1;
      }
    });

    // Formatar para Recharts
    const statusData = Object.entries(statusMap).map(([name, value]) => ({ name, value }));
    
    const parecerData = Object.entries(parecerMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const orgaosData = Object.entries(orgaoMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Top 10

    const timelineData = Object.entries(timelineMap)
      .map(([period, count]) => ({ period, count }))
      .sort((a, b) => a.period.localeCompare(b.period));

    return {
      status: statusData,
      parecer: parecerData,
      orgaos: orgaosData,
      timeline: timelineData
    };
  }, [filteredData]);

  // Formatação de data amigável
  function formatDate(isoString) {
    if (!isoString) return '-';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('pt-BR');
    } catch {
      return isoString;
    }
  }

  return (
    <div className="app-container">
      {/* Barra Lateral de Controles */}
      <aside className="sidebar">
        <div className="sidebar-title">
          <span>📊 Transferegov</span>
        </div>
        <div className="sidebar-subtitle">Painel Frontend-Only (Sem BD)</div>

        <hr style={{ border: '0', borderTop: '1px solid var(--border-color)' }} />

        {/* Seção Filtros */}
        <div className="sidebar-section">
          <div className="sidebar-section-title">
            <SlidersHorizontal size={14} style={{ display: 'inline', marginRight: '6px' }} />
            Filtros Dinâmicos
          </div>
          
          <div className="form-group">
            <label className="form-label">Órgão Analisador</label>
            <select 
              className="form-select"
              value={selectedOrgao} 
              onChange={(e) => setSelectedOrgao(e.target.value)}
              disabled={isLoading || rawData.length === 0}
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
              disabled={isLoading || rawData.length === 0}
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
          <div className="sidebar-section-title">Carga de Dados (API)</div>
          <div className="form-group">
            <label className="form-label">Quantidade de Linhas</label>
            <input 
              type="number" 
              className="form-input" 
              value={limitRecords} 
              onChange={(e) => setLimitRecords(Number(e.target.value))}
              min="100"
              max="50000"
              disabled={isLoading}
            />
          </div>
          <button 
            className="btn btn-primary" 
            onClick={fetchData}
            disabled={isLoading}
          >
            <RefreshCw size={14} style={{ animation: isLoading ? 'spin 1.5s linear infinite' : 'none' }} /> 
            {isLoading ? 'Carregando...' : 'Atualizar Dados'}
          </button>
        </div>

        <div className="sidebar-section" style={{ marginTop: 'auto' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Globe size={12} />
            Consultando via CORS Proxy
          </div>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="main-content">
        <header className="header">
          <h1 className="header-title">Histórico de Análise de Planos de Trabalho</h1>
          <div className="header-desc">Painel visual estático sem persistência. Consulta em tempo real à base pública das Transferências Especiais.</div>
        </header>

        {errorMsg && (
          <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '16px', borderRadius: '8px', marginBottom: '24px', fontSize: '14px', border: '1px solid #fca5a5' }}>
            <strong>Erro: </strong> {errorMsg}
          </div>
        )}

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
            <RefreshCw size={40} style={{ animation: 'spin 1.5s linear infinite', marginBottom: '16px', color: 'var(--primary)' }} />
            <div>Buscando e processando registros da base de dados do governo...</div>
            <style>{`
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        ) : rawData.length === 0 ? (
          <div className="welcome-card" style={{ marginTop: '40px' }}>
            <div className="welcome-icon">
              <Database size={32} />
            </div>
            <h2 className="welcome-title">Carregar Informações</h2>
            <p className="welcome-desc">
              Pressione o botão para buscar os dados diretamente do portal do governo (Transferegov.br) através do proxy de CORS.
            </p>
            <button className="btn btn-primary" onClick={fetchData} style={{ maxWidth: '280px' }}>
              <RefreshCw size={16} /> Consultar API Oficial
            </button>
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
                  <span className="kpi-value">{kpiData.totalAnalises}</span>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-icon-wrapper" style={{ backgroundColor: '#ecfdf5', color: '#059669' }}>
                  <CheckCircle2 size={20} />
                </div>
                <div className="kpi-info">
                  <span className="kpi-title">Planos Únicos</span>
                  <span className="kpi-value">{kpiData.totalPlanos}</span>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-icon-wrapper" style={{ backgroundColor: '#fef3c7', color: '#d97706' }}>
                  <Building2 size={20} />
                </div>
                <div className="kpi-info">
                  <span className="kpi-title">Órgãos Filtrados</span>
                  <span className="kpi-value">{kpiData.totalOrgaos}</span>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-icon-wrapper" style={{ backgroundColor: '#f5f3ff', color: '#7c3aed' }}>
                  <RefreshCw size={20} />
                </div>
                <div className="kpi-info">
                  <span className="kpi-title">Taxa Conclusão</span>
                  <span className="kpi-value">{kpiData.taxaConclusao}%</span>
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
                        data={chartsData.status}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {chartsData.status.map((entry, index) => (
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
                      data={chartsData.parecer}
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
                      data={chartsData.orgaos}
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
                      data={chartsData.timeline}
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
                Dados Detalhados (Amostra de 500 registros filtrados)
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
                    {filteredData.slice(0, 500).map((row) => (
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
                    {filteredData.length === 0 && (
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
