import React, { useState } from 'react';
import { api, setToken } from '../api.js';

export default function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = mode === 'login'
        ? await api.login({ email: form.email, password: form.password })
        : await api.register(form);
      setToken(data.token);
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="center-screen">
      <div className="auth-card glass">
        <div className="auth-logo">
          <span className="auth-emoji">🧭</span>
          <h1>Ohtli</h1>
          <p className="auth-tagline">Tu camino, tu viaje. Planifica y comparte.</p>
        </div>

        <div className="auth-tabs">
          <button
            className={mode === 'login' ? 'active' : ''}
            onClick={() => { setMode('login'); setError(''); }}
          >Iniciar sesión</button>
          <button
            className={mode === 'register' ? 'active' : ''}
            onClick={() => { setMode('register'); setError(''); }}
          >Crear cuenta</button>
        </div>

        <form onSubmit={submit} className="auth-form">
          {mode === 'register' && (
            <label>
              Nombre
              <input type="text" value={form.name} onChange={set('name')} placeholder="Tu nombre" required autoComplete="name" />
            </label>
          )}
          <label>
            Correo electrónico
            <input type="email" value={form.email} onChange={set('email')} placeholder="tucorreo@ejemplo.com" required autoComplete="email" />
          </label>
          <label>
            Contraseña
            <input type="password" value={form.password} onChange={set('password')} placeholder={mode === 'register' ? 'Mínimo 6 caracteres' : '••••••••'} required minLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          </label>

          {error && <div className="form-error">⚠️ {error}</div>}

          <button className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Un momento…' : mode === 'login' ? 'Entrar' : 'Crear mi cuenta'}
          </button>
        </form>
      </div>
    </div>
  );
}
