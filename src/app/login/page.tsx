"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email,setEmail] = useState(""); const [password,setPassword] = useState(""); const [message,setMessage] = useState(""); const [busy,setBusy] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "oauth") {
      setMessage("Google sign-in could not be completed. Try again or contact your workspace administrator.");
    }
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const client=createClient();
      const {error}=await client.auth.signInWithPassword({email,password});
      if(error) throw error;
      location.assign("/");
    } catch { setMessage("Sign-in failed. Check your details and try again."); } finally { setBusy(false); }
  }
  async function signInWithGoogle() {
    setBusy(true); setMessage("");
    try {
      const client = createClient();
      const { error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch {
      setMessage("Google sign-in is not configured yet. Try again later or use email sign-in.");
      setBusy(false);
    }
  }
  return <main className="login-page"><div className="login-card"><div className="login-brand"><div className="brand-mark"><span>R</span></div><div><b>RIZPRAM</b><small>INTELLIGENCE</small></div></div><p className="eyebrow">SECURE WORKSPACE</p><h1>Welcome back</h1><p>Sign in to your intelligence workspace.</p><button className="login-google-button" onClick={() => void signInWithGoogle()} disabled={busy}><span aria-hidden="true">G</span>Continue with Google</button><div className="login-divider"><span>or use email</span></div><form onSubmit={submit}><label>Email address<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={busy}>{busy?"Signing in…":"Sign in"}</button>{message&&<small className="login-error" role="alert">{message}</small>}</form><small className="login-foot">Access is managed through your workspace membership.</small></div></main>;
}
