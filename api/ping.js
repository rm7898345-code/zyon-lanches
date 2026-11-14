/* Vercel Serverless: verificação (GET /api/ping) — com diagnóstico */
module.exports = function(req, res) {
  var hasId = !!process.env.SYNC_CLIENT_ID;
  var hasSecret = !!process.env.SYNC_CLIENT_SECRET;
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    syncConfigurada: hasId && hasSecret,
    diagnostico: {
      'SYNC_CLIENT_ID existe?': hasId,
      'SYNC_CLIENT_SECRET existe?': hasSecret
    },
    modo: 'vercel'
  }));
};
