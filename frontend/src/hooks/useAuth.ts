"use client";

import { useState, useEffect, useCallback } from "react";
import type { AuthUser, AuthState } from "@/types";

const STORAGE_KEYS = {
  USER: "draythos_auth_user",
  TOKEN: "draythos_auth_token",
  OPENROUTER_KEY: "draythos_openrouter_key",
  GEMINI_KEY: "draythos_gemini_key",
  CUSTOM_INSTRUCTIONS: "draythos_custom_instructions",
  SELECTED_MODEL: "draythos_selected_model",
  PREFERRED_PROVIDER: "draythos_preferred_provider",
};

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
    apiKey: null,
  });
  const [openRouterKey, setOpenRouterKey] = useState<string>("");
  const [geminiKey, setGeminiKey] = useState<string>("");
  const [customInstructions, setCustomInstructions] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("gemini-3.8-flash");
  const [preferredProvider, setPreferredProvider] = useState<string>("gemini");
  const [memories, setMemories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load preferences & memories for authenticated user
  const refreshPreferences = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/user/preferences?user_id=${encodeURIComponent(userId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.custom_instructions !== undefined) {
          setCustomInstructions(data.custom_instructions);
          localStorage.setItem(STORAGE_KEYS.CUSTOM_INSTRUCTIONS, data.custom_instructions);
        }
        if (data.selected_model) {
          setSelectedModel(data.selected_model);
          localStorage.setItem(STORAGE_KEYS.SELECTED_MODEL, data.selected_model);
        }
        if (data.preferred_provider) {
          setPreferredProvider(data.preferred_provider);
          localStorage.setItem(STORAGE_KEYS.PREFERRED_PROVIDER, data.preferred_provider);
        }
        if (Array.isArray(data.memories)) {
          setMemories(data.memories);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch user preferences:", err);
    }
  }, []);

  // Initialize from localStorage and cookies
  useEffect(() => {
    try {
      let savedUser = localStorage.getItem(STORAGE_KEYS.USER);
      let savedToken = localStorage.getItem(STORAGE_KEYS.TOKEN);
      const savedOrKey = localStorage.getItem(STORAGE_KEYS.OPENROUTER_KEY);
      const savedGemKey = localStorage.getItem(STORAGE_KEYS.GEMINI_KEY);
      const savedInst = localStorage.getItem(STORAGE_KEYS.CUSTOM_INSTRUCTIONS);
      const savedModel = localStorage.getItem(STORAGE_KEYS.SELECTED_MODEL);
      const savedProv = localStorage.getItem(STORAGE_KEYS.PREFERRED_PROVIDER);

      if (savedInst) setCustomInstructions(savedInst);
      if (savedModel) {
        setSelectedModel(savedModel);
      }
      if (savedProv) setPreferredProvider(savedProv);

      // Hydrate from draythos_auth cookie if localStorage was empty or cleared
      if (!savedUser && typeof document !== "undefined") {
        const cookieMatch = document.cookie.match(/(?:^|;\s*)draythos_auth=([^;]+)/);
        if (cookieMatch) {
          try {
            const raw = decodeURIComponent(cookieMatch[1]);
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object" && parsed.id && (parsed.email || parsed.name)) {
              savedUser = JSON.stringify(parsed);
              const tokenMatch = document.cookie.match(/(?:^|;\s*)draythos_token=([^;]+)/);
              const resolvedToken = (parsed.token as string) || (tokenMatch ? decodeURIComponent(tokenMatch[1]) : `dyt_${parsed.id}`);
              savedToken = resolvedToken;
              localStorage.setItem(STORAGE_KEYS.USER, savedUser);
              localStorage.setItem(STORAGE_KEYS.TOKEN, resolvedToken);
            }
          } catch (_) {}
        }
      }

      if (savedUser && savedToken) {
        try {
          const parsedUser = JSON.parse(savedUser);
          if (parsedUser && parsedUser.id) {
            setAuthState({
              isAuthenticated: true,
              user: parsedUser,
              token: savedToken,
              apiKey: null,
            });

            // Ensure cookie is in sync with localStorage
            if (typeof document !== "undefined") {
              document.cookie = `draythos_auth=${encodeURIComponent(savedUser)}; path=/; max-age=604800; SameSite=Lax`;
              document.cookie = `draythos_token=${encodeURIComponent(savedToken)}; path=/; max-age=604800; SameSite=Lax`;
            }

            // Fetch user keys
            fetch(`/api/user/keys?user_id=${encodeURIComponent(parsedUser.id)}`)
              .then((res) => (res.ok ? res.json() : null))
              .then((data) => {
                if (data?.openrouter_key) {
                  setOpenRouterKey(data.openrouter_key);
                  localStorage.setItem(STORAGE_KEYS.OPENROUTER_KEY, data.openrouter_key);
                }
                if (data?.gemini_key) {
                  setGeminiKey(data.gemini_key);
                  localStorage.setItem(STORAGE_KEYS.GEMINI_KEY, data.gemini_key);
                }
              })
              .catch(() => {});

            refreshPreferences(parsedUser.id);
          } else {
            throw new Error("Invalid user payload");
          }
        } catch {
          // Bad user JSON in localStorage
          localStorage.removeItem(STORAGE_KEYS.USER);
          localStorage.removeItem(STORAGE_KEYS.TOKEN);
          if (typeof document !== "undefined") {
            document.cookie = "draythos_auth=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
            document.cookie = "draythos_token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
          }
          setAuthState({
            isAuthenticated: false,
            user: null,
            token: null,
            apiKey: null,
          });
        }
      } else {
        // Not authenticated: purge any orphan auth cookies so middleware doesn't redirect loop
        if (typeof document !== "undefined") {
          document.cookie = "draythos_auth=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
          document.cookie = "draythos_token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
        }
        setAuthState({
          isAuthenticated: false,
          user: null,
          token: null,
          apiKey: null,
        });
      }

      if (savedOrKey) setOpenRouterKey(savedOrKey);
      if (savedGemKey) setGeminiKey(savedGemKey);
    } catch {
      setAuthState({
        isAuthenticated: false,
        user: null,
        token: null,
        apiKey: null,
      });
    } finally {
      setIsLoading(false);
    }
  }, [refreshPreferences]);

  const login = useCallback(async (email: string, password?: string) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 403 && data.error === "email_not_verified") {
          return {
            verification_required: true,
            email: data.email || email,
            code: data.code,
          };
        }
        throw new Error(data.error || data.detail || "Authentication failed. Check your email and password.");
      }

      const user: AuthUser = {
        id: data.id || "usr_" + Date.now(),
        name: data.name || email.split("@")[0].charAt(0).toUpperCase() + email.split("@")[0].slice(1),
        email: data.email || email,
        role: data.role || "Analyst",
        custom_instructions: data.custom_instructions || "",
        selected_model: data.selected_model || "gemini-3.8-flash",
        preferred_provider: data.preferred_provider || "gemini",
      };
      const token = data.token || "dyt_" + Date.now();

      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      localStorage.setItem(STORAGE_KEYS.TOKEN, token);
      if (user.custom_instructions) {
        localStorage.setItem(STORAGE_KEYS.CUSTOM_INSTRUCTIONS, user.custom_instructions);
        setCustomInstructions(user.custom_instructions);
      }
      if (user.selected_model) {
        localStorage.setItem(STORAGE_KEYS.SELECTED_MODEL, user.selected_model);
        setSelectedModel(user.selected_model);
      }
      if (user.preferred_provider) {
        localStorage.setItem(STORAGE_KEYS.PREFERRED_PROVIDER, user.preferred_provider);
        setPreferredProvider(user.preferred_provider);
      }

      document.cookie = `draythos_auth=${encodeURIComponent(JSON.stringify(user))}; path=/; max-age=604800; SameSite=Lax`;
      document.cookie = `draythos_token=${encodeURIComponent(token)}; path=/; max-age=604800; SameSite=Lax`;

      setAuthState({
        isAuthenticated: true,
        user,
        token,
        apiKey: null,
      });

      refreshPreferences(user.id);
      return user;
    } finally {
      setIsLoading(false);
    }
  }, [refreshPreferences]);

  const register = useCallback(async (email: string, password: string, name?: string) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || data.detail || "Registration failed.");
      }

      return {
        verification_required: true,
        email: data.email || email,
        name: data.name || name,
        code: data.code,
        message: data.message,
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const verifyEmailCode = useCallback(async (email: string, code: string) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || data.detail || "Invalid verification code.");
      }

      const user: AuthUser = {
        id: data.id || "usr_" + Date.now(),
        name: data.name || email.split("@")[0],
        email: data.email || email,
        role: data.role || "Analyst",
        custom_instructions: data.custom_instructions || "",
        selected_model: data.selected_model || "gemini-3.8-flash",
        preferred_provider: data.preferred_provider || "gemini",
      };
      const token = data.token || "dyt_" + Date.now();

      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      localStorage.setItem(STORAGE_KEYS.TOKEN, token);
      document.cookie = `draythos_auth=${encodeURIComponent(JSON.stringify(user))}; path=/; max-age=604800; SameSite=Lax`;
      document.cookie = `draythos_token=${encodeURIComponent(token)}; path=/; max-age=604800; SameSite=Lax`;

      setAuthState({
        isAuthenticated: true,
        user,
        token,
        apiKey: null,
      });

      refreshPreferences(user.id);
      return user;
    } finally {
      setIsLoading(false);
    }
  }, [refreshPreferences]);

  const resendVerificationCode = useCallback(async (email: string) => {
    const res = await fetch("/api/auth/resend-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.detail || "Failed to resend code.");
    return data;
  }, []);

  const updatePreferences = useCallback(
    async (prefs: {
      customInstructions?: string;
      selectedModel?: string;
      preferredProvider?: string;
    }) => {
      const currentUserId = authState.user?.id || "usr_default";

      if (prefs.customInstructions !== undefined) {
        setCustomInstructions(prefs.customInstructions);
        localStorage.setItem(STORAGE_KEYS.CUSTOM_INSTRUCTIONS, prefs.customInstructions);
      }
      if (prefs.selectedModel !== undefined) {
        setSelectedModel(prefs.selectedModel);
        localStorage.setItem(STORAGE_KEYS.SELECTED_MODEL, prefs.selectedModel);
      }
      if (prefs.preferredProvider !== undefined) {
        setPreferredProvider(prefs.preferredProvider);
        localStorage.setItem(STORAGE_KEYS.PREFERRED_PROVIDER, prefs.preferredProvider);
      }

      try {
        await fetch("/api/user/preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: currentUserId,
            custom_instructions: prefs.customInstructions ?? customInstructions,
            selected_model: prefs.selectedModel ?? selectedModel,
            preferred_provider: prefs.preferredProvider ?? preferredProvider,
          }),
        });
      } catch (err) {
        console.warn("Failed to persist preferences:", err);
      }
    },
    [authState.user?.id, customInstructions, selectedModel, preferredProvider]
  );

  const addMemory = useCallback(
    async (fact: string, category: string = "general") => {
      const currentUserId = authState.user?.id || "usr_default";
      try {
        const res = await fetch("/api/user/memories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: currentUserId, fact, category }),
        });
        if (res.ok) {
          const mem = await res.json();
          setMemories((prev) => [mem, ...prev]);
        }
      } catch (err) {
        console.warn("Failed to add memory:", err);
      }
    },
    [authState.user?.id]
  );

  const deleteMemory = useCallback(
    async (memoryId: string) => {
      const currentUserId = authState.user?.id || "usr_default";
      try {
        await fetch(`/api/user/memories?id=${encodeURIComponent(memoryId)}&user_id=${encodeURIComponent(currentUserId)}`, {
          method: "DELETE",
        });
        setMemories((prev) => prev.filter((m) => m.id !== memoryId));
      } catch (err) {
        console.warn("Failed to delete memory:", err);
      }
    },
    [authState.user?.id]
  );

  const logout = useCallback(async () => {
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.OPENROUTER_KEY);
    localStorage.removeItem(STORAGE_KEYS.GEMINI_KEY);
    document.cookie = "draythos_auth=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    document.cookie = "draythos_token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    setAuthState({
      isAuthenticated: false,
      user: null,
      token: null,
      apiKey: null,
    });
    if (typeof window !== "undefined") {
      window.location.href = "/api/auth/logout";
    }
  }, []);

  const updateApiKeys = useCallback(
    async (keys: { openRouter?: string; gemini?: string }) => {
      const currentUserId = authState.user?.id || "usr_default";

      if (keys.openRouter !== undefined) {
        localStorage.setItem(STORAGE_KEYS.OPENROUTER_KEY, keys.openRouter);
        setOpenRouterKey(keys.openRouter);
      }
      if (keys.gemini !== undefined) {
        localStorage.setItem(STORAGE_KEYS.GEMINI_KEY, keys.gemini);
        setGeminiKey(keys.gemini);
      }

      // Persist to backend database
      try {
        await fetch("/api/user/keys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: currentUserId,
            openrouter_key: keys.openRouter ?? openRouterKey,
            gemini_key: keys.gemini ?? geminiKey,
          }),
        });
      } catch (err) {
        console.warn("Failed to persist keys to database:", err);
      }
    },
    [authState.user?.id, openRouterKey, geminiKey]
  );

  return {
    ...authState,
    openRouterKey,
    geminiKey,
    customInstructions,
    selectedModel,
    preferredProvider,
    memories,
    isLoading,
    login,
    register,
    verifyEmailCode,
    resendVerificationCode,
    updatePreferences,
    addMemory,
    deleteMemory,
    logout,
    updateApiKeys,
  };
}
