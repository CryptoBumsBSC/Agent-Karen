import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Leaf, ShieldAlert, Sparkles, Home } from "lucide-react";

export function Navigation() {
  const [location] = useLocation();

  const links = [
    { href: "/", label: "Home", icon: Home },
    { href: "/characters", label: "Characters", icon: Leaf },
    { href: "/fun-zone", label: "Fun Zone", icon: Sparkles },
    { href: "/safety", label: "Safety", icon: ShieldAlert },
  ];

  return (
    <header className="sticky top-0 z-50 w-full px-4 py-4">
      <nav className="mx-auto max-w-5xl bg-white/90 backdrop-blur-xl border border-primary/20 rounded-full shadow-lg shadow-primary/5 px-2 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 pl-4">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-green-600 flex items-center justify-center text-white font-bold font-display">
            DB
          </div>
          <span className="font-display font-bold text-lg text-primary hidden sm:block">Dudley Bud</span>
        </div>

        <ul className="flex items-center gap-1">
          {links.map((link) => {
            const isActive = location === link.href;
            const Icon = link.icon;
            
            return (
              <li key={link.href}>
                <Link 
                  href={link.href}
                  className={`
                    relative px-4 py-2 rounded-full flex items-center gap-2 text-sm font-bold transition-all duration-200
                    ${isActive ? 'text-primary-foreground' : 'text-muted-foreground hover:text-primary hover:bg-primary/10'}
                  `}
                >
                  {isActive && (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute inset-0 bg-primary rounded-full"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    <span className="hidden md:inline">{link.label}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
