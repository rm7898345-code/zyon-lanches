/* Extrai as fotos base64 do Cheeseburger e Chicken Jr. para arquivos (descartável) */
'use strict';
const fs = require('fs');
const path = require('path');
fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8').split(/\r?\n/).forEach(function(l) {
  var m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
});
const store = require('./api/_banco.js');

(async function() {
  var cardapio = JSON.parse(await store.pegar('zyon:cardapio'));
  var chz = cardapio.find(function(i){ return /cheeseburger/i.test(i.nome) && !/combo/i.test(i.nome); });
  var cj = cardapio.find(function(i){ return /chicken\s*jr/i.test(i.nome) && !/combo/i.test(i.nome); });

  function salvarFoto(item, nome) {
    var f = String(item.foto || '');
    var m = f.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!m) { console.log('sem foto dataURL para', item.nome); return null; }
    var ext = m[1] === 'image/png' ? 'png' : 'jpg';
    var arquivo = path.join(__dirname, 'img_promo_' + nome + '.' + ext);
    fs.writeFileSync(arquivo, Buffer.from(m[2], 'base64'));
    console.log('✔', arquivo, '(' + Math.round(fs.statSync(arquivo).size/1024) + ' KB)');
    return arquivo;
  }
  salvarFoto(chz, 'cheeseburger');
  salvarFoto(cj, 'chickenjr');
  process.exit(0);
})();
