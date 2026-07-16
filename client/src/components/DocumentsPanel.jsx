import React, { useState } from 'react';
import { api } from '../api.js';

const DOC_TYPES = [
  { id: 'pasaporte', label: 'Pasaporte / ID', emoji: '🛂' },
  { id: 'seguro', label: 'Seguro de viaje', emoji: '🛡️' },
  { id: 'reservacion', label: 'Reservación / voucher', emoji: '🎫' },
  { id: 'visa', label: 'Visa', emoji: '📄' },
  { id: 'otro', label: 'Otro', emoji: '📎' }
];

const docTypeById = (id) => DOC_TYPES.find((t) => t.id === id) || DOC_TYPES[DOC_TYPES.length - 1];

const emptyForm = { name: '', doc_type: 'otro', url: '', notes: '' };

function DocumentForm({ trip, doc, onDone, onCancel }) {
  const [form, setForm] = useState(doc ? {
    name: doc.name || '',
    doc_type: doc.doc_type || 'otro',
    url: doc.url || '',
    notes: doc.notes || ''
  } : emptyForm);
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (doc) await api.updateDocument(doc.id, form);
      else await api.addDocument(trip.id, form);
      onDone();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card glass document-form" onSubmit={submit}>
      <label>
        Nombre
        <input value={form.name} onChange={set('name')} placeholder="Ej. Pasaporte de José" required autoFocus />
      </label>
      <label>
        Tipo
        <select value={form.doc_type} onChange={set('doc_type')}>
          {DOC_TYPES.map((t) => <option key={t.id} value={t.id}>{t.emoji} {t.label}</option>)}
        </select>
      </label>
      <label>
        Link (opcional)
        <input
          type="url"
          value={form.url}
          onChange={set('url')}
          placeholder="Link a una foto/PDF (Drive, iCloud, Dropbox…)"
        />
      </label>
      <label>
        Notas
        <input value={form.notes} onChange={set('notes')} placeholder="Número de póliza, vigencia, etc." />
      </label>
      <div className="place-edit-actions">
        <button className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Guardando…' : 'Guardar documento'}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}

export default function DocumentsPanel({ trip, onChanged }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const documents = trip.documents || [];

  function done() {
    setShowForm(false);
    setEditing(null);
    onChanged();
  }

  async function remove(doc) {
    if (!confirm(`¿Quitar "${doc.name}"?`)) return;
    try {
      await api.deleteDocument(doc.id);
      onChanged();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>📁 Documentos</h2>
          <p className="muted">Pasaportes, seguros, reservaciones — todo a la mano para el viaje.</p>
        </div>
        {!showForm && !editing && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>＋ Agregar documento</button>
        )}
      </div>

      {showForm && <DocumentForm trip={trip} onDone={done} onCancel={() => setShowForm(false)} />}
      {editing && <DocumentForm trip={trip} doc={editing} onDone={done} onCancel={() => setEditing(null)} />}

      {documents.length === 0 && !showForm ? (
        <div className="empty-state glass">
          <span className="empty-emoji">📁</span>
          <h3>Aún no hay documentos</h3>
          <p>Guarda aquí el link a tu pasaporte, seguro de viaje o cualquier reservación importante.</p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>＋ Agregar el primero</button>
        </div>
      ) : (
        <div className="document-list">
          {documents.map((d) => {
            const type = docTypeById(d.doc_type);
            return (
              <div key={d.id} className="document-card glass">
                <span className="document-emoji" style={{ background: 'rgba(148,163,184,0.18)' }}>{type.emoji}</span>
                <div className="document-info" onClick={() => setEditing(editing?.id === d.id ? null : d)}>
                  <div className="document-name">{d.name} <span className="muted">— {type.label}</span></div>
                  <div className="place-tags">
                    {d.url && <a className="tag tag-date" href={d.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>🔗 Ver documento</a>}
                    {d.notes && <span className="tag">📝 {d.notes}</span>}
                    {d.added_by_name && <span className="tag tag-by">Agregó: {d.added_by_name}</span>}
                  </div>
                </div>
                <button className="btn-icon" title="Quitar documento" onClick={() => remove(d)}>🗑️</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
