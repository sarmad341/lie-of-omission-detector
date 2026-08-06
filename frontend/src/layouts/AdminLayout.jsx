import { Outlet, NavLink } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { LayoutDashboard, List, FileKey, Shield } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLayout() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-6 flex flex-col gap-4">
          <Skeleton className="h-8 w-3/4 mb-4" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </aside>
        <main className="flex-1 p-8 space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-[400px] w-full rounded-xl" />
        </main>
      </div>
    );
  }
  if (!isSignedIn) {
    return <div className="p-8 text-red-500">Access Denied: You must be signed in.</div>;
  }

  const navItems = [
    { to: "/admin/dashboard", icon: LayoutDashboard, label: "Analytics Dashboard" },
    { to: "/admin/applications", icon: List, label: "Application Queue" },
    { to: "/admin/policy-rules", icon: FileKey, label: "Policy Rules" },
  ];

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-lg shadow-md shadow-indigo-500/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-[15px] font-bold tracking-tight text-gray-900 dark:text-white leading-none">Workspace</div>
              <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mt-1">Admin Portal</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
