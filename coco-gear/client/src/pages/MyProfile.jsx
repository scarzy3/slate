import { useState } from 'react';
import { T } from '../theme/theme.js';
import { SYS_ROLE_LABELS, sysRoleColor, fmtDate } from '../theme/helpers.js';
import { Sw, Bg, Bt, Fl, In, SH, DeptBg } from '../components/ui/index.js';
import api from '../api.js';

const PW_RULES = [
  { key: 'length', label: 'At least 8 characters', test: pw => pw.length >= 8 },
  { key: 'upper', label: 'An uppercase letter', test: pw => /[A-Z]/.test(pw) },
  { key: 'lower', label: 'A lowercase letter', test: pw => /[a-z]/.test(pw) },
  { key: 'number', label: 'A number', test: pw => /[0-9]/.test(pw) },
  { key: 'special', label: 'A special character', test: pw => /[^A-Za-z0-9]/.test(pw) },
];

function PasswordRequirements({ password }) {
  if (!password) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6 }}>
      <div style={{ fontSize: 9, color: T.dm, fontFamily: T.m, textTransform: 'uppercase', letterSpacing: 1 }}>Requirements</div>
      {PW_RULES.map(r => {
        const pass = r.test(password);
        return (
          <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontFamily: T.m,
            color: pass ? T.gn : T.mu }}>
            <span style={{ fontSize: 11 }}>{pass ? '\u2713' : '\u2022'}</span> {r.label}
          </div>
        );
      })}
    </div>
  );
}

function MyProfile({ user, personnel, setPersonnel, kits, assets, depts, onRefreshPersonnel }) {
  const [editing, setEditing] = useState(false);
  const [fm, setFm] = useState({ name: user.name, title: user.title || '', email: user.email || '' });
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');

  // Password change state
  const [showPwChange, setShowPwChange] = useState(false);
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const save = async () => {
    if (!fm.name.trim()) return;
    setProfileErr('');
    setProfileMsg('');
    try {
      const update = { name: fm.name.trim(), title: fm.title.trim() };
      if (fm.email.trim() !== (user.email || '')) {
        update.email = fm.email.trim();
      }
      const updated = await api.auth.updateProfile(update);
      setPersonnel(p => p.map(x => x.id === user.id ? { ...x, name: updated.name, title: updated.title, email: updated.email || '' } : x));
      if (onRefreshPersonnel) await onRefreshPersonnel();
      setProfileMsg('Profile updated');
      setEditing(false);
    } catch (e) {
      setProfileErr(e.message);
    }
  };

  const changePassword = async () => {
    setPwError('');
    setPwSuccess('');
    if (!curPw) { setPwError('Enter your current password'); return; }
    if (!newPw) { setPwError('Enter a new password'); return; }
    const failing = PW_RULES.filter(r => !r.test(newPw));
    if (failing.length > 0) { setPwError('Password does not meet all requirements'); return; }
    if (newPw !== newPw2) { setPwError('Passwords do not match'); return; }
    setPwLoading(true);
    try {
      await api.auth.changePassword(newPw, curPw);
      setPwSuccess('Password updated successfully');
      setCurPw('');
      setNewPw('');
      setNewPw2('');
      setTimeout(() => setShowPwChange(false), 1500);
    } catch (e) {
      setPwError(e.message);
    } finally {
      setPwLoading(false);
    }
  };

  const myKits = kits.filter(k => k.issuedTo === user.id);
  const myAssets = assets.filter(a => a.issuedTo === user.id);
  const myDept = user.deptId ? depts.find(d => d.id === user.deptId) : null;
  const roleColor = sysRoleColor(user.role);
  const roleLabel = SYS_ROLE_LABELS[user.role] || 'Operator';

  return (
    <div>
      <SH title="My Profile" sub="Your account settings" />

      <div className="slate-grid-side" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Profile Card */}
        <div style={{ padding: 24, borderRadius: 12, background: T.card, border: '1px solid ' + T.bd }}>
          {!editing ? <>
            {/* View Mode */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <div style={{ width: 64, height: 64, borderRadius: 32, background: roleColor + '22', border: '2px solid ' + roleColor + '44',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: roleColor, fontFamily: T.u }}>
                {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: T.tx, fontFamily: T.u }}>{user.name}</div>
                <div style={{ fontSize: 12, color: T.mu, fontFamily: T.m }}>{user.title || 'No title set'}</div>
              </div>
              <Bt onClick={() => { setFm({ name: user.name, title: user.title || '', email: user.email || '' }); setEditing(true); setProfileMsg(''); setProfileErr(''); }}>Edit</Bt>
            </div>
          </> : <>
            {/* Edit Mode */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                <div style={{ width: 64, height: 64, borderRadius: 32, background: roleColor + '22', border: '2px solid ' + roleColor + '44',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: roleColor, fontFamily: T.u }}>
                  {fm.name.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.tx, fontFamily: T.u }}>Edit Profile</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Fl label="Name">
                  <In value={fm.name} onChange={e => setFm(p => ({ ...p, name: e.target.value }))} placeholder="Your full name" /></Fl>
                <Fl label="Email">
                  <In type="email" value={fm.email} onChange={e => setFm(p => ({ ...p, email: e.target.value }))} placeholder="your@email.com" /></Fl>
                <Fl label="Title">
                  <In value={fm.title} onChange={e => setFm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Project Manager, Engineer" /></Fl>
              </div>
              {profileErr && <div style={{ fontSize: 11, color: T.rd, fontFamily: T.m, textAlign: 'center', padding: '8px 12px', borderRadius: 6,
                background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.15)', marginTop: 8 }}>{profileErr}</div>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                <Bt onClick={() => setEditing(false)}>Cancel</Bt>
                <Bt v="primary" onClick={save}>Save Changes</Bt></div>
            </div>
          </>}

          {profileMsg && !editing && <div style={{ fontSize: 11, color: T.gn, fontFamily: T.m, textAlign: 'center', padding: '8px 12px', borderRadius: 6,
            background: 'rgba(34,197,94,.06)', border: '1px solid rgba(34,197,94,.15)', marginBottom: 12 }}>{profileMsg}</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 8, background: 'rgba(255,255,255,.02)' }}>
              <span style={{ fontSize: 10, color: T.dm, fontFamily: T.m, width: 80 }}>Role</span>
              <Bg color={roleColor} bg={roleColor + '18'}>{roleLabel}</Bg></div>
            {user.email && <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 8, background: 'rgba(255,255,255,.02)' }}>
              <span style={{ fontSize: 10, color: T.dm, fontFamily: T.m, width: 80 }}>Email</span>
              <span style={{ fontSize: 11, color: T.tx, fontFamily: T.m }}>{user.email}</span></div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 8, background: 'rgba(255,255,255,.02)' }}>
              <span style={{ fontSize: 10, color: T.dm, fontFamily: T.m, width: 80 }}>Department</span>
              {myDept ? <DeptBg dept={myDept} /> : <span style={{ fontSize: 11, color: T.mu, fontFamily: T.m }}>Unassigned</span>}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 8, background: 'rgba(255,255,255,.02)' }}>
              <span style={{ fontSize: 10, color: T.dm, fontFamily: T.m, width: 80 }}>User ID</span>
              <span style={{ fontSize: 10, color: T.mu, fontFamily: T.m }}>{user.id.slice(0, 8)}...</span></div>
          </div>

          {/* Change Password Section */}
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid ' + T.bd }}>
            {!showPwChange ? (
              <Bt onClick={() => { setShowPwChange(true); setPwError(''); setPwSuccess(''); setCurPw(''); setNewPw(''); setNewPw2(''); }}>Change Password</Bt>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.tx, fontFamily: T.u }}>Change Password</div>
                <Fl label="Current Password">
                  <In type="password" value={curPw} onChange={e => { setCurPw(e.target.value); setPwError(''); }} placeholder="Enter current password" /></Fl>
                <Fl label="New Password">
                  <In type="password" value={newPw} onChange={e => { setNewPw(e.target.value); setPwError(''); }} placeholder="Enter new password" /></Fl>
                <PasswordRequirements password={newPw} />
                <Fl label="Confirm New Password">
                  <In type="password" value={newPw2} onChange={e => { setNewPw2(e.target.value); setPwError(''); }} placeholder="Re-enter new password"
                    onKeyDown={e => { if (e.key === 'Enter') changePassword(); }} /></Fl>
                {newPw2 && newPw !== newPw2 && <div style={{ fontSize: 10, color: T.rd, fontFamily: T.m }}>Passwords do not match</div>}
                {pwError && <div style={{ fontSize: 11, color: T.rd, fontFamily: T.m, textAlign: 'center', padding: '8px 12px', borderRadius: 6,
                  background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.15)' }}>{pwError}</div>}
                {pwSuccess && <div style={{ fontSize: 11, color: T.gn, fontFamily: T.m, textAlign: 'center', padding: '8px 12px', borderRadius: 6,
                  background: 'rgba(34,197,94,.06)', border: '1px solid rgba(34,197,94,.15)' }}>{pwSuccess}</div>}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <Bt onClick={() => setShowPwChange(false)}>Cancel</Bt>
                  <Bt v="primary" onClick={changePassword} disabled={pwLoading}>{pwLoading ? 'Saving...' : 'Update Password'}</Bt></div>
              </div>
            )}
          </div>
        </div>

        {/* My Equipment */}
        <div style={{ padding: 24, borderRadius: 12, background: T.card, border: '1px solid ' + T.bd }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.tx, fontFamily: T.u, marginBottom: 16 }}>My Equipment</div>

          {myKits.length > 0 && <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.2, color: T.pk, fontFamily: T.m, marginBottom: 8 }}>Kits ({myKits.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {myKits.map(k => { const lastIssue = k.issueHistory[k.issueHistory.length - 1]; return (
                <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 7, background: 'rgba(244,114,182,.03)', border: '1px solid rgba(244,114,182,.12)' }}>
                  <Sw color={k.color} size={22} />
                  <div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 600, color: T.tx, fontFamily: T.u }}>Kit {k.color}</div>
                    <div style={{ fontSize: 9, color: T.mu, fontFamily: T.m }}>Since {fmtDate(lastIssue?.issuedDate)}</div></div></div>); })}</div></div>}

          {myAssets.length > 0 && <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.2, color: T.tl, fontFamily: T.m, marginBottom: 8 }}>Assets ({myAssets.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {myAssets.map(a => { const lastIssue = a.issueHistory[a.issueHistory.length - 1]; return (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 7, background: 'rgba(45,212,191,.03)', border: '1px solid rgba(45,212,191,.12)' }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(45,212,191,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: T.tl }}>{'\u25CE'}</div>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 600, color: T.tx, fontFamily: T.u }}>{a.name}</div>
                    <div style={{ fontSize: 9, color: T.mu, fontFamily: T.m }}>{a.serial} | Since {fmtDate(lastIssue?.issuedDate)}</div></div></div>); })}</div></div>}

          {myKits.length === 0 && myAssets.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: T.dm, fontFamily: T.m, fontSize: 11 }}>
            No equipment currently checked out to you</div>}
        </div>
      </div>

      {/* Activity Summary */}
      <div style={{ marginTop: 20, padding: 20, borderRadius: 12, background: T.card, border: '1px solid ' + T.bd }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.tx, fontFamily: T.u, marginBottom: 16 }}>Account Summary</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 12 }}>
          <div style={{ padding: 14, borderRadius: 8, background: 'rgba(255,255,255,.02)' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: T.pk, fontFamily: T.u }}>{myKits.length}</div>
            <div style={{ fontSize: 10, color: T.mu, fontFamily: T.m }}>Kits Checked Out</div></div>
          <div style={{ padding: 14, borderRadius: 8, background: 'rgba(255,255,255,.02)' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: T.tl, fontFamily: T.u }}>{myAssets.length}</div>
            <div style={{ fontSize: 10, color: T.mu, fontFamily: T.m }}>Assets Checked Out</div></div>
          <div style={{ padding: 14, borderRadius: 8, background: 'rgba(255,255,255,.02)' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: T.bl, fontFamily: T.u }}>{kits.reduce((sum, k) => sum + k.issueHistory.filter(h => h.personId === user.id).length, 0)}</div>
            <div style={{ fontSize: 10, color: T.mu, fontFamily: T.m }}>Total Kit Checkouts</div></div>
          <div style={{ padding: 14, borderRadius: 8, background: 'rgba(255,255,255,.02)' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: T.gn, fontFamily: T.u }}>{kits.filter(k => k.inspections.some(i => i.by === user.id)).length}</div>
            <div style={{ fontSize: 10, color: T.mu, fontFamily: T.m }}>Kits Inspected</div></div>
        </div>
      </div>
    </div>
  );
}

export default MyProfile;
