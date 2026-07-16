import React, { useEffect, useState, useCallback } from 'react';
import { api, getToken, clearToken } from './api.js';
import Background from './components/Background.jsx';
import AuthScreen from './components/AuthScreen.jsx';
import TripList from './components/TripList.jsx';
import TripView from './components/TripView.jsx';
import AdminPanel from './components/AdminPanel.jsx';
import MapsKeyModal from './components/MapsKeyModal.jsx';
import HamburgerMenu from './components/HamburgerMenu.jsx';
import { getMapsKey } from './maps.js';

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [activeTripId, setActiveTripId] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [mapsReady, setMapsReady] = useState(!!getMapsKey());

  useEffect(() => {
    if (!getToken()) { setChecking(false); return; }
    api.me()
      .then((d) => setUser(d.user))
      .catch(() => clearToken())
      .finally(() => setChecking(false));
  }, []);

  const handleLogout = useCallback(() => {
    clearToken();
    setUser(null);
    setActiveTripId(null);
  }, []);

  const handleKeySaved = useCallback(() => {
    setMapsReady(!!getMapsKey());
    setShowKeyModal(false);
  }, []);

  if (checking) {
    return (
      <>
        <Background />
        <div className="center-screen"><div className="spinner" /></div>
      </>
    );
  }

  return (
    <>
      <Background />
      {!user ? (
        <AuthScreen onLogin={setUser} />
      ) : (
        <div className="app-shell">
          <header className="topbar glass">
            <button className="brand" onClick={() => { setActiveTripId(null); setShowAdmin(false); }} title="Ir a mis viajes">
              <span className="brand-emoji">🧭</span>
              <span className="brand-name">Ohtli</span>
            </button>
            <div className="topbar-right">
              {!mapsReady && (
                <button className="btn btn-warn btn-sm" onClick={() => setShowKeyModal(true)}>
                  🔑 Configurar Google Maps
                </button>
              )}
              <button className="hamburger-btn" onClick={() => setShowMenu(true)} title="Menú" aria-label="Abrir menú">
                ☰
                {!mapsReady && <span className="ping-dot" />}
              </button>
            </div>
          </header>

          <main className="app-main">
            {showAdmin ? (
              <AdminPanel currentUser={user} onBack={() => setShowAdmin(false)} />
            ) : activeTripId ? (
              <TripView
                tripId={activeTripId}
                user={user}
                mapsReady={mapsReady}
                onBack={() => setActiveTripId(null)}
                onNeedKey={() => setShowKeyModal(true)}
              />
            ) : (
              <TripList user={user} onOpenTrip={setActiveTripId} />
            )}
          </main>
        </div>
      )}

      {showKeyModal && (
        <MapsKeyModal onClose={() => setShowKeyModal(false)} onSaved={handleKeySaved} />
      )}

      {user && showMenu && (
        <HamburgerMenu
          user={user}
          view={showAdmin ? 'admin' : 'trips'}
          mapsReady={mapsReady}
          onGoTrips={() => { setShowAdmin(false); setActiveTripId(null); }}
          onOpenAdmin={() => { setShowAdmin(true); setActiveTripId(null); }}
          onOpenSettings={() => setShowKeyModal(true)}
          onLogout={handleLogout}
          onClose={() => setShowMenu(false)}
        />
      )}
    </>
  );
}
