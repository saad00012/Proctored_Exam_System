import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, isMock } from '../firebase';

function Login({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isLogin) {
      // Sign In Flow
      if (!email || !password) {
        setError('Please fill in all fields.');
        return;
      }

      setLoading(true);

      if (isMock) {
        setTimeout(() => {
          setLoading(false);
          if (email === 'admin@dnyanshree.edu.in' && password === 'admin123') {
            console.log("✅ Logged in successfully (Mock Mode).");
            const mockUser = {
              uid: 'mock-uid-teacher-456',
              email: 'admin@dnyanshree.edu.in',
              name: 'Staff Coordinator',
              token: 'mock-teacher'
            };
            localStorage.setItem('diet_proctor_user', JSON.stringify(mockUser));
            onLoginSuccess(mockUser);
          } else {
            setError('Invalid credentials. Use admin@dnyanshree.edu.in / admin123 for Mock Mode.');
          }
        }, 800);
      } else {
        try {
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          const user = userCredential.user;
          const token = await user.getIdToken();
          
          console.log("✅ Logged in successfully with Firebase Auth.");
          onLoginSuccess({
            uid: user.uid,
            email: user.email,
            name: user.displayName || 'Teacher',
            token: token
          });
        } catch (err) {
          console.error("Sign-in error:", err);
          setError(err.message || 'Authentication failed. Please check your credentials.');
        } finally {
          setLoading(false);
        }
      }
    } else {
      // Registration Flow (Faculty Sign Up)
      if (!name || !email || !password) {
        setError('All fields are required for registration.');
        return;
      }

      const domain = email.substring(email.lastIndexOf("@") + 1).trim().toLowerCase();
      setLoading(true);

      if (isMock) {
        setTimeout(() => {
          setLoading(false);
          if (domain === 'dnyanshree.edu.in') {
            console.log("✅ Registered successfully (Mock Mode).");
            const mockUser = {
              uid: 'mock-uid-' + Date.now(),
              email: email,
              name: name,
              token: 'mock-teacher'
            };
            localStorage.setItem('diet_proctor_user', JSON.stringify(mockUser));
            onLoginSuccess(mockUser);
          } else {
            setError('Mock Mode only whitelists @dnyanshree.edu.in domain.');
          }
        }, 800);
      } else {
        try {
          // 1. Verify email domain matches allowed domains in Firestore
          const domainDoc = await getDoc(doc(db, 'allowed_domains', domain));
          if (!domainDoc.exists() || !domainDoc.data().isActive) {
            setError(`Registration blocked: @${domain} is not a whitelisted college domain.`);
            setLoading(false);
            return;
          }

          // 2. Create Firebase Auth user
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const user = userCredential.user;

          // 3. Set display name profile
          await updateProfile(user, { displayName: name });
          
          const token = await user.getIdToken();
          console.log("✅ Faculty registered & logged in successfully with Firebase.");
          
          onLoginSuccess({
            uid: user.uid,
            email: user.email,
            name: name,
            token: token
          });
        } catch (err) {
          console.error("Registration error:", err);
          setError(err.message || 'Registration failed. Please check your details.');
        } finally {
          setLoading(false);
        }
      }
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '1rem'
    }}>
      <div className="glass-card" style={{
        maxWidth: '420px',
        width: '100%',
        padding: '2.5rem',
        textAlign: 'center'
      }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '0.5rem' }}>
            DIET <span style={{ color: 'var(--primary)' }}>Proctor</span>
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            {isLogin ? 'Sign in to Teacher Management Portal' : 'Register New Faculty Account'}
          </p>
        </div>

        {isMock && isLogin && (
          <div style={{
            background: 'var(--color-info-bg)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            color: '#93c5fd',
            padding: '0.75rem',
            borderRadius: '10px',
            fontSize: '0.8rem',
            marginBottom: '1.5rem',
            textAlign: 'left'
          }}>
            <strong>💡 Development Mock Mode</strong><br/>
            Use email: <code style={{color: 'white'}}>admin@dnyanshree.edu.in</code><br/>
            Use password: <code style={{color: 'white'}}>admin123</code>
          </div>
        )}

        {error && (
          <div style={{
            background: 'var(--color-danger-bg)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#fca5a5',
            padding: '0.75rem',
            borderRadius: '10px',
            fontSize: '0.85rem',
            marginBottom: '1.5rem',
            textAlign: 'left'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
          
          {!isLogin && (
            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Full Name
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Prof. Ramesh Patil"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          )}

          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              College Email
            </label>
            <input
              type="email"
              className="input-field"
              placeholder="e.g. name@dnyanshree.edu.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Password
            </label>
            <input
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary pulse-primary"
            style={{ width: '100%', marginTop: '1rem', padding: '0.85rem' }}
            disabled={loading}
          >
            {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
          <button 
            type="button" 
            className="btn btn-secondary" 
            style={{ width: '100%', padding: '0.6rem', fontSize: '0.85rem' }}
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            disabled={loading}
          >
            {isLogin ? 'Create an account' : 'Already have an account? Sign In'}
          </button>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
            Restricted to whitelisted college email domains.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
