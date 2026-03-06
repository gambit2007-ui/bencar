import React, { useMemo, useState } from 'react';
import {
  Car,
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  KeyRound,
} from 'lucide-react';
import { supabase } from './lib/supabase';

type LoginProps = {
  onLoginSuccess?: () => void;
};

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const isEmailValid = useMemo(() => {
    return /\S+@\S+\.\S+/.test(email.trim());
  }, [email]);

  const clearMessages = () => {
    if (errorMessage) setErrorMessage('');
    if (successMessage) setSuccessMessage('');
  };

  const getFriendlyError = (message: string) => {
    const msg = message.toLowerCase();

    if (msg.includes('invalid login credentials')) {
      return 'E-mail ou senha inválidos.';
    }

    if (msg.includes('email not confirmed')) {
      return 'Seu e-mail ainda não foi confirmado.';
    }

    if (msg.includes('failed to fetch')) {
      return 'Falha de conexão. Verifique sua internet.';
    }

    if (msg.includes('too many requests')) {
      return 'Muitas tentativas. Aguarde um pouco e tente novamente.';
    }

    return message || 'Erro ao entrar no sistema.';
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Preencha e-mail e senha.');
      return;
    }

    if (!isEmailValid) {
      setErrorMessage('Digite um e-mail válido.');
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      setSuccessMessage('Login realizado com sucesso.');
      onLoginSuccess?.();
    } catch (err: any) {
      console.error('Erro no login:', err);
      setErrorMessage(getFriendlyError(err?.message || 'Erro ao entrar no sistema.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    clearMessages();

    if (!email.trim()) {
      setErrorMessage('Digite seu e-mail para recuperar a senha.');
      return;
    }

    if (!isEmailValid) {
      setErrorMessage('Digite um e-mail válido para recuperar a senha.');
      return;
    }

    try {
      setResetLoading(true);

      const redirectTo = `${window.location.origin}`;

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });

      if (error) throw error;

      setSuccessMessage(
        'Enviamos um link de recuperação para seu e-mail.'
      );
    } catch (err: any) {
      console.error('Erro ao recuperar senha:', err);
      setErrorMessage(
        getFriendlyError(err?.message || 'Erro ao solicitar recuperação de senha.')
      );
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-8 border-b border-zinc-800 bg-zinc-900">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-orange-600/15 border border-orange-500/20 flex items-center justify-center">
              <Car className="w-7 h-7 text-orange-400" />
            </div>

            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">
                BENCAR
              </h1>
              <p className="text-xs font-extrabold text-orange-400 tracking-[0.25em] uppercase">
                Automóveis
              </p>
            </div>
          </div>

          <h2 className="text-lg font-bold text-white">Acesso ao sistema</h2>
          <p className="text-sm text-zinc-400 mt-1">
            Entre com seu e-mail e senha para acessar o painel.
          </p>
        </div>

        <form onSubmit={handleLogin} className="p-8 space-y-5">
          {(errorMessage || successMessage) && (
            <div
              className={`rounded-xl border px-4 py-3 text-sm flex items-start gap-2 ${
                errorMessage
                  ? 'bg-red-500/10 border-red-500/20 text-red-300'
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              }`}
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{errorMessage || successMessage}</span>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              E-mail
            </label>

            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearMessages();
                }}
                placeholder="seuemail@exemplo.com"
                autoComplete="email"
                disabled={loading || resetLoading}
                className="w-full pl-11 pr-4 py-3 bg-black border border-zinc-800 rounded-xl text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30 disabled:opacity-60"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Senha
            </label>

            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearMessages();
                }}
                placeholder="Digite sua senha"
                autoComplete="current-password"
                disabled={loading || resetLoading}
                className="w-full pl-11 pr-12 py-3 bg-black border border-zinc-800 rounded-xl text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30 disabled:opacity-60"
              />

              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-white transition-colors"
                title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || resetLoading}
            className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Entrando...' : 'Entrar no sistema'}
          </button>

          <button
            type="button"
            onClick={handleResetPassword}
            disabled={loading || resetLoading}
            className="w-full py-3 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-60 disabled:cursor-not-allowed text-zinc-300 font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {resetLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <KeyRound className="w-4 h-4" />
            )}
            {resetLoading ? 'Enviando link...' : 'Esqueci minha senha'}
          </button>
        </form>
      </div>
    </div>
  );
}