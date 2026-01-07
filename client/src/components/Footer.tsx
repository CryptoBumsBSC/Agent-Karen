import { Twitter, Send } from "lucide-react";
import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="mt-20 bg-white border-t border-border">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <h3 className="font-display text-2xl font-bold text-primary mb-4">Dudley Bud</h3>
            <p className="text-muted-foreground max-w-sm mb-6">
              A Web3 cannabis character universe built on Base. Join the community, collect characters, and stay safe in the crypto space.
            </p>
            <div className="flex gap-4">
              <a href="#" className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
                <Twitter className="w-5 h-5 text-slate-600" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
                <Send className="w-5 h-5 text-slate-600" />
              </a>
            </div>
          </div>
          
          <div>
            <h4 className="font-bold text-foreground mb-4">Universe</h4>
            <ul className="space-y-2">
              <li><Link href="/characters" className="text-muted-foreground hover:text-primary">Characters</Link></li>
              <li><Link href="/fun-zone" className="text-muted-foreground hover:text-primary">Fun Zone</Link></li>
              <li><Link href="/safety" className="text-muted-foreground hover:text-primary">Safety Center</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-foreground mb-4">Legal</h4>
            <ul className="space-y-2">
              <li className="text-sm text-muted-foreground">Not financial advice</li>
              <li className="text-sm text-muted-foreground">For entertainment only</li>
              <li className="text-sm text-muted-foreground">© 2024 Dudley Bud</li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
