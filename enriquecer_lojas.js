/* Enriquece as lojas sem endereço com geocodificação reversa via Photon (descartável) */
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');

fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8').split(/\r?\n/).forEach(function(l) {
  var m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
});
const store = require('./api/_banco.js');

function photonReverse(lat, lng) {
  return new Promise(function(resolve) {
    var path_ = '/reverse?lat=' + lat + '&lon=' + lng + '&limit=1';
    var req = https.request({
      host: 'photon.komoot.io', path: path_, method: 'GET',
      headers: { 'User-Agent': 'ZyonLanches/1.0', 'Accept': 'application/json' },
      timeout: 15000
    }, function(res) {
      var buf = '';
      res.on('data', function(c){ buf += c; });
      res.on('end', function() {
        try {
          var d = JSON.parse(buf);
          var f = (d.features || [])[0];
          resolve(f ? f.properties || {} : null);
        } catch (e) { resolve(null); }
      });
    });
    req.on('timeout', function(){ req.destroy(); resolve(null); });
    req.on('error', function(){ resolve(null); });
    req.end();
  });
}

function esperar(ms) { return new Promise(function(r){ setTimeout(r, ms); }); }

(async function() {
  var lojas = JSON.parse(await store.pegar('zyon:lojas'));
  var alvo = lojas.filter(function(l){ return (!l.endereco || l.endereco === 'Endereço não informado') && !l.endereco2; });
  console.log('Lojas para enriquecer:', alvo.length);

  var feitas = 0, ok = 0;
  for (var i = 0; i < lojas.length; i++) {
    var l = lojas[i];
    if ((l.endereco && l.endereco !== 'Endereço não informado') || l.endereco2) continue;
    var p = await photonReverse(l.lat, l.lng);
    if (p && p.countrycode === 'BR') {
      var rua = p.street || '';
      var num = p.housenumber || '';
      var bairro = p.district || '';
      var cidade = p.city || p.county || '';
      var uf = p.state || '';
      var linha1 = [rua, num].filter(Boolean).join(', ');
      var linha2 = [bairro, cidade].filter(Boolean).join(', ') + (uf && (bairro || cidade) ? ' - ' + uf : uf);
      if (linha1) l.endereco = linha1; else if (linha2 && !l.cidade) l.endereco = '';
      if (linha2) l.endereco2 = linha2;
      if (cidade && !l.cidade) l.cidade = cidade;
      /* Nome genérico ganha a cidade/bairro descobertos */
      if (l.nome === "McDonald's" && (cidade || bairro)) l.nome = "McDonald's — " + (cidade || bairro);
      if (linha1 || linha2) ok++;
    }
    feitas++;
    if (feitas % 50 === 0) console.log(feitas + '/' + alvo.length + ' (endereço obtido em ' + ok + ')');
    await esperar(500); /* educação com a API gratuita */
  }

  console.log('Concluído. Endereço obtido para ' + ok + ' de ' + alvo.length);
  await store.salvar('zyon:lojas', JSON.stringify(lojas));
  console.log('✔ Salvo no Supabase: ' + lojas.length + ' lojas');
  process.exit(0);
})();
