import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

export interface UserData {
  userName: string;
  role: "pregnant" | "supporting";
  phone: string;
  dueDate: string | null;
  dueDateType: "exact" | "approximate" | "unknown";
  pregnancyName: string;
  currentWeek: number;
}

export interface OnboardingData {
  userName?: string;
  role?: "pregnant" | "supporting";
  phone?: string;
  dueDate?: string | null;
  dueDateType?: "exact" | "approximate" | "unknown";
  pregnancyName?: string;
}

interface AppContextType {
  isLoading: boolean;
  isOnboardingComplete: boolean;
  userData: UserData | null;
  onboardingData: OnboardingData;
  setOnboardingField: <K extends keyof OnboardingData>(
    key: K,
    value: OnboardingData[K]
  ) => void;
  completeOnboarding: () => Promise<void>;
  resetApp: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

const STORAGE_KEY = "nest_app_data_v1";

function getMonthYear(dueDate: string | null): string {
  if (!dueDate) {
    const d = new Date();
    d.setMonth(d.getMonth() + 5);
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }
  return new Date(dueDate).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function calculateWeek(
  dueDate: string | null,
  dueDateType?: string
): number {
  if (!dueDate || dueDateType === "unknown") return 18;
  const due = new Date(dueDate);
  const now = new Date();
  const msLeft = due.getTime() - now.getTime();
  const daysLeft = Math.floor(msLeft / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.min(42, 40 - Math.round(daysLeft / 7)));
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [onboardingData, setOnboardingDataState] = useState<OnboardingData>({});

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored) {
          const parsed: UserData = JSON.parse(stored);
          setUserData(parsed);
          setIsOnboardingComplete(true);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  function setOnboardingField<K extends keyof OnboardingData>(
    key: K,
    value: OnboardingData[K]
  ) {
    setOnboardingDataState((prev) => ({ ...prev, [key]: value }));
  }

  async function completeOnboarding() {
    const dueDate = onboardingData.dueDate ?? null;
    const dueDateType = onboardingData.dueDateType ?? "unknown";
    const week = calculateWeek(dueDate, dueDateType);
    const finalData: UserData = {
      userName: onboardingData.userName ?? "Friend",
      role: onboardingData.role ?? "pregnant",
      phone: onboardingData.phone ?? "",
      dueDate,
      dueDateType,
      pregnancyName:
        onboardingData.pregnancyName?.trim() ||
        `Baby due ${getMonthYear(dueDate)}`,
      currentWeek: week,
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(finalData));
    setUserData(finalData);
    setIsOnboardingComplete(true);
  }

  async function resetApp() {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setUserData(null);
    setOnboardingDataState({});
    setIsOnboardingComplete(false);
  }

  return (
    <AppContext.Provider
      value={{
        isLoading,
        isOnboardingComplete,
        userData,
        onboardingData,
        setOnboardingField,
        completeOnboarding,
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
