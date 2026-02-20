"use client";

import { useEffect, ComponentType } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionsContext";

interface WithAuthOptions {
  requiredPermission?: string;
  requiredPermissions?: string[]; // ALL permissions required
  anyPermission?: string[]; // ANY permission required
  allowedRoles?: string[];
  redirectTo?: string;
}

/**
 * Higher-Order Component for protecting routes with authentication and permissions.
 * 
 * Usage:
 * 
 * // Require authentication only
 * export default withAuth(MyComponent);
 * 
 * // Require specific permission
 * export default withAuth(MyComponent, { 
 *   requiredPermission: "announcement:create" 
 * });
 * 
 * // Require ANY of multiple permissions
 * export default withAuth(MyComponent, { 
 *   anyPermission: ["event:create", "event:edit"] 
 * });
 * 
 * // Require ALL permissions
 * export default withAuth(MyComponent, { 
 *   requiredPermissions: ["payment:approve", "payment:edit"] 
 * });
 * 
 * // Require role (legacy, prefer permissions)
 * export default withAuth(MyComponent, { 
 *   allowedRoles: ["admin", "exco"] 
 * });
 */
export function withAuth<P extends object>(
  Component: ComponentType<P>,
  options: WithAuthOptions = {}
) {
  return function AuthenticatedComponent(props: P) {
    const { user, userProfile, loading: authLoading } = useAuth();
    const { hasPermission, hasAnyPermission, hasAllPermissions, loading: permissionsLoading } = usePermissions();
    const router = useRouter();

    const {
      requiredPermission,
      requiredPermissions,
      anyPermission,
      allowedRoles,
      redirectTo = "/login",
    } = options;

    useEffect(() => {
      // Wait for auth and permissions to load
      if (authLoading || permissionsLoading) return;

      // Check authentication
      if (!user) {
        router.push(redirectTo);
        return;
      }

      // Determine correct dashboard based on user role
      const dashboardPath = userProfile?.role === "admin" || userProfile?.role === "exco"
        ? "/admin/dashboard"
        : "/dashboard";

      // Check role-based access (legacy)
      if (allowedRoles && userProfile && !allowedRoles.includes(userProfile.role)) {
        router.push(dashboardPath);
        return;
      }

      // Check single permission
      if (requiredPermission && !hasPermission(requiredPermission)) {
        router.push(dashboardPath);
        return;
      }

      // Check ANY permission
      if (anyPermission && !hasAnyPermission(anyPermission)) {
        router.push(dashboardPath);
        return;
      }

      // Check ALL permissions
      if (requiredPermissions && !hasAllPermissions(requiredPermissions)) {
        router.push(dashboardPath);
        return;
      }
    }, [
      user,
      userProfile,
      authLoading,
      permissionsLoading,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      router,
    ]);

    // Show loading state
    if (authLoading || permissionsLoading) {
      return (
        <div className="min-h-screen bg-ghost p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header skeleton */}
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-8 w-48 bg-cloud rounded-xl animate-pulse" />
                <div className="h-4 w-32 bg-cloud rounded animate-pulse" />
              </div>
              <div className="h-10 w-24 bg-cloud rounded-2xl animate-pulse" />
            </div>
            {/* Stat cards skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-snow border-[4px] border-cloud rounded-3xl p-6 space-y-3">
                  <div className="h-3 w-20 bg-cloud rounded animate-pulse" />
                  <div className="h-8 w-16 bg-cloud rounded animate-pulse" />
                </div>
              ))}
            </div>
            {/* Content skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="bg-snow border-[4px] border-cloud rounded-3xl p-6 space-y-4">
                  <div className="h-5 w-32 bg-cloud rounded animate-pulse" />
                  <div className="space-y-2">
                    <div className="h-4 w-full bg-cloud rounded animate-pulse" />
                    <div className="h-4 w-2/3 bg-cloud rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // Don't render if not authenticated/authorized
    if (!user) return null;

    if (allowedRoles && userProfile && !allowedRoles.includes(userProfile.role)) {
      return null;
    }

    if (requiredPermission && !hasPermission(requiredPermission)) {
      return null;
    }

    if (anyPermission && !hasAnyPermission(anyPermission)) {
      return null;
    }

    if (requiredPermissions && !hasAllPermissions(requiredPermissions)) {
      return null;
    }

    return <Component {...props} />;
  };
}

/**
 * Hook for checking permissions in components.
 * 
 * Usage:
 * const canCreate = usePermissionCheck("announcement:create");
 * if (canCreate) {
 *   return <CreateButton />;
 * }
 */
export function usePermissionCheck(permission: string): boolean {
  const { hasPermission } = usePermissions();
  return hasPermission(permission);
}

/**
 * Component for conditionally rendering based on permissions.
 * 
 * Usage:
 * <PermissionGate permission="announcement:create">
 *   <CreateAnnouncementButton />
 * </PermissionGate>
 */
interface PermissionGateProps {
  permission?: string;
  anyPermission?: string[];
  allPermissions?: string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGate({
  permission,
  anyPermission,
  allPermissions,
  fallback = null,
  children,
}: PermissionGateProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

  let hasAccess = true;

  if (permission) {
    hasAccess = hasPermission(permission);
  } else if (anyPermission) {
    hasAccess = hasAnyPermission(anyPermission);
  } else if (allPermissions) {
    hasAccess = hasAllPermissions(allPermissions);
  }

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}
