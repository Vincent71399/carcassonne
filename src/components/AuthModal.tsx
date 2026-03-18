import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

interface AuthModalProps {
    onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose }) => {
    const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
    const { t } = useTranslation();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            if (isLogin) {
                await signInWithEmail(email, password);
            } else {
                await signUpWithEmail(email, password);
            }
            onClose();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogle = async () => {
        try {
            await signInWithGoogle();
            onClose();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Google sign-in failed');
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000
        }}>
            <div style={{
                background: '#2c3e50', padding: '30px', borderRadius: '12px',
                width: '90%', maxWidth: '400px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                color: 'white', position: 'relative'
            }}>
                <button
                    onClick={onClose}
                    style={{ position: 'absolute', top: 15, right: 15, background: 'transparent', border: 'none', color: '#aaa', fontSize: '20px', cursor: 'pointer' }}
                >✕</button>

                <h2 style={{ margin: '0 0 20px 0', textAlign: 'center' }}>
                    {isLogin ? t('auth.login', 'Login') : t('auth.signUp', 'Sign Up')}
                </h2>

                {error && <div style={{ color: '#e74c3c', marginBottom: '15px', fontSize: '14px', textAlign: 'center' }}>{error}</div>}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required
                        style={{ padding: '12px', borderRadius: '6px', border: 'none', fontSize: '16px' }} />
                    <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                        style={{ padding: '12px', borderRadius: '6px', border: 'none', fontSize: '16px' }} />
                    <button type="submit" disabled={loading}
                        style={{ padding: '12px', background: '#3498db', color: 'white', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}>
                        {loading ? '...' : (isLogin ? t('auth.loginBtn', 'Login') : t('auth.signUpBtn', 'Sign Up'))}
                    </button>
                </form>

                <div style={{ textAlign: 'center', margin: '15px 0' }}>{t('auth.or', 'or')}</div>

                <button onClick={handleGoogle}
                    style={{ width: '100%', padding: '12px', background: 'white', color: '#444', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                    Continue with Google
                </button>

                <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '14px', color: '#ccc' }}>
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <span onClick={() => setIsLogin(!isLogin)} style={{ color: '#3498db', cursor: 'pointer', fontWeight: 'bold' }}>
                        {isLogin ? 'Sign Up' : 'Login'}
                    </span>
                </div>
            </div>
        </div>
    );
};
