/* Vercel Serverless: lista de todas as lojas McDonald's do Brasil (GET /api/lojas)
   Fonte: OpenStreetMap, cacheada no Supabase sob a chave zyon:lojas.
   GET público -> { ok, lojas: [{id,nome,endereco,endereco2,cidade,drive,lat,lng}], atualizado_em } */
'use strict';
const store = require('./_banco');

function enviar(res, codigo, obj) {
  res.writeHead(codigo, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=300',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(obj));
}

module.exports = async function(req, res) {
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (req.method !== 'GET') { return enviar(res, 405, { error: 'Use GET' }); }

  if (!store.configurado()) {
    return enviar(res, 503, { error: 'Banco de dados não configurado' });
  }

  try {
    var brutas = await Promise.all([
      store.pegar('zyon:lojas'),
      store.pegar('zyon:lojas_atualizado')
    ]);
    var lojas = [];
    try { lojas = JSON.parse(brutas[0] || '[]'); } catch (e) {}
    return enviar(res, 200, {
      ok: true,
      lojas: lojas,
      atualizado_em: brutas[1] || null
    });
  } catch (e) {
    enviar(res, 500, { error: e.message });
  }
};
