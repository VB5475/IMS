import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  ShieldCheck,
  Lock,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  LogIn,
  KeyRound,
} from 'lucide-react';
import './LoginPage.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showError, setShowError] = useState(true);

  const handleSubmit = (event) => {
    event.preventDefault();
    setShowError(false);
    navigate('/');
  };

  return (
    <main className="login-page">
      <section className="login-hero">
        <div className="login-hero__content">
          <div className="login-hero__brand">
            <Box size={32} strokeWidth={1.5} />
            <h1>Horizon Enterprise</h1>
          </div>
          <div className="login-hero__intro">
            <h2>Horizon Enterprise Suite</h2>
            <p>Enterprise Resource Planning</p>
          </div>
        </div>
        <div className="login-hero__trust">
          <span><ShieldCheck size={14} /> Secure</span>
          <span className="login-hero__dot" />
          <span><Lock size={14} /> SOC 2</span>
          <span className="login-hero__dot" />
          <span><CheckCircle2 size={14} /> 99.9% Uptime</span>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-panel__inner">
          <div className="login-card">
            <div className="login-card__header">
              <div className="login-card__logo">
                <Box size={22} strokeWidth={1.5} />
              </div>
              <h3>Horizon Enterprise</h3>
              <p>Sign in to your account</p>
            </div>

            {showError && (
              <div className="login-error" role="alert">
                <AlertCircle size={16} />
                <span>Invalid email or password. Please try again.</span>
              </div>
            )}

            <form className="login-form" onSubmit={handleSubmit}>
              <label className="login-field">
                <span>Email address</span>
                <input type="email" name="email" placeholder="name@company.com" required autoFocus />
              </label>

              <div className="login-field">
                <div className="login-field__row">
                  <label htmlFor="password">Password</label>
                  <button type="button" className="login-field__link">Forgot password?</button>
                </div>
                <div className="login-field__password">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    required
                  />
                  <button
                    type="button"
                    className="login-field__toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <label className="login-remember">
                <input type="checkbox" name="remember" defaultChecked />
                <span>Remember me for 30 days</span>
              </label>

              <button type="submit" className="login-submit">
                Sign In
                <LogIn size={16} />
              </button>
            </form>

            <div className="login-divider">
              <span>Internal Access Only</span>
            </div>

            <button type="button" className="login-sso">
              <KeyRound size={16} />
              Sign in with SSO
            </button>
          </div>

          <p className="login-footer">© 2026 Horizon Enterprise · All Rights Reserved</p>
        </div>
      </section>
    </main>
  );
}
