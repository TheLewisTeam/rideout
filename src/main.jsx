import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// ErrorBoundary — if anything in the React tree throws, show a recovery screen
// instead of a blank black page. The "Reset app" button wipes localStorage so
// a corrupted saved profile or broken cached data can't brick the app.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[rideout] crash caught by ErrorBoundary', error, info);
  }
  hardReset = () => {
    try {
      // Wipe Rideout localStorage keys only — leave the browser's other data alone.
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('rideout_')) keys.push(k);
      }
      keys.forEach((k) => localStorage.removeItem(k));
    } catch (e) { /* ignore */ }
    // Also unregister any service workers just in case a cached bundle is bad.
    try {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          regs.forEach((r) => r.unregister());
        });
      }
    } catch (e) { /* ignore */ }
    // Hard reload bypassing cache.
    window.location.reload();
  };
  reloadOnly = () => {
    window.location.reload();
  };
  render() {
    if (!this.state.error) return this.props.children;
    const msg = (this.state.error && this.state.error.message) || String(this.state.error);
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #ec4899, #3b82f6)',
        color: 'white',
        padding: '24px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          maxWidth: 420, width: '100%',
          background: 'rgba(0,0,0,0.35)',
          backdropFilter: 'blur(8px)',
          padding: 20, borderRadius: 20,
          border: '2px solid rgba(255,255,255,0.4)',
        }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, textTransform: 'uppercase' }}>
            Something broke
          </h1>
          <p style={{ margin: '8px 0 16px', opacity: 0.9, fontSize: 14 }}>
            The app hit an error and stopped. You can try a quick reload first —
            if that doesn't work, tap Reset app to wipe the saved data on this
            device and start fresh (you'll re-do onboarding).
          </p>
          <pre style={{
            background: 'rgba(0,0,0,0.3)',
            padding: 10, borderRadius: 10,
            fontSize: 11, overflow: 'auto',
            maxHeight: 140,
          }}>{msg}</pre>
          <button
            onClick={this.reloadOnly}
            style={{
              width: '100%', padding: '12px',
              marginTop: 14, borderRadius: 14,
              background: 'white', color: '#be185d',
              fontWeight: 900, textTransform: 'uppercase',
              border: 'none', fontSize: 15,
            }}
          >Reload</button>
          <button
            onClick={this.hardReset}
            style={{
              width: '100%', padding: '12px',
              marginTop: 8, borderRadius: 14,
              background: 'rgba(255,255,255,0.15)',
              color: 'white',
              fontWeight: 900, textTransform: 'uppercase',
              border: '2px solid rgba(255,255,255,0.4)',
              fontSize: 14,
            }}
          >Reset app (clears saved data)</button>
        </div>
      </div>
    );
  }
}

// Also catch global unhandled errors / promise rejections so a background
// Supabase call blowing up doesn't silently corrupt state.
window.addEventListener('error', (e) => {
  // eslint-disable-next-line no-console
  console.error('[rideout] window error', e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  // eslint-disable-next-line no-console
  console.error('[rideout] unhandled promise rejection', e.reason);
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
