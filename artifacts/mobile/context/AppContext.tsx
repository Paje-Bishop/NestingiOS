import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export interface OnboardingData {
  userName?: string;
  role?: "pregnant" | "supporting";
  phone?: string;
  dueDate?: string | null;
  dueDateType?: "exact" | "approximate" | "unknown";
  pregnancyName?: string;
  /** Set during the join flow — carries the invite code through onboarding screens */
  inviteCode?: string;
}

interface AuthSession {
  authToken: string;
  personId: number;
}

interface AppContextType {
  isLoading: boolean;
  isOnboardingComplete: boolean;
  authToken: string | null;
  personId: number | null;
  currentPregnancyId: number | null;
  onboardingData: OnboardingData;
  setOnboardingField: <K extends keyof OnboardingData>(
    key: K,
    value: OnboardingData[K],
  ) => void;
  setAuthSession: (token: string, personId: number) => Promise<void>;
  setCurrentPregnancy: (pregnancyId: number) => Promise<void>;
  clearAuthSession: () => Promise<void>;
  resetApp: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

const KEYS = {
  authToken: "nest_auth_token",
  personId: "nest_person_id",
  pregnancyId: "nest_pregnancy_id",
} as const;

export function AppProvider({
  children,
  apiBaseUrl,
}: {
  children: React.ReactNode;
  apiBaseUrl: string;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [personId, setPersonId] = useState<number | null>(null);
  const [currentPregnancyId, setCurrentPregnancyId] = useState<number | null>(null);
  const [onboardingData, setOnboardingDataState] = useState<OnboardingData>({});

  useEffect(() => {
    setBaseUrl(apiBaseUrl);
    setAuthTokenGetter(async () => {
      const t = await AsyncStorage.getItem(KEYS.authToken);
      return t ?? null;
    });

    AsyncStorage.multiGet([KEYS.authToken, KEYS.personId, KEYS.pregnancyId])
      .then(([[, token], [, pid], [, pregId]]) => {
        if (token) setAuthToken(token);
        if (pid) setPersonId(parseInt(pid, 10));
        if (pregId) setCurrentPregnancyId(parseInt(pregId, 10));
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [apiBaseUrl]);

  const isOnboardingComplete =
    authToken !== null && currentPregnancyId !== null;

  function setOnboardingField<K extends keyof OnboardingData>(
    key: K,
    value: OnboardingData[K],
  ) {
    setOnboardingDataState((prev) => ({ ...prev, [key]: value }));
  }

  const setAuthSession = useCallback(async (token: string, pid: number) => {
    await AsyncStorage.multiSet([
      [KEYS.authToken, token],
      [KEYS.personId, pid.toString()],
    ]);
    setAuthToken(token);
    setPersonId(pid);
  }, []);

  const setCurrentPregnancy = useCallback(async (pregId: number) => {
    await AsyncStorage.setItem(KEYS.pregnancyId, pregId.toString());
    setCurrentPregnancyId(pregId);
  }, []);

  const clearAuthSession = useCallback(async () => {
    await AsyncStorage.multiRemove([KEYS.authToken, KEYS.personId]);
    setAuthToken(null);
    setPersonId(null);
  }, []);

  const resetApp = useCallback(async () => {
    await AsyncStorage.multiRemove([KEYS.authToken, KEYS.personId, KEYS.pregnancyId]);
    setAuthToken(null);
    setPersonId(null);
    setCurrentPregnancyId(null);
    setOnboardingDataState({});
  }, []);

  return (
    <AppContext.Provider
      value={{
        isLoading,
        isOnboardingComplete,
        authToken,
        personId,
        currentPregnancyId,
        onboardingData,
        setOnboardingField,
        setAuthSession,
        setCurrentPregnancy,
        clearAuthSession,
        resetApp,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
