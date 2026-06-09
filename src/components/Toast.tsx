import { useEffect, useState } from 'react';

let _show: (msg: string) => void = () => {};
export function showToast(msg: string) { _show(msg); }

export function ToastHost() {
  const [msg, setMsg] = useState('');
  const [vis, setVis] = useState(false);
  useEffect(() => {
    _show = (m: string) => {
      setMsg(m); setVis(true);
      setTimeout(() => setVis(false), 2500);
    };
  }, []);
  return <div className={`toast ${vis ? 'show' : ''}`}>{msg}</div>;
}
