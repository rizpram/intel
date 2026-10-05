"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email,setEmail] = useState(""); const [password,setPassword] = useState(""); const [message,setMessage] = useState(""); const [busy,setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const client=createClient();
      const {error}=await client.auth.signInWithPassword({email,password});
      if(error) throw error;
      location.assign("/");
    } catch { setMessage("Sign-in failed. Check your details and try again."); } finally { setBusy(false); }
  }
  return <main className="login-page"><div className="login-card"><div className="login-brand"><div className="brand-mark"><span>R</span></div><div><b>RIZPRAM</b><small>INTELLIGENCE</small></div></div><p className="eyebrow">SECURE WORKSPACE</p><h1>Welcome back</h1><p>Sign in to your intelligence workspace.</p><form onSubmit={submit}><label>Email address<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={busy}>{busy?"Signing in…":"Sign in"}</button>{message&&<small className="login-error">{message}</small>}</form><small className="login-foot">Access is managed through your workspace membership.</small></div></main>;
}
