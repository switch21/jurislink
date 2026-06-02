import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';

interface MfaChallengeProps {
  factorId: string;
  onVerificationComplete: () => void;
  onCancel: () => void;
}

export const MfaChallenge: React.FC<MfaChallengeProps> = ({ factorId, onVerificationComplete, onCancel }) => {
  const { t } = useTranslation();
  const [verifyCode, setVerifyCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setLoading(true);
    setError(null);
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;
      
      const verify = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code: verifyCode
      });
      
      if (verify.error) throw verify.error;
      
      onVerificationComplete();
    } catch (err: any) {
      console.error('MFA verify error:', err);
      setError("Code invalide ou expiré. Veuillez réessayer.");
    } finally {
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
