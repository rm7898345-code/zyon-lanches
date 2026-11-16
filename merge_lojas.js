/* Merge: dados OFICIAIS do McDonald's BR (572, com endereço exato e coords)
   + lojas do OpenStreetMap não presentes na lista oficial (cobre outros estados).
   Salva em zyon:lojas (descartável/rode para atualizar) */
'use strict';
const fs = require('fs');
const path = require('path');

fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8').split(/\r?\n/).forEach(function(l) {
  var m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
});
const store = require('./api/_banco.js');

function distancia(lat1, lon1, lat2, lon2) {
  var R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

(async function() {
  var oficiais = JSON.parse(fs.readFileSync(path.join(__dirname, 'lojas_oficiais.json'), 'utf8'));
  var osm = JSON.parse(await store.pegar('zyon:lojas'));

  var finais = [];
  oficiais.forEach(function(l, i) {
    finais.push({
      id: 'of' + i,
      nome: l.nome,
      endereco: l.endereco,
      endereco2: [l.bairro, l.cidade].filter(Boolean).join(', ') + (l.uf ? ' - ' + l.uf : '') + (l.cep ? ', ' + l.cep : ''),
      cidade: l.cidade,
      drive: /drive/i.test(l.nome),
      lat: l.lat, lng: l.lng,
      fonte: 'oficial'
    });
  });

  /* OSM: mantém só as que ficam a mais de 300m de qualquer loja oficial */
  var extra = 0;
  osm.forEach(function(l) {
    var perto = finais.some(function(f) {
      return distancia(l.lat, l.lng, f.lat, f.lng) < 0.3;
    });
    if (perto) return;
    finais.push(l);
    extra++;
  });

  finais.sort(function(a, b){ return a.nome.localeCompare(b.nome, 'pt-BR'); });
  console.log('Oficiais:', oficiais.length, '| extras do OSM:', extra, '| total:', finais.length);

  await store.salvar('zyon:lojas', JSON.stringify(finais));
  await store.salvar('zyon:lojas_atualizado', new Date().toISOString());
  console.log('✔ zyon:lojas atualizado com', finais.length, 'lojas');
  process.exit(0);
})();
