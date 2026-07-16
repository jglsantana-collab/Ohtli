import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

function fmtDate(d) {
  return new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

function PasswordRow({ userId, onClose, onSaved }) {
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.adminSetPassword(userId, password);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="admin-password-row" onSubmit={submit}>
      <div className="password-field">
        <input
          type={show ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Nueva contraseña (mín. 6 caracteres)"
          minLength={6}
          required
          autoFocus
        />
        <button type="button" className="password-toggle" onClick={() => setShow((v) => !v)} tabIndex={-1}>
          {show ? '🙈' : '👁️'}
        </button>
      </div>
      <button className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
      {error && <div className="form-error">⚠️ {error}</div>}
    </form>
  );
}

export default function AdminPanel({ currentUser, onBack }) {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  function load() {
    api.adminUsers().then((d) => setUsers(d.users)).catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function toggleAdmin(u) {
    setBusyId(u.id);
    setError('');
    try {
      const { user } = await api.adminSetRole(u.id, !u.is_admin);
      setUsers((list) => list.map((x) => (x.id === user.id ? { ...x, ...user } : x)));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function removeUser(u) {
    if (!confirm(`¿Eliminar la cuenta de ${u.name} (${u.email})? Se borrarán también los viajes que sea dueño. Esta acción no se puede deshacer.`)) return;
    setBusyId(u.id);
    setError('');
    try {
      await api.adminDeleteUser(u.id);
      setUsers((list) => list.filter((x) => x.id !== u.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>👑 Administración</h2>
          <p className="muted">Gestiona quién tiene acceso a Ohtli, sus contraseñas y permisos.</p>
        </div>
        <button className="btn btn-ghost" onClick={onBack}>← Volver a mis viajes</button>
      </div>

      {error && <div className="form-error">⚠️ {error}</div>}

      {users === null ? (
        <div className="center-block"><div className="spinner" /></div>
      ) : (
        <div className="card glass admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Viajes</th>
                <th>Creado</th>
                <th>Rol</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <React.Fragment key={u.id}>
                  <tr>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>{u.trips_owned}</td>
                    <td>{fmtDate(u.created_at)}</td>
                    <td>{u.is_admin ? <span className="badge">👑 Admin</span> : <span className="muted">Miembro</span>}</td>
                    <td className="admin-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(editingId === u.id ? null : u.id)}>
                        🔑 Contraseña
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={busyId === u.id || (u.id === currentUser.id && u.is_admin)}
                        title={u.id === currentUser.id && u.is_admin ? 'No puedes quitarte el rol de administrador' : ''}
                        onClick={() => toggleAdmin(u)}
                      >
                        {u.is_admin ? 'Quitar admin' : 'Hacer admin'}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={busyId === u.id || u.id === currentUser.id}
                        onClick={() => removeUser(u)}
                      >🗑️</button>
                    </td>
                  </tr>
                  {editingId === u.id && (
                    <tr>
                      <td colSpan={6}>
                        <PasswordRow
                          userId={u.id}
                          onClose={() => setEditingId(null)}
                          onSaved={() => { setEditingId(null); }}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
