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

  async function pageCollect(BASE) {
    const LOGIN = 'LOGIN';
    try {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const hdr = { 'X-Requested-With': 'XMLHttpRequest' };
      const chk = r => {
        if (/\/Home\/Login/i.test(r.url) || r.status === 401 || r.status === 403) throw new Error(LOGIN);
        if (!r.ok) throw new Error('MWR a répondu ' + r.status);
        return r;
      };
      const asJson = async r => { chk(r); const t = await r.text(); try { return JSON.parse(t); } catch (e) { throw new Error(LOGIN); } };
      const post = (path, body) => fetch(BASE + path, { method: 'POST', credentials: 'include', headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, hdr), body: JSON.stringify(body) }).then(asJson);
      const get = path => fetch(BASE + path, { credentials: 'include', headers: hdr }).then(asJson);
  
      const page = chk(await fetch(BASE + '/bizcenter/dashboard', { credentials: 'include' }));
      const html = await page.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const uIn = doc.getElementById('username'), jn = doc.getElementById('MenuItemJoinNow');
      const me = (uIn && uIn.value) || (jn && ((/^\/([^/]+)\/join/.exec(jn.getAttribute('href') || '') || [])[1]))
        || (html.match(/username=([A-Za-z0-9_.-]+)/) || [])[1];
      if (!me || doc.querySelector('input[type=password]')) throw new Error(LOGIN);
  
      const clean = s => (s || '').replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim();
      const qual = c => { const m = /qualifying-status-(\d+)/.exec(c || ''); return m ? +m[1] : null; };
      const slim = n => {
        if (!n || n.className === 'new') return null;
        if (n.className === 'load-more') return { more: (n.label || '').split('|')[0] || null };
        return { id: n.id, user: n.username || ((/--(.+?)--/.exec(n.className) || [])[1]) || null, name: clean(n.name || n.label),
          side: n.text === 'LEFT' ? 'G' : n.text === 'RIGHT' ? 'D' : null, pts: n.TrinaryPoints || 0, team: n.TrinaryTeam || 0,
          date: n.EnrollDate, q: qual(n.className), sponsor: n.SponsorId || n.parentid || null,
          children: (n.children || []).map(slim).filter(Boolean) };
      };
      const expand = async (node, depth) => {
        if (!node || !node.children) return;
        const more = [...new Set(node.children.filter(c => c.more).map(c => c.more))];
        node.children = node.children.filter(c => !c.more);
        if (more.length && depth < 80) {
          await sleep(300);
          const sub = slim((await post('/ajax/GetBinaryTree', { id: more[0] })).treeData);
          if (sub) node.children = sub.children;
        }
        for (const c of node.children) await expand(c, depth + 1);
      };
      const tree = slim((await post('/ajax/GetMyBinaryTree', { id: me })).treeData);
      if (!tree) throw new Error('Arbre vide');
      await expand(tree, 0);
  
      const KEEP = ['JoinDate','LEVEL','PositionLeftOrRight','FirstName','LastName','Country','StatusBizCenter','StatusMembership','StatusQualified','Position','LifeTimeRank','RankDate','LeftTeamPoints','RightTeamPoints','CustomerPoints','DirectUpline','Sponsor','CellPhone','Email'];
      const team = []; let start = 0, total = Infinity;
      while (start < total && start < 50000) {
        const q = new URLSearchParams({ sEcho: 1, iColumns: KEEP.length, iDisplayStart: start, iDisplayLength: 500, sSearch: '', iSortingCols: 1, iSortCol_0: 0, sSortDir_0: 'asc' });
        KEEP.forEach((c, i) => { q.set('mDataProp_' + i, c); q.set('bSortable_' + i, 'true'); q.set('bSearchable_' + i, 'true'); });
        const r = await fetch(BASE + '/api/MwrApi/TriLineGridReport?username=' + encodeURIComponent(me), { method: 'POST', credentials: 'include', body: q,
          headers: Object.assign({ 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }, hdr) }).then(asJson);
        const rows = r.aaData || r.data || [];
        total = +(r.iTotalRecords || r.recordsTotal || rows.length);
        rows.forEach(row => { const o = {}; KEEP.forEach(k => { if (row[k] != null) o[k] = row[k]; }); team.push(o); });   // téléphone et e-mail : affichés seulement dans la fiche du membre
        if (!rows.length) break;
        start += rows.length; await sleep(300);
      }
      let rank = null, residual = null;
      try { rank = await get('/Ajax/GetRankProgressbizcenter'); } catch (e) {}
      try { residual = await get('/Ajax/DailyResidualBizcenterExtended'); } catch (e) {}
      return { data: { version: 1, collectedAt: new Date().toISOString(), username: me, tree, team, rank, residual } };
    } catch (e) {
      return e && e.message === LOGIN ? { login: true } : { error: (e && e.message) || String(e) };
    }
  }
  
  pageCollect(BASE).then(function (res) {
    if (res && res.login) {
      say('NOVA Tree : vous n\'êtes pas connecté à MWR.<br>Connectez-vous sur cette page (cochez « Rester connecté »), puis relancez NOVA Tree.', '#b45309');
      if (!/\/Home\/Login/i.test(location.pathname)) setTimeout(function () { location.href = BASE + '/Home/Login'; }, 2500);
      return done();
    }
    if (!res || !res.data) { say('NOVA Tree : lecture impossible (' + ((res && res.error) || 'erreur inconnue') + '). Réessayez.', '#b42318'); return done(); }
    say('✓ ' + res.data.team.length + ' membres lus. Ouverture de NOVA Tree…', '#15803d');
    return encode(res.data).then(function (payload) {
      if (!APP) { say('NOVA Tree : adresse de l\'application inconnue. Réinstallez le lanceur.', '#b42318'); return done(); }
      location.href = APP + '#d=' + payload;
    });
  }).catch(function (e) { say('NOVA Tree : erreur — ' + (e && e.message || e), '#b42318'); done(); });
})();
