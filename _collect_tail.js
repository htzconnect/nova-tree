
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
