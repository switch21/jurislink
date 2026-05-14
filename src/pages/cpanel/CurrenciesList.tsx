import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus } from 'lucide-react';

export const CurrenciesList = () => {
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCurrencies();
  }, []);

  const fetchCurrencies = async () => {
    const { data } = await supabase.from('currencies').select('*');
    if (data) setCurrencies(data);
    setLoading(false);
  };

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3>Gestion des Devises</h3>
        <button className="btn btn-primary"><Plus size={18} /> Nouvelle Devise</button>
      </div>

      <div className="glass-card" style={{ padding: '1.5rem' }}>
        {loading ? (
          <p>Chargement...</p>
        ) : (
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid hsla(var(--text-muted), 0.2)' }}>
                <th style={{ padding: '1rem 0' }}>Code</th>
                <th>Nom</th>
                <th>Symbole</th>
              </tr>
            </thead>
            <tbody>
              {currencies.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid hsla(var(--text-muted), 0.1)' }}>
                  <td style={{ padding: '1rem 0', fontWeight: '600' }}>{c.code}</td>
                  <td>{c.name}</td>
                  <td>{c.symbol}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
