import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  initDatabase, 
  saveRecords, 
  getSummary, 
  getChartsData, 
  getDetailedData, 
  getFilterOptions 
} from './database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// Servir arquivos estáticos gerados pelo build do React (pasta dist)
app.use(express.static(path.join(__dirname, 'dist')));

// Rota de Sincronização (ETL)
app.get('/api/sync', async (req, res) => {
  const limitTotal = parseInt(req.query.limit) || 2000;
  const chunkSize = 500;
  let offset = 0;
  let totalExtracted = 0;
  const url = 'https://api.transferegov.dth.api.gov.br/transferenciasespeciais/plano_trabalho_analise_historico_especial';

  console.log(`Iniciando sincronização de dados (limite: ${limitTotal})...`);

  try {
    while (true) {
      const currentLimit = Math.min(chunkSize, limitTotal - totalExtracted);
      if (currentLimit <= 0) break;

      console.log(`Buscando lote: limit=${currentLimit}, offset=${offset}...`);

      const response = await axios.get(url, {
        params: { limit: currentLimit, offset },
        headers: { 
          'accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
        },
        timeout: 30000
      });

      console.log(`Lote recebido. Status: ${response.status}. Tipo do conteúdo: ${typeof response.data}`);

      // Se a resposta for HTML (provável bloqueio de Cloudflare)
      if (typeof response.data === 'string' && response.data.trim().startsWith('<!DOCTYPE')) {
        throw new Error('O servidor do governo respondeu com uma página HTML em vez de JSON. Possível bloqueio de Cloudflare contra o IP do servidor da Render.');
      }

      const dataList = Array.isArray(response.data) 
        ? response.data 
        : (response.data?.value || []);

      if (dataList.length === 0) {
        console.log('Fim da resposta da API do governo.');
        break;
      }

      await saveRecords(dataList);

      totalExtracted += dataList.length;
      offset += dataList.length;

      if (dataList.length < currentLimit) {
        break; // Não há mais registros
      }

      // Pequeno delay entre requisições
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    res.json({ 
      success: true, 
      message: `Sincronização concluída. ${totalExtracted} registros importados com sucesso.` 
    });
  } catch (error) {
    console.error('Erro na sincronização:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erro durante a sincronização dos dados', 
      error: error.message 
    });
  }
});

// Rota de Métricas Resumidas (KPIs)
app.get('/api/summary', async (req, res) => {
  try {
    const { orgao, status } = req.query;
    const summary = await getSummary({ orgao, status });
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rota para os Gráficos
app.get('/api/charts', async (req, res) => {
  try {
    const { orgao, status } = req.query;
    const chartsData = await getChartsData({ orgao, status });
    res.json(chartsData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rota para Tabela Detalhada
app.get('/api/data', async (req, res) => {
  try {
    const { orgao, status } = req.query;
    const detailedData = await getDetailedData({ orgao, status });
    res.json(detailedData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rota para Obter Filtros Únicos
app.get('/api/filters', async (req, res) => {
  try {
    const filters = await getFilterOptions();
    res.json(filters);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rota Catchall para SPA (React Router / rotas estáticas do frontend)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Inicialização do servidor
async function startServer() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta http://localhost:${PORT}`);
  });
}

startServer();
