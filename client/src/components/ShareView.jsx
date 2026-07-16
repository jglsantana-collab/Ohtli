import React, { useState } from 'react';
import { api } from '../api.js';

// Compartir el viaje con otras personas registradas (por correo).
export default function ShareView({ trip, user, onChanged }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  const isOwner = trip.owner_id === user.id;

  async function invite(e) {
    e.preventDefault();
    setError(''); setOk('');
    setBusy(true);
    try {
      await api.addMember(trip.id, email);
      setOk(`Listo: ${email} ya puede ver y editar este viaje.`);
      setEmail('');
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(member) {
    const msg = member.id === user.id
      ? '¿Salir de este viaje? Dejarás de verlo en tu lista.'
      : `¿Quitar a ${member.name} del viaje?`;
    if (!confirm(msg)) return;
    try {
      await api.removeMember(trip.id, member.id);
      onChanged();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="share-wrap">
      <div className="card glass">
        <h3>👥 Personas en este viaje</h3>
        <p className="muted">
          Todos los miembros pueden ver el plan, agregar lugares y asignar fechas.
          Para invitar a alguien, esa persona ya debe tener su cuenta en Ohtli.
        </p>

        <form className="search-bar" onSubmit={invite}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="correo@de-tu-acompañante.com"
            required
          />
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Invitando…' : '＋ Invitar'}
          </button>
        </form>

        {error && <div className="form-error">⚠️ {error}</div>}
        {ok && <div className="form-ok">✅ {ok}</div>}

        <ul className="member-list">
          {trip.members.map((m) => (
            <li key={m.id} className="member-row">
              <span className="member-avatar">{m.name.slice(0, 1).toUpperCase()}</span>
              <div className="member-info">
                <div className="member-name">
                  {m.name} {m.id === user.id && <span className="muted">(tú)</span>}
                  {m.is_owner && <span className="badge">Dueño</span>}
                </div>
                <div className="member-email muted">{m.email}</div>
              </div>
              {!m.is_owner && (m.id === user.id || isOwner) && (
                <button className="btn btn-ghost btn-sm" onClick={() => remove(m)}>
                  {m.id === user.id ? 'Salir' : 'Quitar'}
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
