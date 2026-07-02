import { useState, useEffect } from "react";
import { useAuth, authFetch } from "@/context/auth-context";

interface AppVersion {
  id: string;
  version: string;
  title: string;
  description: string;
  releasedAt: string;
  createdAt: string;
  createdBy: string;
}

export function useAppVersion() {
  const { token } = useAuth();
  const [currentVersion, setCurrentVersion] = useState<AppVersion | null>(null);

  useEffect(() => {
    if (!token) return;
    authFetch("/versions/current", token)
      .then((data: { version: AppVersion | null }) => {
        setCurrentVersion(data.version);
      })
      .catch(() => { /* ignore */ });
  }, [token]);

  return { currentVersion };
}
