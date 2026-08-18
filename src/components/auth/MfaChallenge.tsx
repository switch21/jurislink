// ============================================================================
// JurisLink - Phase 1.2 - Patch MfaChallenge.tsx (callback onSuccess explicite)
// ============================================================================
// Remplace: src/components/auth/MfaChallenge.tsx
//
// Changements vs version actuelle:
//   1. Ajout d'une prop `onSuccess: () => void` explicite pour notifier le
//      parent au lieu de faire une redirection dure via window.location.href.
//   2. Suppression du `window.location.href = '/dashboard'` qui court-circuitait
//      le routeur React et empêchait l'audit log de se déclencher.
//   3. Conservation du debugInfo pour le troubleshooting (à retirer en prod
//      Phase 2 — voir Phase 3 point 12 console.log).
// ============================================================================

import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';

interface MfaChallengeProps {
  factorId: string;
  onCancel: () => void;
  onSuccess: () => void; // NOUVEAU: callback explicite après vérification
}

export const MfaChallenge: React.FC<MfaChallengeProps> = ({ factorId, onCancel, onSuccess }) => {
  const [verifyCode, setVerifyCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError(null);

    try {
      setDebugInfo('Étape 1: Création du challenge...');
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;

      setDebugInfo('Étape 2: Vérification du code...');
      const verify = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code: verifyCode
      });

      if (verify.error) throw verify.error;

      setDebugInfo('Étape 3: Code validé !');
      // CORRECTION: Appel du callback parent au lieu de window.location.href
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Code invalide ou expiré. Veuillez réessayer.';
      console.error('MFA verify error:', err);
      setDebugInfo('');
      setError(`Erreur: ${message}`);
      setLoading(false);
    }
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <h3 style={{ marginBottom: '1rem', color: 'hsl(var(--text-main))' }}>
        Validation 2FA requise
      </h3>
      <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
        Veuillez entrer le code à 6 chiffres généré par votre application d'authentification (Google Authenticator, Authy).
      </p>

      {error && <div className="error-alert">{error}</div>}
      {debugInfo && <div style={{ color: 'hsl(var(--primary))', fontSize: '0.85rem', marginBottom: '0.5rem', fontStyle: 'italic' }}>{debugInfo}</div>}

      <form onSubmit={handleVerify}>
        <div className="input-group">
          <input
            type="text"
            className="input-field"
            placeholder="Code à 6 chiffres"
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value)}
            maxLength={6}
            required
            autoFocus
            style={{ textAlign: 'center', fontSize: '1.2rem', letterSpacing: '2px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <button type="button" className="btn" onClick={onCancel} style={{ flex: 1, background: 'hsla(var(--text-muted), 0.1)' }}>
            Annuler
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading || verifyCode.length < 6} style={{ flex: 1 }}>
            {loading ? 'Vérification...' : 'Valider'}
          </button>
        </div>
      </form>
    </div>
  );
};
