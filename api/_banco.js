/* Helper compartilhado: Supabase (REST/PostgREST, sem SDK) + autenticação do admin
   Variáveis de ambiente necessárias (Vercel e/ou .env.local):
     SUPABASE_URL          ex: https://xxxx.supabase.co
     SUPABASE_SERVICE_KEY  a service_role key (SECRETA — só no servidor!)
   Tabela usada (crie no SQL Editor do Supabase):
     create table if not exists public.zyon_dados (
       chave text primary key,
       valor jsonb not null default '{}'::jsonb,
       atualizado_em timestamptz not null default now()
     );
   Chaves gravadas:
     zyon:cardapio   -> array de itens
     zyon:cupons     -> array de cupons
     zyon:config     -> { chavePix, nomePix, cidadePix }
     zyon:admin_hash -> SHA-256 de senha+'|zyon' (definida no primeiro acesso) */
'use strict';
const https = require('https');
const crypto = require('crypto');

var SUPA_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
var SUPA_KEY = process.env.SUPABASE_SERVICE_KEY || '';

function configurado() { return !!(SUPA_URL && SUPA_KEY); }

/* Chamada REST ao Supabase */
function chamar(metodo, rota, corpo) {
  return new Promise(function(resolve, reject) {
    var url = new URL(SUPA_URL);
    var data = corpo ? JSON.stringify(corpo) : null;
    var headers = {
      'apikey': SUPA_KEY,
      'Authorization': 'Bearer ' + SUPA_KEY,
      'Accept': 'application/json',
      /* upsert: conflito na chave primária atualiza a linha */
      'Prefer': 'resolution=merge-duplicates'
    };
    if (data) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(data); }

    var req = https.request({
      host: url.host,
      path: '/rest/v1' + rota,
      method: metodo,
      headers: headers
    }, function(res) {
      var buf = '';
      res.on('data', function(c){ buf += c; });
      res.on('end', function() {
        var json = null;
        try { json = JSON.parse(buf); } catch (e) {}
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(json || []);
        else reject(new Error('Supabase HTTP ' + res.statusCode + (buf ? ': ' + buf.substring(0, 200) : '')));
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, function(){ req.destroy(new Error('Timeout Supabase')); });
    if (data) req.write(data);
    req.end();
  });
}

/* GET chave -> string JSON (para os chamadores darem JSON.parse) ou null */
async function pegar(chave) {
  var linhas = await chamar('GET', '/zyon_dados?chave=eq.' + encodeURIComponent(chave) + '&select=valor&limit=1');
  if (!linhas || !linhas.length) return null;
  return JSON.stringify(linhas[0].valor);
}

/* SET chave valor (valor chega como string JSON; faz upsert) */
async function salvar(chave, valor) {
  var v;
  try { v = JSON.parse(valor); } catch (e) { v = String(valor); }
  await chamar('POST', '/zyon_dados', { chave: chave, valor: v });
}

/* Autenticação do admin:
   - hash SHA-256 de (senha + '|zyon') comparado com o hash salvo no banco
   - primeiro acesso: grava o hash (a primeira senha enviada define a senha) */
async function autenticarAdmin(senha) {
  if (!senha || typeof senha !== 'string' || senha.length > 128) return false;
  var hash = crypto.createHash('sha256').update(String(senha) + '|zyon').digest('hex');
  var linhas = await chamar('GET', '/zyon_dados?chave=eq.' + encodeURIComponent('zyon:admin_hash') + '&select=valor&limit=1');
  if (!linhas || !linhas.length) {
    await chamar('POST', '/zyon_dados', { chave: 'zyon:admin_hash', valor: hash });
    return true;
  }
  var salvo = linhas[0].valor;
  salvo = (typeof salvo === 'string') ? salvo : String(salvo);
  return salvo === hash;
}

module.exports = { configurado: configurado, pegar: pegar, salvar: salvar, autenticarAdmin: autenticarAdmin };
