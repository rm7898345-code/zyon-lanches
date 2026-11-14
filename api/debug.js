/* Vercel Serverless: debug da consulta de transação (GET /api/debug?id=...) */
'use strict';
const https = require('https');
const SYNC_API = 'api.syncpayments.com.br';

function chamadaBruta(metodo, rota, corpo, token) {
  return new Promise(function(resolve, reject) {
    var data = corpo ? JSON.stringify(corpo) : null;
    var headers = { 'Accept': 'application/json', 'Host': SYNC_API };
    if (data) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(data); }
    if (token) headers['Authorization'] = 'Bearer ' + token;
    var req = https.request({ host: SYNC_API, path: '/api/partner/v1' + rota, method: metodo, headers: headers }, function(res) {
      var buf = '';
      res.on('data', function(c){ buf += c; });
      res.on('end', function() { resolve({ status: res.statusCode, body: buf.substring(0, 800) }); });
    });
    req.on('error', reject);
    req.setTimeout(15000, function(){ req.destroy(new Error('timeout')); });
    if (data) req.write(data);
    req.end();
  });
}

var tokenCache = { token: null };
async function pegarToken() {
  if (tokenCache.token) return tokenCache.token;
  var d = await chamadaBruta('POST', '/auth-token', {
    client_id: process.env.SYNC_CLIENT_ID,
    client_secret: process.env.SYNC_CLIENT_SECRET
  });
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
    /* 1. V1: GET /transaction/{identifier} */
    testes['v1_transaction_id'] = await chamadaBruta('GET', '/transaction/' + id, null, token);
    /* 2. V1: GET /transaction?id=... */
    testes['v1_query'] = await chamadaBruta('GET', '/transaction?id=' + id, null, token);
    /* 3. V2: transação por reference_id */
    testes['v2_venda'] = await chamadaBruta('GET', '/transaction/' + id + '?source=api', null, token);

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ id: id, testes: testes }, null, 2));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: e.message }));
  }
};
