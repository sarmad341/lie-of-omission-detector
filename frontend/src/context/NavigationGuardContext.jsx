import { createContext, useContext, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

/**
 * NavigationGuardContext
 *
 * Provides a global navigation guard with a custom shadcn UI dialog popup.
 * When a wizard has unsaved progress (isGuarded = true), any attempt to click
 * header navigation links, dashboard buttons, or logo will trigger the dialog.
 */

const NavigationGuardContext = createContext({
  isGuarded: false,
  setGuarded: () => {},
  requestNavigation: () => {},
});

export function NavigationGuardProvider({ children }) {
  const [isGuarded, setIsGuarded] = useState(false);
  const [pendingRoute, setPendingRoute] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();

  const setGuarded = useCallback((guarded) => {
    setIsGuarded(guarded);
  }, []);

  const requestNavigation = useCallback((toRoute) => {
    if (isGuarded) {
      setPendingRoute(toRoute);
      setShowModal(true);
      return false; // Navigation blocked
    }
    if (toRoute) {
      navigate(toRoute);
    }
    return true; // Navigation allowed
  }, [isGuarded, navigate]);

  const confirmQuit = () => {
    setShowModal(false);
    setIsGuarded(false);
    if (pendingRoute) {
      navigate(pendingRoute);
      setPendingRoute(null);
    }
  };

  const cancelQuit = () => {
    setShowModal(false);
    setPendingRoute(null);
  };

  return (
    <NavigationGuardContext.Provider value={{ isGuarded, setGuarded, requestNavigation }}>
      {children}

      <Dialog open={showModal} onOpenChange={(open) => !open && cancelQuit()}>
        <DialogContent className="max-w-md" style={{ padding: "24px" }}>
          <DialogHeader>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <AlertTriangle size={22} color="var(--destructive)" />
              </div>
              <DialogTitle style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                Unsaved Claim Progress
              </DialogTitle>
            </div>
            <DialogDescription style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.5, marginTop: 4 }}>
              You have an ongoing claim in progress that has not been saved yet. If you leave now, your entered details and evidence analysis will be lost.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter style={{ marginTop: 20, display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Button variant="brandSecondary" onClick={cancelQuit}>
              Stay on Page
            </Button>
            <Button variant="destructive" onClick={confirmQuit}>
              Yes, Leave Page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </NavigationGuardContext.Provider>
  );
}

export function useNavigationGuard() {
  return useContext(NavigationGuardContext);
}
