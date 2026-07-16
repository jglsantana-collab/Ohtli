import React, { useEffect, useState } from 'react';
import { pushSupported, getPushSubscription, subscribeToPush, unsubscribeFromPush } from '../push.js';

export default function HamburgerMenu({
  user,
  view,
  mapsReady,
  onGoTrips,
  onOpenAdmin,
  onOpenSettings,
  onLogout,
  onClose
}) {
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState('');

  useEffect(() => {
    if (!pushSupported()) return;
    getPushSubscription().then((sub) => setPushOn(!!sub)).catch(() => {});
  }, []);

  function go(action) {
    action();
    onClose();
  }

  async function togglePush() {
    setPushBusy(true);
    setPushError('');
    try {
      if (pushOn) {
        await unsubscribeFromPush();
        setPushOn(false);
      } else {
        await subscribeToPush();
        setPushOn(true);
      }
    } catch (err) {
      setPushError(err.message);
    } finally {
      setPushBusy(false);
    }
  }

  return (
    <>
      <div className="menu-overlay" onClick={onClose} />
      <div className="menu-panel glass">
        <div className="menu-head">
          <span className="menu-head-brand">🧭 Ohtli</span>
          <button className="btn-icon" onClick={onClose} aria-label="Cerrar menú">✕</button>
        </div>

        <div className="menu-user">
          <div className="menu-avatar">{user.name.charAt(0).toUpperCase()}</div>
          <div className="menu-user-info">
            <p className="name">{user.name}</p>
            <p className="email">{user.email}</p>
            <span className="badge role-badge">{user.is_admin ? '👑 Admin' : 'Viajero'}</span>
          </div>
        </div>

        <nav className="menu-nav">
          <button
            className={`menu-nav-item ${view === 'trips' ? 'active' : ''}`}
            onClick={() => go(onGoTrips)}
          >
            🧭 <span>Mis viajes</span>
          </button>

          {user.is_admin && (
            <button
              className={`menu-nav-item ${view === 'admin' ? 'active' : ''}`}
              onClick={() => go(onOpenAdmin)}
            >
              👑 <span>Administración</span>
            </button>
          )}

          <button className="menu-nav-item" onClick={() => go(onOpenSettings)}>
            ⚙️ <span>Configuración</span>
            {!mapsReady && <span className="warn-dot" title="Falta configurar Google Maps" />}
          </button>

          {pushSupported() && (
            <button className="menu-nav-item" onClick={togglePush} disabled={pushBusy}>
              {pushOn ? '🔔' : '🔕'} <span>{pushBusy ? 'Un momento…' : pushOn ? 'Notificaciones activadas' : 'Activar notificaciones'}</span>
            </button>
          )}
          {pushError && <p className="menu-push-error">{pushError}</p>}
        </nav>

        <div className="menu-footer">
          <button className="menu-logout" onClick={() => setConfirmLogout(true)}>
            🚪 Cerrar sesión
          </button>
        </div>
      </div>

      {confirmLogout && (
        <div className="confirm-overlay" onClick={() => setConfirmLogout(false)}>
          <div className="glass confirm-card" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-icon">🚪</div>
            <h3>¿Cerrar sesión?</h3>
            <p>Tendrás que volver a iniciar sesión para acceder a Ohtli.</p>
            <div className="confirm-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmLogout(false)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => go(onLogout)}>Sí, cerrar sesión</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
