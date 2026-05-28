import { Link, useRoute } from "wouter";
import { Show, useClerk, useUser } from "@clerk/react";
import { FileText, LayoutDashboard, Upload, Menu, X, LogOut, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { signOut } = useClerk();
  const { user } = useUser();
  const menuRef = useRef<HTMLDivElement>(null);

  const [atHome] = useRoute("/");
  const [atUpload] = useRoute("/upload");
  const [atDashboard] = useRoute("/dashboard");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-300",
        scrolled
          ? "backdrop-blur-xl bg-white/90 border-b border-border/60 shadow-sm shadow-black/[0.04]"
          : "backdrop-blur-md bg-white/80 border-b border-border/40"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm group-hover:shadow-blue-200 group-hover:scale-105 transition-all">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-[17px] bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              InvoiceBridge
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5">
            <Show when="signed-in">
              {authedLinks.map(({ href, label, icon: Icon, active }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors",
                    active
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                  {active && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute inset-0 rounded-lg bg-primary/8 border border-primary/15"
                      transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    />
                  )}
                </Link>
              ))}

              {/* User dropdown */}
              <div className="relative ml-2" ref={menuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className={cn(
                    "flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl text-sm font-medium transition-all",
                    "border border-border/60 hover:border-border bg-white/70 hover:bg-white hover:shadow-sm"
                  )}
                >
                  {user?.imageUrl ? (
                    <img src={user.imageUrl} alt="" className="w-6 h-6 rounded-full object-cover ring-2 ring-white" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-xs font-bold text-white">
                      {(user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0] ?? "U").toUpperCase()}
                    </div>
                  )}
                  <span className="max-w-[100px] truncate text-foreground">
                    {user?.firstName ?? user?.emailAddresses?.[0]?.emailAddress?.split("@")[0]}
                  </span>
                  <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", userMenuOpen && "rotate-180")} />
                </button>

                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.97 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      className="absolute right-0 top-full mt-1.5 w-56 bg-white border border-border rounded-2xl shadow-xl shadow-black/[0.08] py-1.5 z-50"
                    >
                      <div className="px-4 py-2.5 border-b border-border mb-1">
                        <p className="text-xs font-semibold text-foreground truncate">
                          {user?.fullName || user?.firstName || "Your Account"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {user?.emailAddresses?.[0]?.emailAddress}
                        </p>
                      </div>
                      <button
                        onClick={() => signOut({ redirectUrl: basePath || "/" })}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50/70 transition-colors rounded-b-xl"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Show>

            <Show when="signed-out">
              <Link href="/sign-in">
                <Button variant="ghost" size="sm" className="text-sm text-muted-foreground hover:text-foreground">
                  Sign In
                </Button>
              </Link>
              <Link href="/sign-up">
                <Button
                  size="sm"
                  className="text-sm gap-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-sm"
                >
                  Get Started
                </Button>
              </Link>
            </Show>
          </nav>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="md:hidden overflow-hidden border-t border-border bg-white/95 backdrop-blur-xl"
          >
            <div className="px-4 py-3 space-y-1">
              <Show when="signed-in">
                {authedLinks.map(({ href, label, icon: Icon, active }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                      active ? "bg-primary/8 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </Link>
                ))}
                <button
                  onClick={() => signOut({ redirectUrl: basePath || "/" })}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50"
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
                  <Button className="w-full text-sm bg-gradient-to-r from-blue-600 to-indigo-600">Get Started</Button>
                </Link>
              </Show>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
