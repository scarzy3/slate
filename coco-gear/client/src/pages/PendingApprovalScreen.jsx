import { useState, useEffect, useCallback } from 'react';
import { T } from '../theme/theme.js';
import { Bt } from '../components/ui/index.js';

function PendingApprovalScreen({ email, isDark, toggleTheme, onBack, onApproved }) {
  const [status, setStatus] = useState('pending');
  const [denialReason, setDenialReason] = useState(null);
  const [checking, setChecking] = useState(false);

  const checkStatus = useCallback(async () => {
    if (!email) return;
    setChecking(true);
    try {
      const res = await fetch(`/api/auth/signup-status/${encodeURIComponent(email)}`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data.approvalStatus);
        if (data.denialReason) setDenialReason(data.denialReason);
        if (data.approvalStatus === 'approved' && onApproved) {
          onApproved();
        }
      }
    } catch { /* silent */ }
    setChecking(false);
  }, [email, onApproved]);

  // Poll every 10 seconds
  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  const isDenied = status === 'denied';

  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.u }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        *{box-sizing:border-box}::selection{background:${T._selBg}}
        @keyframes mdIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
      `}</style>
      <div style={{ width: '92%', maxWidth: 440, padding: '32px 28px', borderRadius: 16, background: T.panel,
        border: '1px solid ' + T.bd, animation: 'mdIn .25s ease-out', position: 'relative', textAlign: 'center' }}>
        <button onClick={toggleTheme} style={{ all: 'unset', cursor: 'pointer', position: 'absolute', top: 14, right: 14,
          width: 30, height: 30, borderRadius: 15, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)', border: '1px solid ' + T.bd,
          color: T.mu, transition: 'all .15s' }} title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
          {isDark ? '\u2600' : '\u263E'}</button>

        {/* Icon */}
        <div style={{ width: 64, height: 64, borderRadius: 32,
          background: isDenied ? 'rgba(239,68,68,.1)' : 'rgba(251,191,36,.1)',
          border: '1px solid ' + (isDenied ? 'rgba(239,68,68,.25)' : 'rgba(251,191,36,.25)'),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 18px', fontSize: 26 }}>
          {isDenied ? '\u2717' : '\u23F3'}
        </div>

        {/* Title */}
        <div style={{ fontSize: 22, fontWeight: 800, color: T.tx, letterSpacing: -.5, marginBottom: 8 }}>
          {isDenied ? 'Access Denied' : 'Pending Approval'}
        </div>

        {/* Message */}
        <div style={{ fontSize: 12, color: T.mu, fontFamily: T.m, lineHeight: 1.6, marginBottom: 20, maxWidth: 340, margin: '0 auto 20px' }}>
          {isDenied
            ? 'Your account request has been denied by an administrator.'
            : 'Your account has been created and is awaiting approval from a director, manager, or engineer. You\'ll be able to access Slate once your account is approved.'}
        </div>

        {/* Denial Reason */}
        {isDenied && denialReason && (
          <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(239,68,68,.06)',
            border: '1px solid rgba(239,68,68,.15)', marginBottom: 20, textAlign: 'left' }}>
            <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.2, color: T.rd,
              fontFamily: T.m, fontWeight: 600, marginBottom: 4 }}>Reason</div>
            <div style={{ fontSize: 12, color: T.tx, fontFamily: T.m }}>{denialReason}</div>
          </div>
        )}

        {/* Status indicator */}
        {!isDenied && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '10px 16px', borderRadius: 8, background: 'rgba(251,191,36,.06)',
            border: '1px solid rgba(251,191,36,.15)', marginBottom: 20 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fbbf24',
              animation: 'pulse 2s ease-in-out infinite' }} />
            <span style={{ fontSize: 11, color: T.am || '#fbbf24', fontFamily: T.m, fontWeight: 600 }}>
              {checking ? 'Checking status...' : 'Waiting for approval'}
            </span>
          </div>
        )}

        {/* Email */}
        {email && (
          <div style={{ fontSize: 10, color: T.dm, fontFamily: T.m, marginBottom: 20 }}>
            Account: {email}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          {!isDenied && (
            <Bt v="default" onClick={checkStatus} disabled={checking}
              style={{ fontSize: 11, padding: '8px 20px' }}>
              Check Status
            </Bt>
          )}
          <button onClick={onBack} style={{ all: 'unset', cursor: 'pointer', fontSize: 11, color: T.mu,
            fontFamily: T.m }}>
            Back to Sign In
          </button>
        </div>
      </div>
    </div>
  );
}

export default PendingApprovalScreen;
