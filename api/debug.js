/* Vercel Serverless: debug da consulta de transação (GET /api/debug?id=...) */
'use strict';
const https = require('https');
const SYNC_API = 'api.syncpayments.com.br';

function chamadaBruta(metodo, rota, token) {
  return new Promise(function(resolve, reject) {
    var req = https.request({
      host: SYNC_API, path: '/api/partner/v1' + rota, method: metodo,
      headers: { 'Accept': 'application/json', 'Host': SYNC_API, 'Authorization': 'Bearer ' + token }
    }, function(res) {
      var buf = '';
      res.on('data', function(c){ buf += c; });
      res.on('end', function() { resolve({ status: res.statusCode, body: buf.substring(0, 500) }); });
    });
    req.on('error', reject);
    req.setTimeout(15000, function(){ req.destroy(new Error('timeout')); });
    req.end();
  });
}

var tokenCache = { token: null };
async function pegarToken() {
  if (tokenCache.token) return tokenCache.token;
  var d = await chamadaBruta('POST', '/auth-token', JSON.stringify({
    client_id: process.env.SYNC_CLIENT_ID,
    client_secret: process.env.SYNC_CLIENT_SECRET
  }).replace(/^/, ''), null);
  var corpo = JSON.parse(d.body || '{}');
  if (!corpo.access_token) throw new Error('auth falhou: HTTP ' + d.status + ' ' + d.body);
  tokenCache.token = corpo.access_token;
  return corpo.access_token;
}

module.exports = async function(req, res) {
  try {
    var qs = new URLSearchParams((req.url.split('?')[1] || ''));
    var id = (qs.get('id') || '').replace(/[^a-zA-Z0-9-]/g, '');
    var token = await pegarToken();

    var testes = {};
    /* 1. V1 com barra */
    testes['v1_barra'] = await chamadaBruta('GET', '/transaction/' + id, token).catch(function(e){ return { erro: e.message }; });
    /* 2. V1 sem barra final */
    testes['v1_simples'] = await chamadaBruta('GET', '/transaction?id=' + id, token).catch(function(e){ return { erro: e.message }; });
    /* 3. V2 por reference_id */
    testes['v2_transaction'] = await chamadaBruta('GET', '/transaction/' + id + '?source=api', token).catch(function(e){ return { erro: e.message }; });

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ id: id, tokenPrimeiros8: token.substring(0, 8), testes: testes }, null, 2));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: e.message }));
  }
};
