/* Busca TODAS as lojas McDonald's do Brasil no OpenStreetMap (Overpass)
   e salva no Supabase sob a chave zyon:lojas (descartável/rode para atualizar) */
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');

fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8').split(/\r?\n/).forEach(function(l) {
  var m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
});
const store = require('./api/_banco.js');

/* Consulta Overpass: tudo com brand McDonald dentro da área do Brasil */
var QUERY = [
  '[out:json][timeout:80];',
  'area["ISO3166-1"="BR"]["admin_level"="2"]->.br;',
  'nwr["brand"~"McDonald",i](area.br);',
  'out center;'
].join('\n');

function overpass() {
  return new Promise(function(resolve, reject) {
    var data = 'data=' + encodeURIComponent(QUERY);
    var req = https.request({
      host: 'overpass-api.de', path: '/api/interpreter', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(data), 'User-Agent': 'ZyonLanches/1.0 (site de pedidos)' },
      timeout: 100000
    }, function(res) {
      var buf = [];
      res.on('data', function(c){ buf.push(c); });
      res.on('end', function() {
        if (res.statusCode !== 200) return reject(new Error('Overpass HTTP ' + res.statusCode + ': ' + Buffer.concat(buf).toString('utf8').substring(0, 300)));
        try { resolve(JSON.parse(Buffer.concat(buf).toString('utf8'))); }
        catch (e) { reject(new Error('Resposta inválida do Overpass')); }
      });
    });
    req.on('timeout', function(){ req.destroy(new Error('Timeout Overpass')); });
    req.on('error', reject);
    req.end(data);
  });
}

(async function() {
  try {
    console.log('Consultando Overpass (pode demorar ~30s)…');
    var resp = await overpass();
    var elems = resp.elements || [];
    console.log('Elementos brutos:', elems.length);

    var vistos = {};
    var lojas = [];
    elems.forEach(function(el) {
      var t = el.tags || {};
      /* Só restaurantes/fast-food de verdade (exclui prédios e comércios mal etiquetados) */
      var ehRestaurante = t.amenity === 'fast_food' || t.amenity === 'restaurant';
      var ehBurger = /burger|sandwich/i.test(t.cuisine || '');
      if (!ehRestaurante && !ehBurger) return;
      var coords = (el.lat !== undefined) ? [el.lat, el.lon] : (el.center ? [el.center.lat, el.center.lon] : null);
      if (!coords) return;

      var rua = t['addr:street'] || '';
      var num = t['addr:housenumber'] || '';
      var bairro = t['addr:suburb'] || t['addr:neighbourhood'] || '';
      var cidade = t['addr:city'] || '';
      var uf = (t['addr:state'] || '').replace(/^State of /i, '');

      var linha1 = [rua, num].filter(Boolean).join(', ');
      var linha2 = [bairro, cidade].filter(Boolean).join(', ') + (uf ? (bairro || cidade ? ' - ' : '') + uf : '');

      /* Nome: usa o nome do OSM quando é um nome de loja do McDonald's;
         senão compõe com cidade/bairro/rua para ficar identificável */
      var nome;
      if (t.name && /mcdonald|m[eé]qui|mc\s/i.test(t.name)) {
        nome = t.name;
      } else {
        nome = "McDonald's — " + (cidade || bairro || rua || 'Loja');
      }

      var chave = nome + '|' + linha1 + '|' + coords[0].toFixed(4);
      if (vistos[chave]) return;
      vistos[chave] = true;

      lojas.push({
        id: el.type.charAt(0) + el.id,
        nome: nome,
        endereco: (linha1 || linha2 || 'Endereço não informado'),
        endereco2: linha2,
        cidade: cidade,
        drive: t.drive_through === 'yes' || t['drive_through'] === 'yes',
        lat: Math.round(coords[0] * 100000) / 100000,
        lng: Math.round(coords[1] * 100000) / 100000
      });
    });

    lojas.sort(function(a, b){ return a.nome.localeCompare(b.nome, 'pt-BR'); });
    console.log('Lojas únicas:', lojas.length);
    console.log('Exemplos:', lojas.slice(0, 5).map(function(l){ return l.nome; }).join(' | '));

    await store.salvar('zyon:lojas', JSON.stringify(lojas));
    await store.salvar('zyon:lojas_atualizado', new Date().toISOString());
    var conf = await store.pegar('zyon:lojas');
    var n = JSON.parse(conf).length;
    console.log('✔ ' + n + ' lojas salvas no Supabase (chave zyon:lojas)');
    process.exit(0);
  } catch (e) {
    console.log('✖ ERRO:', e.message);
    process.exit(1);
  }
})();
