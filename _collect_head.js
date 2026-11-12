/* NOVA Tree — script de collecte, exécuté sur une page www.mwrlife.com par le favori ou le raccourci iPhone.
   Il lit votre réseau avec VOTRE session MWR (aucun identifiant n'est manipulé ici), puis renvoie les données
   à la WebApp dans l'adresse de la page (#d=…). Les données ne passent par aucun serveur. */
(function () {
  if (window.__novaRunning) return;
  window.__novaRunning = true;
  var me = document.currentScript;
  var APP = window.__NOVA_APP || (me && me.src ? me.src.replace(/collect\.js.*$/, '') : '');
  var BASE = 'https://www.mwrlife.com';

  var box = document.createElement('div');
  box.style.cssText = 'position:fixed;z-index:2147483647;left:50%;top:16px;transform:translateX(-50%);max-width:calc(100% - 32px);background:#16161a;color:#fff;padding:14px 18px;border-radius:12px;font:600 15px/1.4 -apple-system,system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.35);text-align:center';
  var say = function (t, bg) { box.innerHTML = t; if (bg) box.style.background = bg; };
  var done = function () { window.__novaRunning = false; };
  (document.body || document.documentElement).appendChild(box);

  if (!/(^|\.)mwrlife\.com$/.test(location.hostname)) {
    say('NOVA Tree : ouvrez d\'abord <b>mwrlife.com</b>, connectez-vous, puis relancez NOVA Tree.<br><a href="' + BASE + '/Home/Login" style="color:#a5b4fc">Aller sur MWR →</a>', '#b42318');
    done(); return;
  }
  say('NOVA Tree : lecture de votre réseau… <br><small style="font-weight:500;opacity:.8">environ 10 secondes</small>');

  function encode(obj) {
    var bytes = new TextEncoder().encode(JSON.stringify(obj));
    var toB64 = function (u8) {
      var s = ''; for (var i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    };
    if (window.CompressionStream) {
      var cs = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
      return new Response(cs).arrayBuffer().then(function (b) { return 'z.' + toB64(new Uint8Array(b)); });
    }
    return Promise.resolve('j.' + toB64(bytes));
  }

