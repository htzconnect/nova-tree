/* NOVA Tree — généré par build_webapp.py, ne pas modifier à la main */
/* ===================== Tableau de bord ===================== */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const ymd = d => d ? d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) : '';
const fmtD = d => d ? pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() : '—';
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const titleCase = s => (s || '').toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
function short(name) { const p = titleCase(name).split(' ').filter(Boolean); return p.length < 2 ? (p[0] || '?') : p.slice(0, -1).join(' ') + ' ' + p[p.length - 1][0] + '.'; }
function treeDate(s) { const m = /(\d+)\/(\d+)\/(\d+)/.exec(s || ''); return m ? new Date(+m[3], +m[1] - 1, +m[2]) : null; }
function gridDate(s) { const m = /(\d+)-(\d+)-(\d+)/.exec(s || ''); return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null; }
const fixDots = s => s.replace(/\.\.(\s|$)/g, '.$1');
const plural = (n, one, many) => n + ' ' + (n > 1 ? many : one);
const RANKS = ['Silver', 'Gold', 'Platinum', 'Titanium', 'Jade', 'Pearl', 'Ruby', 'Émeraude', 'Diamond'];
const STATUS = { actif: 'Actif', suspendu: 'Suspendu', annule: 'Annulé' };
const PTS_PER_MEMBER = 6;

function build(raw) {
  const refD = new Date(raw.collectedAt);
  const ref = new Date(refD.getFullYear(), refD.getMonth(), refD.getDate());
  const age = d => d ? Math.round((ref - d) / 864e5) : 9999;
  const grid = new Map();
  // Rapprochement arbre ↔ grille par nom + date d'inscription. Une ligne ne sert qu'une fois (homonymes inscrits le même jour).
  (raw.team || []).forEach(r => { const k = norm((r.FirstName || '') + (r.LastName || '')) + '|' + ymd(gridDate(r.JoinDate)); (grid.get(k) || grid.set(k, []).get(k)).push(r); });
  const nodes = [];
  (function walk(n, parent, depth, leg) {
    n.parent = parent; n.depth = depth; n.leg = leg; n.join = treeDate(n.date); n.age = age(n.join);
    const gl = depth === 0 ? null : grid.get(norm(n.name) + '|' + ymd(n.join));   // la racine (vous) n'est jamais dans la grille
    n.g = gl && gl.length ? gl.shift() : null;
    const g = n.g;
    if (g) n.status = g.StatusMembership === 'Annulé' ? 'annule' : (g.StatusMembership === 'Suspendu' || g.StatusQualified !== 'Qualifié') ? 'suspendu' : 'actif';
    else n.status = n.q === 2 ? 'annule' : n.q === 0 ? 'suspendu' : 'actif';
    n.children.sort((a, b) => (a.side === 'G' ? 0 : 1) - (b.side === 'G' ? 0 : 1));
    n.L = n.children.find(c => c.side === 'G') || null;
    n.R = n.children.find(c => c.side === 'D') || null;
    nodes.push(n);
    n.children.forEach(c => walk(c, n, depth + 1, depth === 0 ? c.side : leg));
  })(raw.tree, null, 0, null);
  const desc = n => n.children.flatMap(c => [c, ...desc(c)]);
  nodes.forEach(n => {
    const d = desc(n);
    n.desc = d; n.size = d.length;
    n.n30 = d.filter(x => x.age <= 30).length;
    n.p30 = d.filter(x => x.age > 30 && x.age <= 60).length;
    n.lastAge = d.length ? Math.min(...d.map(x => x.age)) : null;
    n.qual = d.filter(x => x.status === 'actif').length;                 // qualifiés sous lui
    n.accounts = 1 + n.size;                                            // lui + son équipe
    n.qualAll = n.qual + (n.status === 'actif' ? 1 : 0);
  });
  const root = raw.tree;
  const members = nodes.slice(1);
  const byId = new Map(nodes.map(n => [n.id, n]));
  return { raw, ref, root, nodes, members, byId };
}

function renderDash(m) {
  const { raw, ref, root, members } = m;
  const lp = root.L ? root.L.pts : +(raw.residual && raw.residual.leftSide || 0);
  const rp = root.R ? root.R.pts : +(raw.residual && raw.residual.rightSide || 0);
  const weak = lp <= rp ? 'gauche' : 'droite', gap = Math.abs(lp - rp), need = Math.ceil(gap / PTS_PER_MEMBER);
  const n7 = members.filter(x => x.age <= 7), p7 = members.filter(x => x.age > 7 && x.age <= 14);
  const n30 = members.filter(x => x.age <= 30).length;
  const act = members.filter(x => x.status === 'actif'), sus = members.filter(x => x.status === 'suspendu'), ann = members.filter(x => x.status === 'annule');
  const rate = members.length ? Math.round(act.length / members.length * 100) : 0;
  // Rang Dual Team : niveau résiduel (1 = Silver, 2 = Gold…) et % vers le niveau suivant
  const res = raw.residual || {};
  const lvl = +res.CurrentLevel || +((/(\d+)/.exec(res.Images || '') || [])[1]) || 0;
  const cur = lvl ? (RANKS[lvl - 1] || 'Niveau ' + lvl) : 'Aucun';
  const next = RANKS[lvl] || null;
  const pct = res.Progr != null && res.Progr !== '' ? Math.max(0, Math.min(100, Math.round(+res.Progr))) : null;
  const solde = res.CurrentEarning != null && res.CurrentEarning !== '' ? '$' + res.CurrentEarning : null;
  const first = titleCase((root.name || '').split(' ')[0]);

  $('#date').textContent = cap(ref.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }));
  $('#hello').textContent = 'Bonjour ' + first + ', ton équipe a fait ' + (n7.length ? plural(n7.length, 'nouvelle inscription', 'nouvelles inscriptions') : 'aucune nouvelle inscription') + ' cette semaine';
  const cd = new Date(raw.collectedAt);
  $('#stamp').textContent = 'Données du ' + fmtD(cd) + ' à ' + pad(cd.getHours()) + 'h' + pad(cd.getMinutes());

  // Classement des lignes
  const leaders = members.filter(x => x.size >= 2 && x.status !== 'annule')
    .sort((a, b) => b.n30 - a.n30 || b.size - a.size || b.pts - a.pts).slice(0, 7);
  const trend = x => x.n30 > x.p30 ? ['En hausse', 'up'] : x.n30 < x.p30 ? ['En baisse', 'down'] : ['Stable', ''];

  // Alertes & actions
  const items = [], todos = [];
  if (gap > 0) {
    items.push(['ALERTE', 'Branche ' + weak + ' en retard de ' + gap + ' points.', 'Environ ' + plural(need, 'inscrit qualifié', 'inscrits qualifiés') + ' côté ' + weak + ' pour équilibrer (' + lp + ' / ' + rp + ').']);
    todos.push('Placer la prochaine inscription côté ' + weak);
  }
  if (sus.length) {
    const under = sus.reduce((s, x) => s + x.size, 0);
    items.push(['ALERTE', plural(sus.length, 'membre suspendu', 'membres suspendus') + ' : ' + sus.map(x => short(x.name)).join(', ') + '.', under ? under + ' personnes dans leurs équipes : à contacter avant annulation.' : 'À contacter avant annulation.']);
    todos.push('Appeler ' + sus.map(x => short(x.name)).join(', '));
  }
  members.filter(x => x.size >= 3 && x.status === 'actif' && x.lastAge != null && x.lastAge > 45)
    .sort((a, b) => b.size - a.size).slice(0, 2).forEach(x => {
      items.push(['RELANCE', 'Ligne de ' + short(x.name) + ' : aucun inscrit depuis ' + x.lastAge + ' jours.', 'Équipe de ' + x.size + ' personnes. Proposer un point de 15 min.']);
    });
  const bravo = members.filter(x => x.g && x.g.LifeTimeRank && x.g.LifeTimeRank !== 'Lifestyle Ambassador' && gridDate(x.g.RankDate) && Math.round((ref - gridDate(x.g.RankDate)) / 864e5) <= 14);
  if (bravo.length) {
    items.push(['BRAVO', bravo.map(x => short(x.name) + ' vient de passer ' + x.g.LifeTimeRank.toUpperCase()).join(' · ') + '.', 'Féliciter dans le groupe de l\'équipe.']);
    todos.push('Féliciter ' + bravo.map(x => short(x.name)).join(', '));
  }
  if (n7.length) {
    items.push(['ACCUEIL', plural(n7.length, 'nouveau membre', 'nouveaux membres') + ' cette semaine : ' + n7.map(x => short(x.name)).join(', ') + '.', 'Message de bienvenue et premier rendez-vous de démarrage.']);
    todos.push('Message de bienvenue à ' + n7.map(x => short(x.name)).join(', '));
  }
  if (ann.length) items.push(['INFO', plural(ann.length, 'adhésion annulée', 'adhésions annulées') + ' dans l\'arbre.', ann.map(x => short(x.name)).join(', ') + '.']);
  todos.push('Publier le classement de la semaine');

  // Inscriptions par mois
  const months = [];
  const firstJoin = members.reduce((a, x) => x.join && (!a || x.join < a) ? x.join : a, null) || ref;
  for (let d = new Date(firstJoin.getFullYear(), firstJoin.getMonth(), 1); d <= ref; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) months.push(d);
  const lastMonths = months.slice(-10);
  const mc = lastMonths.map(d => {
    const inM = members.filter(x => x.join && x.join.getFullYear() === d.getFullYear() && x.join.getMonth() === d.getMonth());
    return { d, l: inM.filter(x => x.leg === 'G').length, r: inM.filter(x => x.leg === 'D').length };
  });
  const mmax = Math.max(1, ...mc.map(x => x.l + x.r));

  const todoKey = 'mwr-todo-' + ymd(ref);
  let done = {}; try { done = JSON.parse(localStorage.getItem(todoKey) || '{}'); } catch (e) {}

  const total = lp + rp || 1;
  $('#dash').innerHTML = `
  <div class="card">
    <div class="rank-h"><h2>${next ? 'Prochain rang : ' + esc(next.toUpperCase()) : 'Rang maximum atteint'}</h2>
      <div class="r">Rang actuel <b>${esc(cur)}</b>${pct != null && next ? ' · <b>' + pct + ' %</b> atteint' : ''}${solde ? ' · solde <b>' + esc(solde) + '</b>' : ''} · <b>${lp + rp}</b> points d'équipe</div></div>
    <div class="bar"><i style="width:${next ? (pct || 0) : 100}%"></i></div>
    <div class="rank-f"><span>Niveau résiduel Dual Team</span><span>${next ? (pct || 0) + ' % vers ' + esc(next) : ''}</span></div>
  </div>
  <div class="grid4">
    <div class="card kpi"><div class="lab">Membres dans l'équipe</div><div class="val">${members.length}</div><div class="sub ${n30 ? 'up' : ''}">+${n30} sur 30 jours</div></div>
    <div class="card kpi"><div class="lab">Nouveaux inscrits (7 j)</div><div class="val">${n7.length}</div><div class="sub">Semaine précédente : ${p7.length}</div></div>
    <div class="card kpi"><div class="lab">Comptes qualifiés</div><div class="val">${act.length}<small class="of"> / ${members.length}</small></div><div class="sub">${rate} % du réseau</div></div>
    <div class="card kpi"><div class="lab">Points de l'équipe</div><div class="val">${lp + rp}</div><div class="sub">${lp} à gauche · ${rp} à droite</div></div>
  </div>
  ${balanceCard(m, lp, rp, weak, gap, need)}
  <div class="grid2">
    <div class="card">
      <h3>Classement des lignes <small>30 derniers jours</small></h3>
      <table><thead><tr><th>#</th><th>Leader de ligne</th><th class="n">Inscrits</th><th class="n">Équipe</th><th class="n">Points</th><th>Tendance</th></tr></thead><tbody>
      ${leaders.map((x, i) => { const [t, c] = trend(x); return `<tr><td>${i + 1}</td><td><span style="display:flex;gap:8px;align-items:center"><span class="side ${x.leg}">${x.leg}</span>${esc(short(x.name))}</span></td><td class="n"><b>${x.n30}</b></td><td class="n">${x.size}</td><td class="n">${x.pts}</td><td class="trend ${c}">${t}</td></tr>`; }).join('') || '<tr><td colspan="6">Aucune ligne pour l\'instant.</td></tr>'}
      </tbody></table>
    </div>
    <div class="card todo">
      <h3>À faire aujourd'hui</h3>
      ${items.map(([t, a, b]) => `<div class="it"><span class="tag ${t}">${t}</span><div><b>${esc(fixDots(a))}</b><span>${esc(fixDots(b))}</span></div></div>`).join('')}
      <div style="margin-top:12px">${todos.map((t, i) => `<label class="check ${done[i] ? 'done' : ''}"><input type="checkbox" data-i="${i}" ${done[i] ? 'checked' : ''}><span>${esc(t)}</span></label>`).join('')}</div>
    </div>
  </div>
  <div class="grid2" style="margin-top:14px">
    <div class="card">
      <h3>Inscriptions par mois <small>par branche</small></h3>
      <div class="months">${mc.map(x => `<div class="mo"><span class="c">${x.l + x.r || ''}</span><div class="st">${x.l ? `<i style="height:${x.l / mmax * 100}%;background:var(--left)" title="Gauche : ${x.l}"></i>` : ''}${x.r ? `<i style="height:${x.r / mmax * 100}%;background:var(--right)" title="Droite : ${x.r}"></i>` : ''}</div><span class="m">${x.d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')}</span></div>`).join('')}</div>
      <div class="legend"><span><span class="dot" style="background:var(--left)"></span>Gauche</span><span><span class="dot" style="background:var(--right)"></span>Droite</span></div>
    </div>
    <div class="card">
      <h3>Santé de l'équipe</h3>
      <div class="stats">
        ${[['Actifs', act.length, 'var(--ok)', 'actif'], ['Suspendus', sus.length, 'var(--warn)', 'suspendu'], ['Annulés', ann.length, 'var(--bad)', 'annule']].map(([l, v, c, k]) => `<button class="srow" data-st="${k}" title="Afficher les comptes ${l.toLowerCase()}"><span class="lb">${l}</span><span class="tr"><i style="width:${members.length ? v / members.length * 100 : 0}%;background:${c}"></i></span><span class="v">${v}</span><span class="arr">→</span></button>`).join('')}
      </div>
      ${raw.residual ? `<div class="note" style="margin-top:16px">Résiduels Dual Team : niveau ${esc(cur)} · solde actuel ${esc(solde || '—')}${next ? ' · ' + (pct || 0) + ' % vers ' + esc(next) : ''}</div>` : ''}
      <div class="note" style="margin-top:6px">Rangs à vie : ${Object.entries(members.reduce((o, x) => { const r = x.g && x.g.LifeTimeRank || '—'; o[r] = (o[r] || 0) + 1; return o; }, {})).map(([k, v]) => esc(k) + ' ' + v).join(' · ')}</div>
    </div>
  </div>`;
  $('#dash').querySelectorAll('[data-branch]').forEach(el => el.addEventListener('click', e => {
    e.preventDefault();
    teamState.branch = el.dataset.branch; teamState.st = 'tous';
    showTab('team'); renderTeam(m);
  }));
  $('#dash').querySelectorAll('.srow[data-st]').forEach(el => el.addEventListener('click', () => {
    teamState.st = el.dataset.st; teamState.branch = 'tous'; teamState.q = '';
    showTab('team'); renderTeam(m);
  }));
  $('#dash').querySelectorAll('[data-orgfocus]').forEach(el => el.addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation();
    org.focus = el.dataset.orgfocus; org.open.clear(); org.fit = true; treeState.view = 'org';
    showTab('tree'); renderTree(m); requestAnimationFrame(() => { orgFit(); org.fit = false; });
  }));
  $('#dash').querySelectorAll('.check input').forEach(cb => cb.addEventListener('change', () => {
    done[cb.dataset.i] = cb.checked; cb.closest('.check').classList.toggle('done', cb.checked);
    try { localStorage.setItem(todoKey, JSON.stringify(done)); } catch (e) {}
  }));
}

/* ---- Outils communs ---- */
function showTab(id) {
  document.querySelectorAll('.tab').forEach(x => x.setAttribute('aria-selected', x.dataset.tab === id));
  ['dash', 'tree', 'team'].forEach(t => { $('#' + t).hidden = t !== id; });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function initials(name) {
  const p = titleCase(name).split(' ').filter(Boolean);
  return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}
const BR = { G: 'gauche', D: 'droite' };
// Rang à vie du membre (rien pour Lifestyle Ambassador). Pour vous (racine, absente de la grille) : niveau Dual Team.
function rankOf(n) {
  let r = n.g && (n.g.LifeTimeRank || n.g.Position);
  if (!r && model && n === model.root) { const lv = +((model.raw.residual || {}).CurrentLevel) || 0; r = lv ? RANKS[lv - 1] : null; }
  if (!r || /lifestyle/i.test(r)) return null;
  return r;
}
function rankBadge(n) {
  const r = rankOf(n); if (!r) return '';
  const k = norm(r).toLowerCase();
  return `<span class="rk rk-${k}" title="Rang à vie : ${esc(r)}">${esc(r)}</span>`;
}
const cq = (n, q, bold) => plural(n, 'compte', 'comptes') + ' · ' + (bold ? '<b>' + q + '</b>' : q) + ' ' + (q > 1 ? 'qualifiés' : 'qualifié');
function contactHTML(n) {
  const g = n.g; if (!g) return '';
  const tel = (g.CellPhone || '').trim(), mail = (g.Email || '').trim();
  if (!('CellPhone' in g) && !('Email' in g)) return '<span class="contact muted">Coordonnées : cliquez sur « Actualiser » pour les charger</span>';
  if (!tel && !mail) return '<span class="contact muted">Aucune coordonnée renseignée</span>';
  const telHref = tel.replace(/[^\d+]/g, '');
  return `<span class="contact">${tel ? `<a href="tel:${esc(telHref)}">☎ ${esc(tel)}</a><button class="chip sm" data-copytxt="${esc(tel)}">⧉</button>` : ''}${mail ? `<a href="mailto:${esc(mail)}">✉ ${esc(mail)}</a><button class="chip sm" data-copytxt="${esc(mail)}">⧉</button>` : ''}</span>`;
}
const affLink = u => BASE + '/' + encodeURIComponent(u) + '/join';
async function copyAff(btn) {
  const url = btn.dataset.copytxt || affLink(btn.dataset.copy), label = btn.innerHTML;
  let ok = false;
  try { await navigator.clipboard.writeText(url); ok = true; } catch (e) {
    try { const ta = document.createElement('textarea'); ta.value = url; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove(); } catch (e2) {}
  }
  btn.innerHTML = ok ? '✓ Copié' : 'Échec';
  btn.classList.toggle('copied', ok);
  setTimeout(() => { btn.innerHTML = label; btn.classList.remove('copied'); }, 1800);
}

/* ---- Équilibre des branches (tableau de bord) ---- */
function balanceCard(m, lp, rp, weak, gap, need) {
  const t = lp + rp || 1, pl = Math.round(lp / t * 100), pr = 100 - pl;
  const side = (n, s, pts, p) => {
    if (!n) return `<div class="brc empty">Aucun compte côté ${BR[s]}</div>`;
    const q = n.accounts ? Math.round(n.qualAll / n.accounts * 100) : 0;
    return `<a href="#" class="brc" data-branch="${s}" title="Afficher uniquement les membres de la branche ${BR[s]}">
      <span class="av ${s}">${esc(initials(n.name))}</span>
      <span class="brc-t"><b>${esc(titleCase(n.name))}</b><span>${plural(n.accounts, 'compte', 'comptes')} · <b>${n.qualAll}</b> ${n.qualAll > 1 ? 'qualifiés' : 'qualifié'}</span>
        <span class="qbar"><i style="width:${q}%"></i></span></span>
      <span class="brc-a"><span class="lnk" data-orgfocus="${esc(n.id)}" title="Voir cette branche dans l'arbre">Arbre</span><span class="arr">→</span></span>
    </a>`;
  };
  return `<div class="card bal-card">
    <h3>L'équilibre de ton réseau <small class="tagline">DUAL TEAM</small></h3>
    <div class="note" style="margin:-6px 0 16px">Points cumulés par branche · clique une branche pour n'afficher que ses membres</div>
    <div class="bal-top">
      <div><div class="bl"><span class="dot" style="background:var(--left)"></span>Branche gauche</div><div class="big">${lp}<small> points</small></div></div>
      <div class="bal-mid">${gap ? 'Branche faible : <b>' + weak + '</b><br>−' + gap + ' pts · ≈ ' + plural(need, 'inscrit', 'inscrits') : 'Branches équilibrées'}</div>
      <div style="text-align:right"><div class="bl"><span class="dot" style="background:var(--right)"></span>Branche droite</div><div class="big">${rp}<small> points</small></div></div>
    </div>
    <div class="legs big"><i class="l" style="width:${pl}%"></i><i class="r" style="width:${pr}%"></i></div>
    <div class="rank-f" style="margin-top:6px"><span>${pl} % du volume</span><span>${pr} % du volume</span></div>
    <div class="grid2 brs">${side(m.root.L, 'G', lp)}${side(m.root.R, 'D', rp)}</div>
  </div>`;
}

/* ---- Arbre : organigramme dynamique (par défaut) ou liste ---- */
const treeState = { view: 'org', collapsed: new Set(), filter: 'tous', q: '' };
const org = { focus: null, depth: 3, open: new Map(), s: 1, x: 0, y: 0, hl: null, fit: true, hits: [], hitI: 0, q: '', qv: '' };

function renderTree(m) {
  if (treeState.view === 'liste') return renderTreeList(m);
  return renderOrg(m);
}
const viewToggle = () => `<span class="seg"><button class="chip" data-view="org" aria-pressed="${treeState.view === 'org'}">Organigramme</button><button class="chip" data-view="liste" aria-pressed="${treeState.view === 'liste'}">Liste</button></span>`;
function wireViewToggle(m) {
  $('#tree').querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => { treeState.view = b.dataset.view; org.fit = true; renderTree(m); }));
}

function orgIsOpen(n, rel) { return org.open.has(n.id) ? org.open.get(n.id) : rel < org.depth; }
function orgCard(m, n, rel) {
  const open = n.children.length && orgIsOpen(n, rel);
  const lp = n.L ? n.L.pts : 0, rp = n.R ? n.R.pts : 0, t = lp + rp;
  const lvl = n === m.root ? 'Racine' : 'Niveau ' + n.depth;
  return `<div class="nd st-${n.status}${org.hl === n.id ? ' hl' : ''}${n.age <= 30 && n.depth ? ' new' : ''}" data-id="${esc(n.id)}" title="Cliquer pour explorer cette fiche">
    <div class="nd-h"><span class="av ${n.leg || 'R'}">${esc(initials(n.name))}</span>
      <span class="nd-n"><b>${esc(titleCase(n.name))}</b><small>${esc(n.user || '')}</small></span>
      <i class="sd ${n.status}" title="${STATUS[n.status]}"></i></div>
    <div class="nd-f"><span>${rankBadge(n)}${lvl}${n.status !== 'actif' ? ' · <em class="' + n.status + '">' + STATUS[n.status] + '</em>' : n.age <= 30 && n.depth ? ' · <em class="nw">Nouveau</em>' : ''}</span><b>${n.pts}<small> pts</small></b></div>
    ${n.size ? `<div class="nd-q"><span>${cq(n.size, n.qual)}</span><span class="bal" title="Gauche ${lp} · Droite ${rp}">${t ? `<i class="l" style="width:${lp / t * 100}%"></i><i class="r" style="width:${rp / t * 100}%"></i>` : ''}</span></div>` : ''}
    ${!n.children.length && n.user && n.status !== 'annule' ? `<div class="nd-links" title="${esc(affLink(n.user))}">
      <a class="nd-open" draggable="false" href="${esc(affLink(n.user))}" target="_blank" rel="noopener noreferrer">↗ Ouvrir</a>
      <button class="nd-copy" data-copy="${esc(n.user)}">⧉ Copier</button></div>` : ''}
    ${n.children.length ? `<button class="nd-t" data-t="${esc(n.id)}" aria-label="${open ? 'Replier' : 'Déplier'}">${open ? '−' : '+'}</button>` : ''}
  </div>`;
}
function orgSub(m, n, rel) {
  let h = orgCard(m, n, rel);
  if (n.children.length && orgIsOpen(n, rel)) {
    h += '<ul>' + [['G', n.L], ['D', n.R]].map(([s, c]) =>
      `<li class="s${s}"><span class="lk">${s}</span>${c ? orgSub(m, c, rel + 1) : '<div class="nd empty">Place libre</div>'}</li>`).join('') + '</ul>';
  }
  return h;
}
function orgApply() {
  const c = $('#ocCanvas'); if (!c) return;
  c.style.transform = `translate(${org.x}px,${org.y}px) scale(${org.s})`;
  const z = $('#ocZoom'); if (z) z.textContent = Math.round(org.s * 100) + ' %';
}
function orgElPos(id) {                          // position de la fiche dans le repère de la vue
  const el = $('#ocCanvas') && $('#ocCanvas').querySelector(`.nd[data-id="${CSS.escape(id)}"]`);
  const v = $('#ocView'); if (!el || !v) return null;
  const r = el.getBoundingClientRect(), vr = v.getBoundingClientRect();
  return { x: r.left - vr.left, y: r.top - vr.top, w: r.width, h: r.height };
}
function orgFit() {
  const v = $('#ocView'), c = $('#ocCanvas'); if (!v || !c) return;
  const cw = c.scrollWidth, ch = c.scrollHeight, vw = v.clientWidth, vh = v.clientHeight;
  org.s = Math.max(0.3, Math.min(1, (vw - 40) / cw, (vh - 40) / ch));
  org.x = (vw - cw * org.s) / 2; org.y = Math.max(20, (vh - ch * org.s) / 2);
  orgApply();
}
function orgCenterOn(id, minScale) {
  if (minScale && org.s < minScale) { org.s = minScale; orgApply(); }
  const p = orgElPos(id), v = $('#ocView'); if (!p || !v) return;
  org.x += v.clientWidth / 2 - (p.x + p.w / 2); org.y += v.clientHeight / 3 - (p.y + p.h / 2);
  orgApply();
}
function orgZoom(f, cx, cy) {
  const v = $('#ocView'); if (!v) return;
  if (cx == null) { cx = v.clientWidth / 2; cy = v.clientHeight / 2; }
  const ns = Math.max(0.25, Math.min(1.8, org.s * f));
  org.x = cx - (cx - org.x) * ns / org.s; org.y = cy - (cy - org.y) * ns / org.s; org.s = ns;
  orgApply();
}
function orgSearch(m, q, next) {
  q = norm(q);
  if (!q) { org.hits = []; org.hl = null; renderOrg(m); return; }
  if (q !== org.q || !org.hits.length) {
    org.q = q; org.hitI = 0;
    org.hits = m.nodes.filter(n => norm(n.name).includes(q) || norm(n.user).includes(q)).map(n => n.id);
  } else if (next) org.hitI = (org.hitI + 1) % org.hits.length;
  const id = org.hits[org.hitI];
  if (!id) { org.hl = null; renderOrg(m); $('#ocCount').textContent = 'Aucun résultat'; return; }
  const n = m.byId.get(id);
  // le résultat doit être visible : on remonte au besoin le point de vue, puis on ouvre le chemin
  let inFocus = false; for (let a = n; a; a = a.parent) if (a.id === org.focus) inFocus = true;
  if (!inFocus) org.focus = m.root.id;
  for (let a = n.parent; a && a.id !== org.focus; a = a.parent) org.open.set(a.id, true);
  if (n.id !== org.focus) org.open.set(org.focus, true);
  org.hl = id;
  renderOrg(m, { keep: true });
  orgCenterOn(id, 0.8);
}

function renderOrg(m, opt) {
  opt = opt || {};
  if (!org.focus || !m.byId.has(org.focus)) org.focus = m.root.id;
  const f = m.byId.get(org.focus);
  const path = []; for (let a = f; a; a = a.parent) path.unshift(a);
  const lp = f.L ? f.L.pts : 0, rp = f.R ? f.R.pts : 0;
  const g = f.g;
  const details = f === m.root ? `<span>${cq(f.size, f.qual, true)}</span><span>Branche G <b>${lp}</b> · D <b>${rp}</b> pts</span>`
    : `<span class="pill ${f.status}">${STATUS[f.status]}</span><span>Inscrit le ${fmtD(f.join)}</span>${g && g.Country && g.Country !== 'Available' ? '<span>' + esc(g.Country) + '</span>' : ''}${g && g.Sponsor && g.Sponsor !== 'Disponible' ? '<span>Parrain : ' + esc(short(g.Sponsor)) + '</span>' : ''}<span>Branche <b>${BR[f.leg] || ''}</b></span><span>${f.size ? cq(f.size, f.qual, true) : 'Aucun compte en dessous'}</span><span>G <b>${lp}</b> · D <b>${rp}</b> pts</span>${contactHTML(f)}`;
  $('#tree').innerHTML = `<div class="card oc-card">
    <div class="filters">
      ${viewToggle()}
      <span class="srch"><input class="search" id="ocQ" placeholder="Trouver un compte dans l'arbre…" value="${esc(org.qv)}"><button class="chip" id="ocGo" aria-label="Chercher">→</button><span class="note" id="ocCount">${org.hits.length > 1 ? (org.hitI + 1) + ' / ' + org.hits.length : ''}</span></span>
      <span class="sp"></span>
      <label class="note">Profondeur <select id="ocDepth" class="search sel">${[[2, '2 niveaux'], [3, '3 niveaux'], [4, '4 niveaux'], [5, '5 niveaux'], [99, 'Tout']].map(([v, l]) => `<option value="${v}" ${org.depth === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <span class="seg"><button class="chip" id="ocMinus" aria-label="Dézoomer">−</button><button class="chip" id="ocFit">Ajuster</button><button class="chip" id="ocPlus" aria-label="Zoomer">+</button></span>
    </div>
    <div class="oc-bar">
      <div class="oc-top">
        <div class="crumbs">${path.map((a, i) => `${i ? '<span class="sepc">›</span>' : ''}<a href="#" data-crumb="${esc(a.id)}" class="${a === f ? 'cur' : ''}">${a === m.root ? 'Mon réseau' : esc(short(a.name))}</a>`).join('')}</div>
        <div class="oc-act">
          ${f.user && f.status !== 'annule' ? `<span class="aff-l">Lien d'affiliation</span><a class="chip sm" href="${esc(affLink(f.user))}" target="_blank" rel="noopener noreferrer" title="${esc(affLink(f.user))}">↗ Ouvrir</a><button class="chip sm" data-copy="${esc(f.user)}" title="${esc(affLink(f.user))}">⧉ Copier</button>` : ''}
          <button class="chip sm" id="ocUp" ${f === m.root ? 'disabled title="Vous êtes déjà en haut de l\'arbre"' : ''}>↑ Remonter</button>
        </div>
      </div>
      <div class="oc-det">${details}</div>
    </div>
    <div class="oc-view" id="ocView">
      <div class="oc-canvas" id="ocCanvas"><ul class="oc-root"><li>${orgSub(m, f, 0)}</li></ul></div>
      <span class="oc-zoom" id="ocZoom"></span>
    </div>
    <div class="note oc-help">Glisser pour se déplacer · molette pour défiler, Ctrl/⌘ + molette pour zoomer · cliquer une fiche pour l'explorer · <b>+</b> / <b>−</b> pour déplier ou replier.</div>
  </div>`;
  wireViewToggle(m);
  const v = $('#ocView');

  // Transformation : on ajuste à l'ouverture, sinon on garde la fiche cliquée à la même place
  if (org.fit && !opt.keep) { orgApply(); if (v.clientWidth) { org.fit = false; requestAnimationFrame(orgFit); } }
  else if (opt.anchor) { orgApply(); const p = orgElPos(opt.anchor.id); if (p) { org.x += opt.anchor.x - p.x; org.y += opt.anchor.y - p.y; } orgApply(); }
  else orgApply();

  // Glisser-déplacer + clics
  let down = null, dragged = false;
  v.addEventListener('pointerdown', e => { if (e.button !== 0) return; down = { x: e.clientX, y: e.clientY, ox: org.x, oy: org.y, id: e.pointerId }; dragged = false; });
  v.addEventListener('pointermove', e => {
    if (!down) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (!dragged && Math.hypot(dx, dy) > 4) { dragged = true; v.classList.add('drag'); try { v.setPointerCapture(down.id); } catch (er) {} }
    if (dragged) { org.x = down.ox + dx; org.y = down.oy + dy; orgApply(); }
  });
  const up = () => { down = null; v.classList.remove('drag'); };
  v.addEventListener('pointerup', up); v.addEventListener('pointercancel', up);
  v.addEventListener('click', e => {
    if (dragged) { dragged = false; return; }
    if (e.target.closest('.nd-open')) return;                 // lien : ouverture normale dans un nouvel onglet
    const cp = e.target.closest('.nd-copy');
    if (cp) { copyAff(cp); return; }
    const tg = e.target.closest('.nd-t');
    if (tg) {
      const n = m.byId.get(tg.dataset.t), rel = n.depth - f.depth;
      const before = orgElPos(n.id);
      org.open.set(n.id, !orgIsOpen(n, rel));
      renderOrg(m, { anchor: before ? { id: n.id, x: before.x, y: before.y } : null });
      return;
    }
    const card = e.target.closest('.nd[data-id]');
    if (card && card.dataset.id !== org.focus) {
      org.focus = card.dataset.id; org.hl = null; org.fit = true; renderOrg(m);
    }
  });
  v.addEventListener('wheel', e => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) { const r = v.getBoundingClientRect(); orgZoom(Math.exp(-e.deltaY * 0.0025), e.clientX - r.left, e.clientY - r.top); }
    else { org.x -= e.deltaX; org.y -= e.deltaY; orgApply(); }
  }, { passive: false });

  $('#tree').querySelectorAll('[data-crumb]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); org.focus = a.dataset.crumb; org.hl = null; org.fit = true; renderOrg(m); }));
  const upB = $('#ocUp'); if (upB && f.parent) upB.addEventListener('click', () => { org.focus = f.parent.id; org.fit = true; renderOrg(m); });
  $('#tree').querySelectorAll('.oc-act [data-copy], .oc-det [data-copytxt]').forEach(b => b.addEventListener('click', () => copyAff(b)));
  $('#ocDepth').addEventListener('change', e => { org.depth = +e.target.value; org.open.clear(); org.fit = true; renderOrg(m); });
  $('#ocMinus').addEventListener('click', () => orgZoom(1 / 1.2));
  $('#ocPlus').addEventListener('click', () => orgZoom(1.2));
  $('#ocFit').addEventListener('click', orgFit);
  const q = $('#ocQ');
  const go = nx => { org.qv = q.value; orgSearch(m, org.qv, nx); };
  q.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(true); } });
  $('#ocGo').addEventListener('click', () => go(true));
}

/* ---- Arbre : vue liste (ancienne vue) ---- */
function renderTreeList(m) {
  const f = treeState.filter, q = norm(treeState.q);
  const match = n => (f === 'tous' || (f === 'nouveaux' ? n.age <= 30 : n.status === f)) && (!q || norm(n.name).includes(q));
  const anyFilter = f !== 'tous' || q;
  const rows = [];
  (function walk(n) { rows.push(n); if (!treeState.collapsed.has(n.id)) n.children.forEach(walk); })(m.root);
  const counts = { tous: m.members.length, nouveaux: m.members.filter(x => x.age <= 30).length, suspendu: m.members.filter(x => x.status === 'suspendu').length, annule: m.members.filter(x => x.status === 'annule').length };
  const chips = [['tous', 'Tous'], ['nouveaux', 'Nouveaux (30 j)'], ['suspendu', 'Suspendus'], ['annule', 'Annulés']];
  $('#tree').innerHTML = `<div class="card">
    <div class="filters">${viewToggle()}${chips.map(([k, l]) => `<button class="chip" data-f="${k}" aria-pressed="${f === k}">${l} · ${counts[k]}</button>`).join('')}
      <span class="sp"></span><input class="search" id="tq" placeholder="Rechercher un membre…" value="${esc(treeState.q)}">
      <button class="chip" id="expAll">Tout déplier</button><button class="chip" id="colAll">Replier</button></div>
    <div class="thead"><span style="flex:1">Membre</span><span class="hm" style="width:150px">Inscription</span><span class="tnum">Équipe</span><span class="tnum">Qualifiés</span><span class="tnum">Points</span><span class="hm" style="width:80px">G / D</span></div>
    ${rows.map(n => {
      const lp = n.L ? n.L.pts : 0, rp = n.R ? n.R.pts : 0, t = lp + rp;
      const hit = anyFilter && match(n) && n !== m.root, dim = anyFilter && !match(n) && n !== m.root;
      return `<div class="trow ${hit ? 'hit' : ''} ${dim ? 'dim' : ''}" title="${esc(titleCase(n.name))}${n.g ? ' · ' + esc(n.g.Country) : ''}">
        <span class="indent" style="--d:${n.depth}"></span>
        <button class="tg" data-id="${esc(n.id)}" aria-label="Déplier ou replier">${n.children.length ? (treeState.collapsed.has(n.id) ? '▸' : '▾') : ''}</button>
        ${n.depth === 0 ? '<span class="side" style="background:var(--ink);color:var(--bg)">★</span>' : `<span class="side ${n.side}">${n.side}</span>`}
        <span class="tn">${esc(n.depth === 0 ? titleCase(n.name) + ' (vous)' : short(n.name))}</span>${rankBadge(n)}
        ${n.status !== 'actif' ? `<span class="pill ${n.status}">${STATUS[n.status]}</span>` : ''}
        ${n.age <= 30 && n.depth ? '<span class="pill" style="background:var(--accent-soft);color:var(--accent)">Nouveau</span>' : ''}
        <span class="sp"></span>
        <span class="tm" style="width:150px">${fmtD(n.join)}</span>
        <span class="tnum">${n.size ? '<b>' + n.size + '</b>' : '—'}</span>
        <span class="tnum">${n.size ? n.qual : '—'}</span>
        <span class="tnum"><b>${n.pts}</b></span>
        <span class="bal" title="Gauche ${lp} · Droite ${rp}">${t ? `<i class="l" style="width:${lp / t * 100}%"></i><i class="r" style="width:${rp / t * 100}%"></i>` : ''}</span>
      </div>`; }).join('')}
    <div class="note" style="margin-top:12px">Points = volume cumulé du membre et de son équipe. La barre G / D compare ses deux branches.</div>
  </div>`;
  wireViewToggle(m);
  const t = $('#tree');
  t.querySelectorAll('.tg').forEach(b => b.addEventListener('click', () => { const id = b.dataset.id; treeState.collapsed.has(id) ? treeState.collapsed.delete(id) : treeState.collapsed.add(id); renderTreeList(m); }));
  t.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => { treeState.filter = b.dataset.f; renderTreeList(m); }));
  $('#expAll').addEventListener('click', () => { treeState.collapsed.clear(); renderTreeList(m); });
  $('#colAll').addEventListener('click', () => { m.nodes.forEach(n => { if (n.depth >= 1 && n.children.length) treeState.collapsed.add(n.id); }); renderTreeList(m); });
  const inp = $('#tq');
  inp.addEventListener('input', () => { treeState.q = inp.value; renderTreeList(m); const i = $('#tq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); });
}

/* ---- Équipe : filtres par branche et par statut ---- */
const teamState = { sort: 'join', dir: -1, q: '', branch: 'tous', st: 'tous' };
function renderTeam(m) {
  const rows = m.members.map(n => ({ n, name: titleCase(n.name), join: n.join, leg: n.leg, level: n.depth, status: n.status,
    rank: n.g ? n.g.LifeTimeRank : '—', l: n.g ? +n.g.LeftTeamPoints : (n.L ? n.L.pts : 0), r: n.g ? +n.g.RightTeamPoints : (n.R ? n.R.pts : 0),
    size: n.size, qual: n.qual, country: n.g ? (n.g.Country === 'Available' ? '—' : n.g.Country) : '—', sponsor: n.g ? (n.g.Sponsor === 'Disponible' ? '—' : short(n.g.Sponsor)) : '—' }));
  const inBranch = rows.filter(r => teamState.branch === 'tous' || r.leg === teamState.branch);
  const q = norm(teamState.q);
  const vis = inBranch.filter(r => (teamState.st === 'tous' || r.status === teamState.st) && (!q || norm(r.name + r.country + r.sponsor).includes(q)));
  const k = teamState.sort, d = teamState.dir;
  vis.sort((a, b) => { const x = a[k], y = b[k]; return (x > y ? 1 : x < y ? -1 : 0) * d; });
  const cnt = st => inBranch.filter(r => r.status === st).length;
  const qOk = cnt('actif');
  const bChips = [['tous', 'Tout le réseau'], ['G', 'Branche gauche'], ['D', 'Branche droite']];
  const sChips = [['tous', 'Tous', inBranch.length], ['actif', 'Qualifiés', qOk], ['suspendu', 'Suspendus', cnt('suspendu')], ['annule', 'Annulés', cnt('annule')]];
  const head = teamState.branch === 'tous' ? m.root : (teamState.branch === 'G' ? m.root.L : m.root.R);
  const cols = [['name', 'Membre'], ['join', 'Inscription'], ['leg', 'Branche'], ['level', 'Niveau', 'n'], ['status', 'Statut'], ['rank', 'Rang à vie'], ['size', 'Équipe', 'n'], ['qual', 'Qualifiés', 'n'], ['l', 'Pts G', 'n'], ['r', 'Pts D', 'n'], ['country', 'Pays'], ['sponsor', 'Parrain']];
  $('#team').innerHTML = `<div class="card">
    <div class="team-sum">
      <div><div class="lab">${teamState.branch === 'tous' ? 'Tout le réseau' : 'Branche ' + BR[teamState.branch] + (head ? ' · ' + esc(titleCase(head.name)) : '')}</div>
        <div class="big">${qOk}<small> qualifiés sur ${inBranch.length} comptes</small></div></div>
      <div class="qbar wide"><i style="width:${inBranch.length ? qOk / inBranch.length * 100 : 0}%"></i></div>
    </div>
    <div class="filters"><span class="seg">${bChips.map(([v, l]) => `<button class="chip" data-tb="${v}" aria-pressed="${teamState.branch === v}">${l}</button>`).join('')}</span>
      <span class="seg">${sChips.map(([v, l, c]) => `<button class="chip" data-ts="${v}" aria-pressed="${teamState.st === v}">${l} · ${c}</button>`).join('')}</span>
      <span class="sp"></span><input class="search" id="mq" placeholder="Nom, pays, parrain…" value="${esc(teamState.q)}"></div>
    <div class="tscroll"><table><thead><tr>${cols.map(([c, l, cl]) => `<th class="sort ${cl || ''}" data-k="${c}">${l}${k === c ? (d > 0 ? ' ↑' : ' ↓') : ''}</th>`).join('')}</tr></thead><tbody>
    ${vis.map(r => `<tr class="rowlink" data-open="${esc(r.n.id)}" title="Ouvrir la fiche"><td><b>${esc(r.name)}</b></td><td>${fmtD(r.join)}</td><td><span class="side ${r.leg}">${r.leg}</span></td><td class="n">${r.level}</td><td><span class="pill ${r.status}">${STATUS[r.status]}</span></td><td>${esc(r.rank)}</td><td class="n">${r.size}</td><td class="n">${r.size ? r.qual : '—'}</td><td class="n">${r.l}</td><td class="n">${r.r}</td><td>${esc(r.country)}</td><td>${esc(r.sponsor)}</td></tr>`).join('') || `<tr><td colspan="${cols.length}" class="note">Aucun membre ne correspond.</td></tr>`}
    </tbody></table></div><div class="note" style="margin-top:10px">${vis.length} membres affichés</div></div>`;
  const T = $('#team');
  T.querySelectorAll('th.sort').forEach(th => th.addEventListener('click', () => { const c = th.dataset.k; teamState.dir = teamState.sort === c ? -teamState.dir : 1; teamState.sort = c; renderTeam(m); }));
  T.querySelectorAll('tr[data-open]').forEach(tr => tr.addEventListener('click', () => {
    const n = m.byId.get(tr.dataset.open); if (!n) return;
    org.focus = n.id; org.hl = null; org.fit = true; treeState.view = 'org';
    showTab('tree'); renderTree(m); requestAnimationFrame(() => { orgFit(); org.fit = false; });
  }));
  T.querySelectorAll('[data-tb]').forEach(b => b.addEventListener('click', () => { teamState.branch = b.dataset.tb; renderTeam(m); }));
  T.querySelectorAll('[data-ts]').forEach(b => b.addEventListener('click', () => { teamState.st = b.dataset.ts; renderTeam(m); }));
  const inp = $('#mq');
  inp.addEventListener('input', () => { teamState.q = inp.value; renderTeam(m); const i = $('#mq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); });
}

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
