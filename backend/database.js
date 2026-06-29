import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, 'transferegov.db');

const db = new sqlite3.Database(dbPath);

// Promisificar métodos do SQLite para facilitar uso com async/await
const dbRun = promisify(db.run.bind(db));
const dbAll = promisify(db.all.bind(db));
const dbGet = promisify(db.get.bind(db));

// Inicializar banco de dados
export async function initDatabase() {
  const query = `
    CREATE TABLE IF NOT EXISTS plano_trabalho_analise_historico (
      id_plano_trabalho_analise INTEGER PRIMARY KEY,
      codigo_siorg_orgao_analise_pt_hist INTEGER,
      nome_orgao_analise_pt_hist TEXT,
      situacao_parecer_analise_pt_hist TEXT,
      data_analise_pt_hist TEXT,
      situacao_analise_pt_hist TEXT,
      responsaveis_analise_pt_hist TEXT
    )
  `;
  await dbRun(query);
  console.log('Banco de dados SQLite inicializado.');
}

// Salvar múltiplos registros em lote (upsert)
export async function saveRecords(records) {
  const insertQuery = `
    INSERT OR REPLACE INTO plano_trabalho_analise_historico (
      id_plano_trabalho_analise,
      codigo_siorg_orgao_analise_pt_hist,
      nome_orgao_analise_pt_hist,
      situacao_parecer_analise_pt_hist,
      data_analise_pt_hist,
      situacao_analise_pt_hist,
      responsaveis_analise_pt_hist
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      const stmt = db.prepare(insertQuery);
      
      try {
        for (const record of records) {
          stmt.run([
            record.id_plano_trabalho_analise,
            record.codigo_siorg_orgao_analise_pt_hist || null,
            record.nome_orgao_analise_pt_hist || null,
            record.situacao_parecer_analise_pt_hist || null,
            record.data_analise_pt_hist || null,
            record.situacao_analise_pt_hist || null,
            record.responsaveis_analise_pt_hist || null
          ]);
        }
        stmt.finalize();
        db.run('COMMIT', (err) => {
          if (err) reject(err);
          else resolve();
        });
      } catch (err) {
        db.run('ROLLBACK');
        reject(err);
      }
    });
  });
}

// Obter resumo de estatísticas (KPIs)
export async function getSummary(filters = {}) {
  let whereClause = 'WHERE 1=1';
  const params = [];

  if (filters.orgao && filters.orgao !== 'Todos') {
    whereClause += ' AND nome_orgao_analise_pt_hist = ?';
    params.push(filters.orgao);
  }
  if (filters.status && filters.status !== 'Todos') {
    whereClause += ' AND situacao_analise_pt_hist = ?';
    params.push(filters.status);
  }

  const query = `
    SELECT 
      COUNT(*) as totalAnalises,
      COUNT(DISTINCT id_plano_trabalho_analise) as totalPlanos,
      COUNT(DISTINCT nome_orgao_analise_pt_hist) as totalOrgaos,
      SUM(CASE WHEN situacao_analise_pt_hist = 'Concluída' THEN 1 ELSE 0 END) as concluidas
    FROM plano_trabalho_analise_historico
    ${whereClause}
  `;

  const row = await dbGet(query, params);
  const total = row.totalAnalises || 0;
  const concluidas = row.concluidas || 0;
  const taxaConclusao = total > 0 ? ((concluidas / total) * 100).toFixed(1) : '0.0';

  return {
    totalAnalises: total,
    totalPlanos: row.totalPlanos || 0,
    totalOrgaos: row.totalOrgaos || 0,
    taxaConclusao: parseFloat(taxaConclusao)
  };
}

// Obter dados agregados para os gráficos
export async function getChartsData(filters = {}) {
  let whereClause = 'WHERE 1=1';
  const params = [];

  if (filters.orgao && filters.orgao !== 'Todos') {
    whereClause += ' AND nome_orgao_analise_pt_hist = ?';
    params.push(filters.orgao);
  }
  if (filters.status && filters.status !== 'Todos') {
    whereClause += ' AND situacao_analise_pt_hist = ?';
    params.push(filters.status);
  }

  // 1. Distribuição por Status
  const statusQuery = `
    SELECT situacao_analise_pt_hist as name, COUNT(*) as value
    FROM plano_trabalho_analise_historico
    ${whereClause}
    GROUP BY situacao_analise_pt_hist
  `;
  const statusData = await dbAll(statusQuery, params);

  // 2. Distribuição por Parecer Técnico
  const parecerQuery = `
    SELECT situacao_parecer_analise_pt_hist as name, COUNT(*) as value
    FROM plano_trabalho_analise_historico
    ${whereClause}
    GROUP BY situacao_parecer_analise_pt_hist
    ORDER BY value DESC
  `;
  const parecerData = await dbAll(parecerQuery, params);

  // 3. Top 10 Órgãos
  const orgaosQuery = `
    SELECT nome_orgao_analise_pt_hist as name, COUNT(*) as value
    FROM plano_trabalho_analise_historico
    ${whereClause}
    GROUP BY nome_orgao_analise_pt_hist
    ORDER BY value DESC
    LIMIT 10
  `;
  const orgaosData = await dbAll(orgaosQuery, params);

  // 4. Evolução Temporal (Agrupado por Ano-Mês)
  const timelineQuery = `
    SELECT 
      strftime('%Y-%m', data_analise_pt_hist) as period, 
      COUNT(*) as count
    FROM plano_trabalho_analise_historico
    ${whereClause}
    AND data_analise_pt_hist IS NOT NULL
    GROUP BY period
    ORDER BY period ASC
  `;
  const timelineData = await dbAll(timelineQuery, params);

  return {
    statusData,
    parecerData,
    orgaosData,
    timelineData
  };
}

// Obter dados detalhados para a tabela
export async function getDetailedData(filters = {}) {
  let whereClause = 'WHERE 1=1';
  const params = [];

  if (filters.orgao && filters.orgao !== 'Todos') {
    whereClause += ' AND nome_orgao_analise_pt_hist = ?';
    params.push(filters.orgao);
  }
  if (filters.status && filters.status !== 'Todos') {
    whereClause += ' AND situacao_analise_pt_hist = ?';
    params.push(filters.status);
  }

  const query = `
    SELECT 
      id_plano_trabalho_analise,
      nome_orgao_analise_pt_hist,
      situacao_analise_pt_hist,
      situacao_parecer_analise_pt_hist,
      data_analise_pt_hist,
      responsaveis_analise_pt_hist
    FROM plano_trabalho_analise_historico
    ${whereClause}
    ORDER BY data_analise_pt_hist DESC
    LIMIT 500
  `;
  return await dbAll(query, params);
}

// Listar opções de filtros únicas
export async function getFilterOptions() {
  const orgaos = await dbAll(`
    SELECT DISTINCT nome_orgao_analise_pt_hist 
    FROM plano_trabalho_analise_historico 
    WHERE nome_orgao_analise_pt_hist IS NOT NULL 
    ORDER BY nome_orgao_analise_pt_hist ASC
  `);
  
  const status = await dbAll(`
    SELECT DISTINCT situacao_analise_pt_hist 
    FROM plano_trabalho_analise_historico 
    WHERE situacao_analise_pt_hist IS NOT NULL 
    ORDER BY situacao_analise_pt_hist ASC
  `);

  return {
    orgaos: orgaos.map(o => o.nome_orgao_analise_pt_hist),
    status: status.map(s => s.situacao_analise_pt_hist)
  };
}
