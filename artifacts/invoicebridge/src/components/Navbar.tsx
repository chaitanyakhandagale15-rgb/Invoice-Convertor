import { Link, useRoute } from "wouter";
import { Show, useClerk, useUser } from "@clerk/react";
import { FileText, LayoutDashboard, Upload, Menu, X, LogOut, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { signOut } = useClerk();
  const { user } = useUser();
  const menuRef = useRef<HTMLDivElement>(null);

  const [atHome] = useRoute("/");
  const [atUpload] = useRoute("/upload");
  const [atDashboard] = useRoute("/dashboard");

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const authedLinks = [
    { href: "/upload", label: "Upload", icon: Upload, active: atUpload },
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, active: atDashboard },
  ];

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg gradient-text">InvoiceBridge</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {/* Signed-in: show nav links */}
            <Show when="signed-in">
              {authedLinks.map(({ href, label, icon: Icon, active }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              ))}

              {/* User avatar dropdown */}
              <div className="relative ml-2" ref={menuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  {user?.imageUrl ? (
                    <img src={user.imageUrl} alt={user.fullName ?? "User"} className="w-6 h-6 rounded-full object-cover" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                      {(user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0] ?? "U").toUpperCase()}
                    </div>
                  )}
                  <span className="max-w-[120px] truncate">{user?.firstName ?? user?.emailAddresses?.[0]?.emailAddress}</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-border rounded-xl shadow-lg py-1.5 z-50">
                    <div className="px-3 py-2 border-b border-border mb-1">
                      <p className="text-xs font-medium text-foreground truncate">
                        {user?.fullName || user?.firstName || "Your Account"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user?.emailAddresses?.[0]?.emailAddress}
                      </p>
                    </div>
                    <button
                      onClick={() => signOut({ redirectUrl: basePath || "/" })}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </Show>

            {/* Signed-out: show sign in / get started */}
            <Show when="signed-out">
              <Link href="/sign-in">
                <Button variant="ghost" size="sm" className="text-sm">Sign In</Button>
              </Link>
              <Link href="/sign-up">
                <Button size="sm" className="text-sm gap-1">Get Started</Button>
              </Link>
            </Show>
          </nav>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-muted"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-white/95 px-4 py-3 space-y-1">
          <Show when="signed-in">
            {authedLinks.map(({ href, label, icon: Icon, active }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
            <button
              onClick={() => signOut({ redirectUrl: basePath || "/" })}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </Show>

          <Show when="signed-out">
            <Link href="/sign-in" onClick={() => setMobileOpen(false)}>
              <Button variant="ghost" className="w-full justify-start text-sm">Sign In</Button>
            </Link>
            <Link href="/sign-up" onClick={() => setMobileOpen(false)}>
              <Button className="w-full text-sm">Get Started</Button>
            </Link>
          </Show>
        </div>
      )}
    </header>
  );
}
