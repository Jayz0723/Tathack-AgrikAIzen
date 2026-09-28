/* ===================== APP BOOTSTRAP =====================
   Runs last (after every screen file has registered its markup +
   refresh function). Shows the splash, then either the logged-in
   user's home screen or the login form. */

window.onload = () => {
  setTimeout(() => {
    document.getElementById('splash').style.display = 'none';
    const u = currentUser();
    if(u){
      currentRole = u.role;
      document.getElementById('screen-auth').classList.remove('active');
      goHomeForRole();
    } else {
      document.getElementById('screen-auth').classList.add('active');
    }
  }, 900);
};
