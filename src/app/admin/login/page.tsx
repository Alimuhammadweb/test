"use client";
import { useActionState } from "react";
import { login } from "../actions";

export default function Login() {
  const [s, a, pending] = useActionState(login, null);
  return (
    <main className="min-h-[80vh] grid place-items-center px-5">
      <form action={a} className="w-full max-w-sm space-y-4">
        <h1 className="headline text-4xl">Admin paneliga kirish</h1>
        <label className="block text-sm font-semibold">Email<input name="email" type="email" autoComplete="username" defaultValue={s?.email} required className="inp mt-1 font-normal" /></label>
        <label className="block text-sm font-semibold">Parol<input name="password" type="password" autoComplete="current-password" required className="inp mt-1 font-normal" /></label>
        {s?.xato && <p role="alert" className="text-sm text-red-700">{s.xato}</p>}
        <button className="btn w-full" disabled={pending}>{pending ? "Kirilmoqda…" : "Kirish"}</button>
      </form>
    </main>
  );
}
