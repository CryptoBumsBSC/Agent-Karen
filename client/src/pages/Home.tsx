import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, Zap, Heart } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col font-body">
      <Navigation />
      
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative pt-20 pb-32 overflow-hidden">
          <div className="absolute inset-0 z-0 opacity-10 pointer-events-none">
            <div className="absolute top-20 left-10 w-64 h-64 bg-primary rounded-full blur-3xl" />
            <div className="absolute bottom-20 right-10 w-64 h-64 bg-secondary rounded-full blur-3xl" />
          </div>

          <div className="container max-w-6xl mx-auto px-4 relative z-10 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="inline-block mb-6 px-4 py-1.5 rounded-full bg-secondary/10 text-secondary font-bold text-sm tracking-wide border border-secondary/20"
            >
              🌿 Welcome to the Universe
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-display text-6xl md:text-8xl font-bold text-gray-900 mb-8 leading-tight"
            >
              Dudley <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-green-400">Bud</span>
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-xl md:text-2xl text-gray-600 mb-10 max-w-2xl mx-auto"
            >
              The craziest Web3 cannabis character universe on Base. 
              Collect, learn, and vibe with the community.
            </motion.p>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Link href="/characters" className="btn-primary group">
                Meet the Crew <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link href="/fun-zone" className="btn-secondary">
                Enter Fun Zone
              </Link>
            </motion.div>
          </div>
        </section>

        {/* Features / Info Section */}
        <section className="py-20 bg-white">
          <div className="container max-w-6xl mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-tr from-green-100 to-blue-100 rounded-[2rem] transform rotate-3" />
                <div className="relative bg-white border border-gray-100 rounded-[2rem] p-8 shadow-xl">
                  <h3 className="font-display text-3xl font-bold mb-6">What We Are</h3>
                  <ul className="space-y-4">
                    {[
                      { icon: Zap, text: "A vibrant community on Base" },
                      { icon: Heart, text: "Characters with real personality" },
                      { icon: ShieldCheck, text: "Focused on safety & education" }
                    ].map((item, i) => (
                      <li key={i} className="flex items-center gap-4 text-lg text-gray-700">
                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-primary">
                          <item.icon className="w-5 h-5" />
                        </div>
                        {item.text}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              
              <div>
                <h2 className="font-display text-4xl md:text-5xl font-bold mb-6 text-gray-900">
                  Not just another meme coin.
                </h2>
                <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                  Dudley Bud is about building a universe where creativity meets crypto culture. We're here to educate newcomers, share laughs, and create a safe space in the wild west of Web3.
                </p>
                <div className="p-6 bg-red-50 rounded-2xl border border-red-100">
                  <h4 className="font-bold text-red-600 mb-2">What We Are NOT:</h4>
                  <p className="text-red-700/80">
                    We are NOT financial advisors. We do NOT promise returns. This is an art and community project for entertainment purposes only.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20">
          <div className="container max-w-4xl mx-auto px-4 text-center">
            <div className="bg-gradient-to-br from-primary to-green-700 rounded-3xl p-12 text-white shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
              
              <h2 className="font-display text-4xl font-bold mb-6 relative z-10">Join the Community</h2>
              <p className="text-green-100 text-xl mb-8 max-w-xl mx-auto relative z-10">
                Follow us on X and join our Telegram to stay updated on drops, lore, and community events.
              </p>
              
              <div className="flex flex-wrap justify-center gap-4 relative z-10">
                <a href="#" className="bg-white text-primary px-8 py-3 rounded-full font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all">
                  Follow on X
                </a>
                <a href="#" className="bg-secondary text-white px-8 py-3 rounded-full font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all">
                  Join Telegram
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
