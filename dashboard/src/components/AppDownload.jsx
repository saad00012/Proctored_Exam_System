import React, { useState, useEffect } from 'react';
import API_BASE_URL from '../config';

function AppDownload() {
  const [appConfig, setAppConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Default known version catalogue (fallback / history)
  const defaultVersions = [
    {
      versionCode: 3,
      versionName: 'v3.0 (Latest)',
      fileName: '3.apk',
      downloadUrl: '/apps/3.apk',
      size: '23.6 MB',
      date: '06 Oct 2026',
      status: 'recommended',
      notes: [
        'Added per-question customizable marking & grading system',
        'Configurable exam passing percentage threshold',
        'Added pre-exam instructions & rules screen',
        'Mark for Review & clickable question jump navigator',
        'Improved offline write-ahead answer vault'
      ]
    },
    {
      versionCode: 2,
      versionName: 'v2.0',
      fileName: '2.apk',
      downloadUrl: '/apps/2.apk',
      size: '22.8 MB',
      date: '28 Sep 2026',
      status: 'stable',
      notes: [
        'Enhanced Device Admin anti-cheating & lock task mode',
        'FCM push notification support on exam start',
        'Strict camera lock during examination'
      ]
    },
    {
      versionCode: 1,
      versionName: 'v1.0',
      fileName: '1.apk',
      downloadUrl: '/apps/1.apk',
      size: '21.5 MB',
      date: '15 Sep 2026',
      status: 'legacy',
      notes: [
        'Initial release with real-time proctored examinations',
        'OTP entry & student profile integration'
      ]
    }
  ];

  const [versions, setVersions] = useState(defaultVersions);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/app-version`);
        if (res.ok) {
          const data = await res.json();
          setAppConfig(data);

          if (data && data.latestVersionCode) {
            // Update the latest item with live database values if available
            setVersions(prev => {
              const updated = [...prev];
              const latestCode = Number(data.latestVersionCode);
              const existingIdx = updated.findIndex(v => v.versionCode === latestCode);

              const liveUrl = data.apkDownloadUrl || `/apps/${latestCode}.apk`;
              const liveNotes = data.releaseNotes ? data.releaseNotes.split('\n').filter(Boolean) : updated[0]?.notes;

              if (existingIdx >= 0) {
                updated[existingIdx] = {
                  ...updated[existingIdx],
                  versionName: `v${data.latestVersionName || latestCode} (Latest)`,
                  downloadUrl: liveUrl,
                  notes: liveNotes,
                  status: 'recommended'
                };
              } else {
                updated.unshift({
                  versionCode: latestCode,
                  versionName: `v${data.latestVersionName || latestCode} (Latest)`,
                  fileName: `${latestCode}.apk`,
                  downloadUrl: liveUrl,
                  size: '23.6 MB',
                  date: 'Today',
                  status: 'recommended',
                  notes: liveNotes
                });
              }
              return updated;
            });
          }
        }
      } catch (err) {
        console.warn('Could not load live app-version config:', err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const latest = versions[0];
  const activeVersion = selectedVersion || latest;

  const handleCopyLink = (url) => {
    const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-main)',
      display: 'flex',
      flexDirection: 'column',
      color: 'var(--text-primary)'
    }}>
      {/* ── Top Header ────────────────────────────────────────────── */}
      <header style={{
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-color)',
        padding: '1rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.4rem',
            boxShadow: 'var(--shadow-sm)'
          }}>
            🛡️
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              Dnyanshree Exam App
            </h1>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
              Official Student Android Application Download Portal
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <a
            href="/"
            className="btn btn-secondary btn-sm"
            style={{ textDecoration: 'none', fontSize: '0.82rem', fontWeight: 600 }}
          >
            🏛️ Teacher / Admin Login
          </a>
        </div>
      </header>

      {/* ── Main Content Container ─────────────────────────────────── */}
      <main style={{
        maxWidth: '1100px',
        width: '100%',
        margin: '0 auto',
        padding: '2.5rem 1.5rem 4rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '2.5rem'
      }}>
        {/* ── Hero Section ─────────────────────────────────────────── */}
        <div className="glass-card" style={{
          padding: '2.5rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '2.5rem',
          alignItems: 'center',
          background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.05), rgba(124, 58, 237, 0.05))',
          border: '1px solid rgba(79, 70, 229, 0.15)'
        }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
              <span className="badge badge-primary" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                {latest.versionName}
              </span>
              <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>
                🟢 Verified & Secure
              </span>
            </div>

            <h2 style={{
              fontSize: '2.3rem',
              fontWeight: 800,
              lineHeight: 1.2,
              marginBottom: '1rem',
              letterSpacing: '-0.03em'
            }}>
              Download the Official <span className="gradient-text">Proctored Exam App</span>
            </h2>

            <p style={{
              fontSize: '1rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              marginBottom: '1.75rem'
            }}>
              Take your semester examinations, internal unit tests, and quizzes safely on your Android device with instant question loading, offline answer sync, and anti-cheating protection.
            </p>

            <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <a
                href={latest.downloadUrl}
                download
                className="btn btn-primary pulse-primary"
                style={{
                  padding: '0.9rem 1.75rem',
                  fontSize: '1rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  boxShadow: '0 10px 25px -5px rgba(79, 70, 229, 0.4)'
                }}
              >
                <span>⬇️</span> Download Latest APK ({latest.size})
              </a>

              <button
                className="btn btn-secondary"
                onClick={() => handleCopyLink(latest.downloadUrl)}
                style={{ padding: '0.85rem 1.2rem', fontSize: '0.9rem' }}
                title="Copy direct download link"
              >
                {copiedLink ? '✓ Link Copied!' : '🔗 Copy Link'}
              </button>
            </div>

            <div style={{
              marginTop: '1.25rem',
              display: 'flex',
              gap: '1.25rem',
              fontSize: '0.8rem',
              color: 'var(--text-muted)'
            }}>
              <span>📦 Package: <strong>edu.dnyanshree.exam</strong></span>
              <span>📱 Android 8.0+ (Oreo to 15+)</span>
              <span>🔒 Signed Release</span>
            </div>
          </div>

          {/* Quick Specifications Box */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.7)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '1.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              ✨ Key Features in this Build
            </h3>
            <ul style={{
              margin: 0,
              paddingLeft: '1.2rem',
              fontSize: '0.88rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.75,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem'
            }}>
              <li><strong>Write-Ahead Answer Vault:</strong> Answers are saved locally in milliseconds and sync seamlessly even if WiFi/data drops.</li>
              <li><strong>Real-Time Monitoring:</strong> Monitored timer with auto-submit on countdown completion.</li>
              <li><strong>Device Admin & Screen Lock:</strong> Prevents unauthorized application switching and blocks camera abuse.</li>
              <li><strong>Mark for Review:</strong> Flag questions and jump across the navigator with a single tap.</li>
              <li><strong>Instant Scorecard:</strong> Review your score, percentage, and pass/fail status immediately upon submission.</li>
            </ul>
          </div>
        </div>

        {/* ── How to Install Guide ─────────────────────────────────── */}
        <div>
          <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
              📖 How to Install the App (Step-by-Step)
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: '0.35rem 0 0 0' }}>
              Since this is an institutional exam app distributed directly by the college, follow these simple steps to install:
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1.25rem'
          }}>
            {/* Step 1 */}
            <div className="glass-card" style={{ padding: '1.5rem', position: 'relative' }}>
              <div style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                fontSize: '1.5rem',
                fontWeight: 900,
                color: 'var(--primary-glow)',
                userSelect: 'none'
              }}>
                01
              </div>
              <div style={{ fontSize: '1.8rem', marginBottom: '0.75rem' }}>⬇️</div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.5rem' }}>Download APK</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                Tap the <strong>Download Latest APK</strong> button above. If Chrome prompts <em>"File might be harmful"</em>, tap <strong>Download anyway</strong> (standard notice for college APKs).
              </p>
            </div>

            {/* Step 2 */}
            <div className="glass-card" style={{ padding: '1.5rem', position: 'relative' }}>
              <div style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                fontSize: '1.5rem',
                fontWeight: 900,
                color: 'var(--primary-glow)',
                userSelect: 'none'
              }}>
                02
              </div>
              <div style={{ fontSize: '1.8rem', marginBottom: '0.75rem' }}>🔓</div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.5rem' }}>Allow Unknown Apps</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                Open the downloaded file. When prompted, tap <strong>Settings</strong> and turn ON <strong>"Allow from this source"</strong> (Chrome / Files).
              </p>
            </div>

            {/* Step 3 */}
            <div className="glass-card" style={{ padding: '1.5rem', position: 'relative' }}>
              <div style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                fontSize: '1.5rem',
                fontWeight: 900,
                color: 'var(--primary-glow)',
                userSelect: 'none'
              }}>
                03
              </div>
              <div style={{ fontSize: '1.8rem', marginBottom: '0.75rem' }}>🛡️</div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.5rem' }}>Device Admin Setup</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                Open the app and grant <strong>Device Admin permission</strong> (or Screen Pinning mode) to ensure secure exam lock during testing.
              </p>
            </div>

            {/* Step 4 */}
            <div className="glass-card" style={{ padding: '1.5rem', position: 'relative' }}>
              <div style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                fontSize: '1.5rem',
                fontWeight: 900,
                color: 'var(--primary-glow)',
                userSelect: 'none'
              }}>
                04
              </div>
              <div style={{ fontSize: '1.8rem', marginBottom: '0.75rem' }}>🔑</div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.5rem' }}>Login & Exam OTP</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                Log in with your official college email. When your faculty starts the paper, enter the <strong>6-digit Room OTP</strong> to begin!
              </p>
            </div>
          </div>
        </div>

        {/* ── Vivo / Xiaomi / Realme Note ─────────────────────────── */}
        <div style={{
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '14px',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '1rem',
          textAlign: 'left'
        }}>
          <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>💡</span>
          <div>
            <h4 style={{ margin: '0 0 0.25rem 0', color: '#b45309', fontSize: '0.95rem', fontWeight: 700 }}>
              Using Vivo, Xiaomi, Oppo, or Realme on Android 13+?
            </h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Android 13 blocks side-loaded apps from accessing Device Admin by default. If you see <em>"Restricted Setting"</em>, go to <strong>Phone Settings → Apps → Dnyanshree Exam App → 3 dots in top-right corner (⋮) → "Allow restricted settings"</strong>, then return to the app. You can also tap <strong>"Screen Pinning Mode"</strong> inside the app as a 1-tap alternative!
            </p>
          </div>
        </div>

        {/* ── Version History & Download Archive ───────────────────── */}
        <div>
          <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
                🗂️ App Releases & Version Archive
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: '0.35rem 0 0 0' }}>
                Download the current release or access older versions if instructed by your department:
              </p>
            </div>

            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Total Releases: <strong>{versions.length}</strong>
            </span>
          </div>

          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255, 255, 255, 0.05)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 600 }}>Version</th>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 600 }}>File Name</th>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 600 }}>Release Date</th>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 600 }}>Size</th>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 600, textAlign: 'right' }}>Download</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((ver, idx) => {
                  const isLatest = idx === 0;
                  return (
                    <React.Fragment key={ver.versionCode}>
                      <tr style={{
                        borderBottom: '1px solid var(--border-color)',
                        background: isLatest ? 'rgba(79, 70, 229, 0.03)' : 'transparent'
                      }}>
                        <td style={{ padding: '1rem 1.25rem', fontWeight: 700, color: isLatest ? 'var(--primary)' : 'inherit' }}>
                          {ver.versionName}
                        </td>
                        <td style={{ padding: '1rem 1.25rem', fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {ver.fileName}
                        </td>
                        <td style={{ padding: '1rem 1.25rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          {ver.date}
                        </td>
                        <td style={{ padding: '1rem 1.25rem', fontSize: '0.85rem' }}>
                          {ver.size}
                        </td>
                        <td style={{ padding: '1rem 1.25rem' }}>
                          <span className={`badge ${
                            ver.status === 'recommended' ? 'badge-success' : ver.status === 'stable' ? 'badge-info' : 'badge-neutral'
                          }`} style={{ fontSize: '0.72rem' }}>
                            {ver.status === 'recommended' ? '★ Recommended' : ver.status === 'stable' ? 'Stable' : 'Archive'}
                          </span>
                        </td>
                        <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
                            <a
                              href={ver.downloadUrl}
                              download
                              className={`btn ${isLatest ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                              style={{ textDecoration: 'none', padding: '0.45rem 0.9rem', fontSize: '0.82rem' }}
                            >
                              ⬇️ Download
                            </a>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleCopyLink(ver.downloadUrl)}
                              title="Copy URL"
                              style={{ padding: '0.45rem 0.6rem' }}
                            >
                              🔗
                            </button>
                          </div>
                        </td>
                      </tr>
                      {ver.notes && ver.notes.length > 0 && (
                        <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.015)' }}>
                          <td colSpan={6} style={{ padding: '0.65rem 1.25rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            <strong>Changelog:</strong> {ver.notes.join(' • ')}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Help & Frequently Asked Questions ────────────────────── */}
        <div className="glass-card" style={{ padding: '2rem', textAlign: 'left' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '1.25rem' }}>
            ❓ Frequently Asked Questions (FAQ)
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <h4 style={{ margin: '0 0 0.3rem 0', fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Q: Why does the app block switching between apps?
              </h4>
              <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                To maintain fair academic standards, the app monitors focus. Minimizing the app or attempting to open other applications registers a proctoring infraction and reduces your remaining time. Multiple infractions will trigger an automatic lockout.
              </p>
            </div>

            <div>
              <h4 style={{ margin: '0 0 0.3rem 0', fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Q: What happens if my internet connection drops during the exam?
              </h4>
              <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Do not panic! All answers are immediately recorded to your phone's offline vault. The app will automatically sync queued answers as soon as your connection restores.
              </p>
            </div>

            <div>
              <h4 style={{ margin: '0 0 0.3rem 0', fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Q: Where do I get the Room OTP key?
              </h4>
              <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Your presiding invigilator / subject teacher generates and announces the 6-digit Room OTP key when the exam is officially commenced in the examination hall.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer style={{
        marginTop: 'auto',
        borderTop: '1px solid var(--border-color)',
        padding: '2rem',
        textAlign: 'center',
        background: 'rgba(255, 255, 255, 0.6)',
        color: 'var(--text-muted)',
        fontSize: '0.85rem'
      }}>
        <p style={{ margin: '0 0 0.4rem 0', fontWeight: 600, color: 'var(--text-primary)' }}>
          Dnyanshree Institute of Engineering & Technology — Proctored Examination Portal
        </p>
        <p style={{ margin: 0 }}>
          For technical issues or login credentials assistance, contact your department exam coordinator.
        </p>
      </footer>
    </div>
  );
}

export default AppDownload;
