import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  SignedIn, SignedOut, SignInButton, SignUpButton, UserButton,
} from "@clerk/clerk-react";
import { Menu, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetClose,
} from "@/components/ui/sheet";
import { useNavigationGuard } from "../context/NavigationGuardContext";

/**
 * GuardedLink — renders like a normal Link but checks the navigation guard
 * before navigating. If a guard is active, shows a confirm() dialog.
 */
function GuardedLink({ to, children, className, style, onClick }) {
  const { requestNavigation } = useNavigationGuard();

  const handleClick = (e) => {
    e.preventDefault();
    if (onClick) onClick();
    requestNavigation(to);
  };

  return (
    <a href={to} onClick={handleClick} className={className} style={style}>
      {children}
    </a>
  );
}

export default function Header() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");

  return (
    <div
      style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(246,247,251,0.75)", backdropFilter: "blur(10px)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 68 }}>
        <GuardedLink to={isAdminRoute ? "/admin" : "/"} style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none", color: "var(--text)" }}>
          <span style={{ width: 32, height: 32, borderRadius: 9, background: isAdminRoute ? "#3b82f6" : "var(--gradient-brand)", boxShadow: "var(--shadow-glow)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 15 }}>
            V
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em" }}>Verity</span>
            {isAdminRoute && (
              <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[10px] font-black tracking-widest uppercase border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300 shadow-sm">
                Admin
              </Badge>
            )}
          </div>
        </GuardedLink>

        {/* Desktop nav */}
        <div className="hidden items-center gap-3 md:flex">
          <SignedIn>
            {isAdminRoute ? (
              <Button variant="outline" className="gap-2 text-[13px] font-bold border-indigo-200 bg-indigo-50/50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 dark:border-indigo-800/60 dark:bg-indigo-950/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50 shadow-sm rounded-full px-4" asChild>
                <GuardedLink to="/admin"><ShieldCheck size={16} className="text-indigo-600 dark:text-indigo-400" /> Admin Dashboard</GuardedLink>
              </Button>
            ) : (
              <>
                <Button variant="brand" asChild><GuardedLink to="/get-started">Get started</GuardedLink></Button>
                <Button variant="brandSecondary" asChild><GuardedLink to="/dashboard">Dashboard</GuardedLink></Button>
              </>
            )}
            <UserButton afterSignOutUrl="/" />
          </SignedIn>

          <SignedOut>
            <SignInButton mode="modal"><Button variant="brandSecondary">Sign in</Button></SignInButton>
            <SignUpButton mode="modal"><Button variant="brand">Get started</Button></SignUpButton>
          </SignedOut>
        </div>

        {/* Mobile nav */}
        <div className="flex items-center gap-3 md:hidden">
          <SignedIn><UserButton afterSignOutUrl="/" /></SignedIn>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu"><Menu size={20} /></Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader><SheetTitle>Menu</SheetTitle></SheetHeader>
              <div className="mt-6 flex flex-col gap-3">
                <SignedIn>
                  {isAdminRoute ? (
                    <SheetClose asChild>
                      <Button variant="brandSecondary" className="w-full gap-1.5" asChild>
                        <GuardedLink to="/admin"><ShieldCheck size={14} /> Admin Dashboard</GuardedLink>
                      </Button>
                    </SheetClose>
                  ) : (
                    <>
                      <SheetClose asChild><Button variant="brand" className="w-full" asChild><GuardedLink to="/get-started">Get started</GuardedLink></Button></SheetClose>
                      <SheetClose asChild><Button variant="brandSecondary" className="w-full" asChild><GuardedLink to="/dashboard">Dashboard</GuardedLink></Button></SheetClose>
                    </>
                  )}
                </SignedIn>
                <SignedOut>
                  <SignInButton mode="modal"><Button variant="brandSecondary" className="w-full">Sign in</Button></SignInButton>
                  <SignUpButton mode="modal"><Button variant="brand" className="w-full">Get started</Button></SignUpButton>
                </SignedOut>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </div>
  );
}

