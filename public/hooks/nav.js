export function getGoogleUser() {
  try { return JSON.parse(localStorage.getItem('google_user') || 'null'); }
  catch { return null; }
}

export function getUsername() {
  const user = getGoogleUser();
  return user?.nickname || user?.name || '';
}

export function isAdmin() {
  return getGoogleUser()?.isAdmin === true;
}

export function requireAuth() {
  const user = getGoogleUser();
  if (!user) {
    const page = location.pathname.split('/').pop() + location.search;
    location.href = `login.html?next=${encodeURIComponent(page)}`;
    return null;
  }
  return user;
}

export function logout() {
  localStorage.removeItem('google_user');
  localStorage.removeItem('username');
  location.href = 'login.html';
}

export async function changeNickname() {
  const user = getGoogleUser();
  if (!user) return;
  const cur = user.nickname || user.name || '';
  const next = prompt('새 닉네임을 입력하세요:', cur);
  if (!next?.trim() || next.trim() === cur) return;
  const nickname = next.trim();

  await fetch(`/api/users/${user.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname }),
  });

  localStorage.setItem('google_user', JSON.stringify({ ...user, nickname }));
  localStorage.setItem('username', nickname);
  location.reload();
}

export function initNav(currentPage) {
  const user = getGoogleUser();
  const displayName = user?.nickname || user?.name || '';

  const usernameEl = document.getElementById('nav-username');
  const avatarEl   = document.getElementById('nav-avatar');
  if (usernameEl) {
    usernameEl.textContent = displayName;
    usernameEl.style.cursor = 'pointer';
    usernameEl.title = '닉네임 변경';
    usernameEl.addEventListener('click', changeNickname);
  }
  if (avatarEl && user?.picture) {
    avatarEl.src = user.picture;
    avatarEl.style.display = '';
  }

  document.querySelectorAll('#nav a[href]').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === currentPage);
  });

  document.getElementById('btn-logout')?.addEventListener('click', logout);

  if (isAdmin()) {
    const spacer = document.querySelector('#nav .nav-spacer');
    if (spacer) {
      const badge = document.createElement('span');
      badge.className = 'admin-badge';
      badge.textContent = '관리자';
      spacer.after(badge);
    }
  }
}
