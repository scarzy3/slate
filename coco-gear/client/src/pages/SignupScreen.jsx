import { useState } from 'react';
import { T } from '../theme/theme.js';
import { Bt, Fl, In } from '../components/ui/index.js';

const PW_RULES = [
  { key: 'length', label: 'At least 8 characters', test: pw => pw.length >= 8 },
  { key: 'upper', label: 'An uppercase letter', test: pw => /[A-Z]/.test(pw) },
  { key: 'lower', label: 'A lowercase letter', test: pw => /[a-z]/.test(pw) },
  { key: 'number', label: 'A number', test: pw => /[0-9]/.test(pw) },
  { key: 'special', label: 'A special character', test: pw => /[^A-Za-z0-9]/.test(pw) },
];

function SignupScreen({ domain, onSignup, onBack, isDark, toggleTheme }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const attempt = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    if (!email.trim()) { setError('Email is required'); return; }
    const emailDomain = email.toLowerCase().split('@')[1];
    if (emailDomain !== domain.toLowerCase()) { setError('Only @' + domain + ' emails are allowed'); return; }
    const failing = PW_RULES.filter(r => !r.test(pw));
    if (failing.length > 0) { setError('Password does not meet all requirements'); return; }
    if (pw !== pw2) { setError('Passwords do not match'); return; }
    setLoading(true); setError('');
    try { await onSignup({ name: name.trim(), email: email.trim().toLowerCase(), password: pw, title: title.trim() }); }
    catch (e) { setError(e.message || 'Signup failed'); setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.u }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        *{box-sizing:border-box}::selection{background:${T._selBg}}
        @media(max-width:767px){input,select{font-size:16px!important}}
      `}</style>
      <div style={{ width: '92%', maxWidth: 420, padding: '28px 24px', borderRadius: 16, background: T.panel, border: '1px solid ' + T.bd, animation: 'mdIn .25s ease-out', position: 'relative' }}>
        <style>{`@keyframes mdIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
        <button onClick={toggleTheme} style={{ all: 'unset', cursor: 'pointer', position: 'absolute', top: 14, right: 14,
          width: 30, height: 30, borderRadius: 15, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)', border: '1px solid ' + T.bd,
          color: T.mu, transition: 'all .15s' }} title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
          {isDark ? '\u2600' : '\u263E'}</button>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 56, height: 56, borderRadius: 28, background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 22, fontWeight: 800, color: T.gn, fontFamily: T.u }}>S</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: T.tx, letterSpacing: -.5 }}>Join Slate</div>
          <div style={{ fontSize: 11, color: T.mu, fontFamily: T.m, marginTop: 4 }}>Sign up with your @{domain} email</div></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Fl label="Full Name"><In value={name} onChange={e => { setName(e.target.value); setError(''); }} placeholder="e.g. Jane Smith" /></Fl>
          <Fl label="Email"><In type="email" value={email} onChange={e => { setEmail(e.target.value); setError(''); }} placeholder={'you@' + domain} /></Fl>
          <Fl label="Title" sub="optional"><In value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Field Engineer" /></Fl>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Fl label="Password"><In type="password" value={pw} onChange={e => { setPw(e.target.value); setError(''); }} placeholder="Min 8 characters" /></Fl>
            <Fl label="Confirm Password"><In type="password" value={pw2} onChange={e => { setPw2(e.target.value); setError(''); }} placeholder="Re-enter password" /></Fl></div>
          {pw && <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ fontSize: 9, color: T.dm, fontFamily: T.m, textTransform: 'uppercase', letterSpacing: 1 }}>Requirements</div>
            {PW_RULES.map(r => {
              const pass = r.test(pw);
              return (
                <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontFamily: T.m,
                  color: pass ? T.gn : T.mu }}>
                  <span style={{ fontSize: 11 }}>{pass ? '\u2713' : '\u2022'}</span> {r.label}
                </div>
              );
            })}
          </div>}
          {pw2 && pw !== pw2 && <div style={{ fontSize: 10, color: T.rd, fontFamily: T.m }}>Passwords do not match</div>}
          {error && <div style={{ fontSize: 11, color: T.rd, fontFamily: T.m, textAlign: 'center', padding: '8px 12px', borderRadius: 6,
            background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.15)' }}>{error}</div>}
          <Bt v="success" onClick={attempt} disabled={loading} style={{ justifyContent: 'center', padding: '11px 0', fontSize: 13 }}>{loading ? 'Creating account...' : 'Create Account'}</Bt>
          <div style={{ textAlign: 'center' }}>
            <button onClick={onBack} style={{ all: 'unset', cursor: 'pointer', fontSize: 11, color: T.mu, fontFamily: T.m }}>Already have an account? Sign in</button></div>
        </div></div></div>);
}

export default SignupScreen;
