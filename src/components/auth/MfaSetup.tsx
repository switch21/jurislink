import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';

interface MfaSetupProps {
  onSetupComplete: () => void;
}

export const MfaSetup: React.FC<MfaSetupProps> = ({ onSetupComplete }) => {
  const { t } = useTranslation();
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    setupMfa();
  }, []);

  const setupMfa = async () => {
    try {
      // Nettoyer les tentatives précédentes non validées
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const unverifiedFactors = factorsData?.totp?.filter(f => f.status === 'unverified') || [];
      for (const f of unverifiedFactors) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
      });

      if (error) throw error;
      
      setQrCodeUrl(data.totp.qr_code);
      setFactorId(data.id);
    } catch (err: any) {
      console.error('MFA setup error:', err);
      setError(`Erreur d'enrôlement 2FA: ${err.message || 'Veuillez réessayer.'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId) return;
    
    setVerifying(true);
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
      
      onSetupComplete();
    } catch (err: any) {
      console.error('MFA verify error:', err);
      setError("Code invalide. Veuillez réessayer.");
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center' }}>Génération du QR Code...</div>;
  }

  return (
    <div style={{ textAlign: 'center' }}>
      <h3 style={{ marginBottom: '1rem', color: 'hsl(var(--text-main))' }}>
        Authentification à double facteur obligatoire
      </h3>
      <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        En tant qu'administrateur, vous devez sécuriser votre compte. Scannez le QR Code ci-dessous avec Google Authenticator ou Authy.
      </p>
      
      {qrCodeUrl && (
        <div style={{ background: '#fff', padding: '1rem', display: 'inline-block', borderRadius: '8px', marginBottom: '1.5rem' }}>
          <QRCodeSVG value={qrCodeUrl} size={180} />
        </div>
      )}

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
            style={{ textAlign: 'center', fontSize: '1.2rem', letterSpacing: '2px' }}
          />
        </div>
        <button type="submit" className="btn btn-primary login-btn" disabled={verifying || verifyCode.length < 6}>
          {verifying ? 'Vérification...' : 'Valider'}
        </button>
      </form>
    </div>
  );
};
