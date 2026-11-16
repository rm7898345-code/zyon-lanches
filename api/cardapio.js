/* Vercel Serverless: cardápio, cupons e config no Upstash Redis
   GET  /api/cardapio -> { ok, cardapio, cupons, config }  (público)
   POST /api/cardapio -> salva { senha, cardapio, cupons, config } (admin) */
'use strict';
const store = require('./_banco');

function enviar(res, codigo, obj) {
  res.writeHead(codigo, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(obj));
}

module.exports = async function(req, res) {
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  if (!store.configurado()) {
    return enviar(res, 503, { error: 'Banco de dados não configurado (defina SUPABASE_URL e SUPABASE_SERVICE_KEY na Vercel)' });
  }

  try {
    if (req.method === 'GET') {
      var partes = await Promise.all([
        store.pegar('zyon:cardapio'),
        store.pegar('zyon:cupons'),
        store.pegar('zyon:config')
      ]);
      var cardapio = [], cupons = [], config = {};
      try { if (partes[0]) cardapio = JSON.parse(partes[0]); } catch (e) {}
      try { if (partes[1]) cupons = JSON.parse(partes[1]); } catch (e) {}
      try { if (partes[2]) config = JSON.parse(partes[2]); } catch (e) {}
      return enviar(res, 200, { ok: true, cardapio: cardapio, cupons: cupons, config: config });
    }

    if (req.method === 'POST') {
      var body = '';
      req.on('data', function(c){ body += c; if (body.length > 5e6) req.destroy(); });
      req.on('end', async function() {
        try {
          var p = JSON.parse(body || '{}');
          var ok = await store.autenticarAdmin(p.senha);
          if (!ok) return enviar(res, 401, { error: 'Senha do administrador incorreta' });
          await Promise.all([
            store.salvar('zyon:cardapio', JSON.stringify(Array.isArray(p.cardapio) ? p.cardapio : [])),
            store.salvar('zyon:cupons', JSON.stringify(Array.isArray(p.cupons) ? p.cupons : [])),
            store.salvar('zyon:config', JSON.stringify(p.config && typeof p.config === 'object' ? p.config : {}))
          ]);
          return enviar(res, 200, { ok: true });
        } catch (e) {
          enviar(res, 500, { error: e.message });
        }
      });
      return;
    }

    enviar(res, 405, { error: 'Use GET ou POST' });
  } catch (e) {
    enviar(res, 500, { error: e.message });
  }
};
