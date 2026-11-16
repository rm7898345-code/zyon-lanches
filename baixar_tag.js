/* Baixa a página de restaurantes do McDonald's BR e extrai a tabela (descartável) */
'use strict';
const https = require('https');
const fs = require('fs');

https.get({
  host: 'cupons.mcdonalds.com.br', path: '/tag',
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0 Safari/537.36', 'Accept': 'text/html' },
  timeout: 60000
}, function(res) {
  var parts = [];
  res.on('data', function(c){ parts.push(c); });
  res.on('end', function() {
    var html = Buffer.concat(parts).toString('utf8');
    fs.writeFileSync('tag_raw.html', html, 'utf8');
    console.log('HTTP', res.statusCode, '| tamanho:', html.length, '| linhas com MCDONALD:', (html.match(/MCDONALD'S?/gi) || []).length);
  });
}).on('error', function(e){ console.log('ERRO:', e.message); process.exit(1); });
