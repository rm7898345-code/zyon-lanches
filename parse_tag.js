/* Parseia a tabela oficial de restaurantes do McDonald's BR (descartável) */
'use strict';
const fs = require('fs');

var html = fs.readFileSync('tag_raw.html', 'utf8');

/* Cada <tr> tem 8 <td>: nome, endereco, bairro, cidade, uf, cep, lat, long */
var linhas = html.split(/<tr[^>]*>/).slice(1);
var lojas = [];
linhas.forEach(function(bloco) {
  var tds = bloco.split(/<td[^>]*>/).slice(1).map(function(t) {
    return t.replace(/<[^>]*>/g, ' ')
            .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ').trim();
  });
  if (tds.length < 8) return;
  var nome = tds[0], endereco = tds[1], bairro = tds[2], cidade = tds[3], uf = tds[4], cep = tds[5];
  var lat = parseFloat((tds[6] || '').replace(',', '.'));
  var lng = parseFloat((tds[7] || '').replace(',', '.'));
  if (!nome || isNaN(lat) || isNaN(lng)) return;
  lojas.push({ nome: nome, endereco: endereco, bairro: bairro, cidade: cidade, uf: uf, cep: cep, lat: lat, lng: lng });
});

console.log('Lojas parseadas:', lojas.length);
var ufs = {};
lojas.forEach(function(l){ ufs[l.uf] = (ufs[l.uf] || 0) + 1; });
console.log('Por UF:', JSON.stringify(ufs));
var cotia = lojas.filter(function(l){ return /cotia/i.test(l.cidade + l.nome); });
console.log('Cotia:', JSON.stringify(cotia, null, 1));
fs.writeFileSync('lojas_oficiais.json', JSON.stringify(lojas), 'utf8');
console.log('Salvo em lojas_oficiais.json');
