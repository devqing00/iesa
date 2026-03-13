"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
} from "react";
import { useAuth } from "./AuthContext";
import { getApiUrl } from "@/lib/api";

interface PermissionsContextType {
  permissions: string[];
  loaded: boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  loading: boolean;
  refetch: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType>({
  permissions: [],
  loaded: false,
  hasPermission: () => false,
  hasAnyPermission: () => false,
  hasAllPermissions: () => false,
  loading: true,
  refetch: async () => {},
});

export const usePermissions = () => useContext(PermissionsContext);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user, userProfile, getAccessToken } = useAuth();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);

  const fetchPermissions = useCallback(async () => {
    // Always gate with loading=true while fetching to prevent race conditions
    // (e.g., withAuth seeing stale empty permissions during account switch)
    setLoading(true);

    if (!user || !userProfile) {
      setPermissions([]);
      setLoading(false);
      setLoaded(false);
      return;
    }

    try {
      const token = await getAccessToken();
      if (!token) {
        setPermissions([]);
        setLoading(false);
        setLoaded(false);
        return;
      }

      // Fetch user's permissions from backend
      const response = await fetch(getApiUrl("/api/v1/users/me/permissions"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const perms = data.permissions || [];
        // Trust the backend — it uses get_user_permissions() which checks
        // actual role assignments. super_admin gets all perms at the DB level,
        // regular admin/exco get only their position's defaults + overrides.
        setPermissions(perms);
      } else {
        // Backend failed to respond — give no permissions.
        // The user can retry by refreshing.  Never grant a wildcard as fallback.
        setPermissions([]);
      }
    } catch {
      setPermissions([]);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [user, userProfile, getAccessToken]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  useEffect(() => {
    if (!user || !userProfile || loaded || loading) return;

    const retryTimer = setTimeout(() => {
      fetchPermissions();
    }, 300);

    return () => clearTimeout(retryTimer);
  }, [user, userProfile, loaded, loading, fetchPermissions]);

  // Stabilize permission check functions to prevent unnecessary re-renders
  const hasPermission = useCallback((permission: string): boolean => {
    return permissions.includes(permission);
  }, [permissions]);

  const hasAnyPermission = useCallback((perms: string[]): boolean => {
    return perms.some((p) => permissions.includes(p));
  }, [permissions]);

  const hasAllPermissions = useCallback((perms: string[]): boolean => {
    return perms.every((p) => permissions.includes(p));
  }, [permissions]);

  const contextValue = useMemo(
    () => ({
      permissions,
      loaded,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      loading,
      refetch: fetchPermissions,
    }),
    [permissions, loaded, hasPermission, hasAnyPermission, hasAllPermissions, loading, fetchPermissions]
  );

  return (
    <PermissionsContext.Provider value={contextValue}>
      {children}
    </PermissionsContext.Provider>
  );
}
