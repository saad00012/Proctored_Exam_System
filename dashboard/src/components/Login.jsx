import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import API_BASE_URL from '../config';

function Login({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('AI & DS Engineering');
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

      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Prevent student accounts from entering teacher dashboard
        if (db) {
          const userDocSnap = await getDoc(doc(db, 'users', user.uid));
          if (userDocSnap.exists() && userDocSnap.data().role === 'student') {
            await signOut(auth);
            setError('Access Denied: Student accounts cannot access the Teacher Dashboard. Please use the mobile app.');
            setLoading(false);
            return;
          }
        }

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
    } else {
      // Registration Flow (Faculty / Admin Sign Up)
      const isAdminEmail = email.trim().toLowerCase().startsWith('admin');
      if (!name || !email || !password || (!department && !isAdminEmail)) {
        setError('All required fields must be filled.');
        return;
      }

      const domain = email.substring(email.lastIndexOf("@") + 1).trim().toLowerCase();
      setLoading(true);

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

        // 4. Create user profile via backend API to delegate role assignment and verification
        const profileResponse = await fetch(`${API_BASE_URL}/create-profile`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            name: name,
            phoneNumber: '0000000000',
            role: isAdminEmail ? 'superadmin' : 'teacher',
            department: isAdminEmail ? 'Administration' : department,
            semester: 'N/A'
          })
        });

        if (!profileResponse.ok) {
          const errData = await profileResponse.json();
          throw new Error(errData.error || 'Failed to create user profile on backend.');
        }

        console.log(`✅ ${isAdminEmail ? 'Admin' : 'Faculty'} registered & logged in successfully with Firebase.`);
        
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
            <>
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
              
              {email.trim().toLowerCase().startsWith('admin') ? (
                <div style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  background: 'rgba(79, 70, 229, 0.1)',
                  border: '1px solid rgba(79, 70, 229, 0.25)',
                  fontSize: '0.82rem',
                  color: 'var(--primary)',
                  textAlign: 'left'
                }}>
                  👑 <strong>Super Admin Account</strong><br/>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                    Scope: College-wide Administration (No course/semester required)
                  </span>
                </div>
              ) : (
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                    Faculty Department
                  </label>
                  <select
                    className="input-field"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    disabled={loading}
                    required
                  >
                    <option value="AI & DS Engineering">AI & DS Engineering</option>
                    <option value="Computer Science & Engineering">Computer Science & Engineering</option>
                    <option value="Electrical & Computer Engineering">Electrical & Computer Engineering</option>
                    <option value="Electronics & Telecommunication Engineering">Electronics & Telecommunication Engineering</option>
                    <option value="Mechanical & Mechatronics Engineering">Mechanical & Mechatronics Engineering</option>
                    <option value="Applied Science & Engineering">Applied Science & Engineering</option>
                  </select>
                </div>
              )}
            </>
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
