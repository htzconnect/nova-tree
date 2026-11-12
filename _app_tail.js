/* ===================== WebApp : réception et affichage des données ===================== */
const BASE = 'https://www.mwrlife.com';
const STORE = 'mwr-data-v1';
const STALE_H = 12;                       // au-delà, on propose une mise à jour
let model = null;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = /Android/i.test(navigator.userAgent);

// Les données arrivent par l'adresse de la page : on ne fait confiance à rien et on reconstruit tout, champ par champ.
const S = v => v == null ? '' : String(v).slice(0, 300);
const N = v => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const TEAM_STR = ['JoinDate', 'LEVEL', 'PositionLeftOrRight', 'FirstName', 'LastName', 'Country', 'StatusBizCenter', 'StatusMembership', 'StatusQualified', 'Position', 'LifeTimeRank', 'RankDate', 'DirectUpline', 'Sponsor', 'CellPhone', 'Email'];
const TEAM_NUM = ['LeftTeamPoints', 'RightTeamPoints', 'CustomerPoints'];
function sanitize(raw) {
  if (!raw || typeof raw !== 'object' || !raw.tree || !Array.isArray(raw.team)) throw new Error('données non reconnues');
  let count = 0;
  const node = n => {
    if (!n || typeof n !== 'object' || ++count > 50000) return null;
    return { id: S(n.id), user: n.user ? S(n.user) : null, name: S(n.name), side: n.side === 'G' || n.side === 'D' ? n.side : null,
      pts: N(n.pts), team: N(n.team), date: S(n.date), q: n.q == null ? null : N(n.q), sponsor: S(n.sponsor),
      children: Array.isArray(n.children) ? n.children.slice(0, 2).map(node).filter(Boolean) : [] };
  };
  const team = raw.team.slice(0, 50000).map(r => {
    const o = {}; if (!r || typeof r !== 'object') return o;
    TEAM_STR.forEach(k => { if (r[k] != null) o[k] = S(r[k]); });
    TEAM_NUM.forEach(k => { if (r[k] != null) o[k] = N(r[k]); });
    return o;
  });
  const rs = raw.residual && typeof raw.residual === 'object' ? raw.residual : null;
  const residual = rs ? { CurrentLevel: N(rs.CurrentLevel), Progr: N(rs.Progr), CurrentEarning: N(rs.CurrentEarning), leftSide: S(rs.leftSide), rightSide: S(rs.rightSide), Images: S(rs.Images) } : null;
  const d = new Date(raw.collectedAt);
  const tree = node(raw.tree);
  if (!tree) throw new Error('arbre vide');
  return { version: 1, collectedAt: isNaN(d) ? new Date().toISOString() : d.toISOString(), username: S(raw.username), tree, team, residual };
}
// Format transmis par le lanceur : "z." + base64url(gzip(JSON))  ou  "j." + base64url(JSON)
async function decodePayload(str) {
  const kind = str.slice(0, 2);
  const b64 = decodeURIComponent(str.slice(2)).replace(/-/g, '+').replace(/_/g, '/');
  const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  if (kind === 'z.') {
    const stream = new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'));
    return JSON.parse(await new Response(stream).text());
  }
  if (kind === 'j.') return JSON.parse(new TextDecoder().decode(bin));
  throw new Error('format inconnu');
}

function load(raw) { model = build(raw); renderDash(model); renderTree(model); renderTeam(model); }
function save(raw) { try { localStorage.setItem(STORE, JSON.stringify(raw)); } catch (e) {} }
function cached() { try { const r = JSON.parse(localStorage.getItem(STORE) || 'null'); return r ? sanitize(r) : null; } catch (e) { return null; } }
function setStatus(txt) { $('#stamp').textContent = txt; }
function stampText() {
  if (!model) return '';
  const cd = new Date(model.raw.collectedAt), mins = Math.round((Date.now() - cd) / 60000);
  return 'Mis à jour ' + (mins < 1 ? 'à l\'instant' : mins < 60 ? 'il y a ' + mins + ' min' : mins < 1440 ? 'il y a ' + Math.round(mins / 60) + ' h' : 'le ' + fmtD(cd) + ' à ' + pad(cd.getHours()) + 'h' + pad(cd.getMinutes()));
}
function banner(kind, html) {
  const b = $('#banner');
  if (!kind) { b.hidden = true; b.innerHTML = ''; return; }
  b.hidden = false; b.className = 'banner ' + kind; b.innerHTML = html;
  const u = b.querySelector('[data-update]'); if (u) u.addEventListener('click', openUpdate);
}
function isStale() { return !model || (Date.now() - new Date(model.raw.collectedAt)) / 3600000 > STALE_H; }

async function importFromHash() {
  const m = /^#d=(.+)$/.exec(location.hash);
  if (!m) return false;
  history.replaceState(null, '', location.pathname + location.search);   // on retire les données de l'adresse
  try {
    const raw = sanitize(await decodePayload(m[1]));
    save(raw); load(raw);
    banner('ok', '<b>✓ Données mises à jour.</b> ' + plural(raw.team.length, 'membre', 'membres') + ' importés depuis MWR.');
    setTimeout(() => { if ($('#banner').classList.contains('ok')) banner(null); }, 5000);
    return true;
  } catch (e) {
    banner('bad', '<b>Import impossible :</b> ' + esc(e.message) + '. Relancez NOVA Tree depuis la page MWR.');
    return false;
  }
}

/* ---- Mise à jour : on passe par la page MWR (connexion faite par vous, sur le vrai site) ---- */
function launcherHint() {
  if (isIOS) return 'touchez <b>Partager</b> <span class="ico">⬆︎</span> puis <b>NOVA Tree</b> (ou votre favori NOVA Tree)';
  if (isAndroid) return 'tapez <b>NOVA</b> dans la barre d\'adresse et choisissez le favori <b>NOVA Tree</b>';
  return 'cliquez sur le favori <b>NOVA Tree</b> de votre barre de favoris';
}
function openUpdate() {
  $('#updHint').innerHTML = launcherHint();
  $('#upd').showModal();
}

/* ---- Démarrage ---- */
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
  showTab(t.dataset.tab);
  if (t.dataset.tab === 'tree' && model && treeState.view === 'org' && org.fit) requestAnimationFrame(() => { orgFit(); org.fit = false; });
}));
$('#refreshBtn').addEventListener('click', openUpdate);
$('#updClose').addEventListener('click', () => $('#upd').close());
$('#updGo').addEventListener('click', () => { location.href = BASE + '/bizcenter/dashboard'; });
$('#themeBtn').addEventListener('click', () => {
  const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const nx = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = nx; try { localStorage.setItem('mwr-theme', nx); } catch (e) {}
});
try { const th = localStorage.getItem('mwr-theme'); if (th) document.documentElement.dataset.theme = th; } catch (e) {}
setInterval(() => { if (model) setStatus(stampText()); }, 60000);
window.addEventListener('hashchange', () => { importFromHash().then(() => setStatus(stampText())); });

(async () => {
  const imported = await importFromHash();
  if (!imported) {
    const c = cached();
    if (c) { try { load(c); } catch (e) { model = null; } }
  }
  setStatus(stampText());
  if (!model) {
    $('#dash').innerHTML = `<div class="card welcome">
      <h2>Bienvenue sur NOVA Tree</h2>
      <p>Votre tableau de bord MWR Life, sur ordinateur et sur mobile. Les données restent sur votre appareil.</p>
      <ol>
        <li><b>Une seule fois :</b> installez le lanceur NOVA Tree. <a class="btn" href="installer.html">Voir l'installation</a></li>
        <li>Touchez <b>Mettre à jour</b> : connectez-vous sur MWR si besoin, puis ${launcherHint()}.</li>
      </ol>
      <button class="btn primary" data-update>↻ Mettre à jour maintenant</button>
    </div>`;
    $('#dash').querySelector('[data-update]').addEventListener('click', openUpdate);
  } else if (isStale() && !imported) {
    banner('info', 'Vos données datent de plus de ' + STALE_H + ' h. <button class="btn primary" data-update>↻ Mettre à jour</button>');
  }
})();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});
