import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { useContent } from "@/hooks/use-content";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Brain, RefreshCcw, Loader2 } from "lucide-react";
import { useState } from "react";

export default function FunZone() {
  const { data: jokes, isLoading: jokesLoading } = useContent('joke');
  const { data: facts, isLoading: factsLoading } = useContent('fact');
  
  const [currentJokeIndex, setCurrentJokeIndex] = useState(0);
  const [currentFactIndex, setCurrentFactIndex] = useState(0);

  const nextJoke = () => {
    if (jokes) setCurrentJokeIndex((prev) => (prev + 1) % jokes.length);
  };

  const nextFact = () => {
    if (facts) setCurrentFactIndex((prev) => (prev + 1) % facts.length);
  };

  return (
    <div className="min-h-screen flex flex-col font-body bg-gradient-to-b from-green-50 to-white">
      <Navigation />
      
      <main className="flex-grow container max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-16">
          <motion.h1 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="font-display text-6xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-500"
          >
            The Fun Zone
          </motion.h1>
          <p className="text-xl text-gray-600">
            Vibe out, learn something, or just have a laugh.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
          {/* Joke Section */}
          <section className="flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-yellow-100 rounded-2xl flex items-center justify-center text-yellow-600 transform -rotate-6">
                <Sparkles />
              </div>
              <h2 className="font-display text-3xl font-bold text-gray-800">Daily Giggles</h2>
            </div>
            
            <div className="flex-grow bg-white rounded-3xl p-8 shadow-xl border-b-8 border-yellow-200 relative min-h-[300px] flex flex-col justify-between">
              {jokesLoading ? (
                <div className="flex-grow flex items-center justify-center">
                  <Loader2 className="animate-spin text-yellow-400 w-10 h-10" />
                </div>
              ) : jokes && jokes.length > 0 ? (
                <>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentJokeIndex}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="flex-grow flex items-center justify-center"
                    >
                      <div className="text-center">
                        <p className="text-2xl font-bold text-gray-800 mb-6 leading-relaxed">
                          "{jokes[currentJokeIndex].content}"
                        </p>
                        {jokes[currentJokeIndex].title && (
                          <span className="text-sm text-gray-400 font-mono">- {jokes[currentJokeIndex].title}</span>
                        )}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                  
                  <button 
                    onClick={nextJoke}
                    className="mt-8 w-full py-4 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 group"
                  >
                    <RefreshCcw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
                    Another One
                  </button>
                </>
              ) : (
                <div className="flex-grow flex items-center justify-center text-gray-400">
                  No jokes found. Tough crowd.
                </div>
              )}
            </div>
          </section>

          {/* Fact Section */}
          <section className="flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 transform rotate-6">
                <Brain />
              </div>
              <h2 className="font-display text-3xl font-bold text-gray-800">Knowledge Drops</h2>
            </div>
            
            <div className="flex-grow bg-white rounded-3xl p-8 shadow-xl border-b-8 border-blue-200 relative min-h-[300px] flex flex-col justify-between">
              {factsLoading ? (
                <div className="flex-grow flex items-center justify-center">
                  <Loader2 className="animate-spin text-blue-400 w-10 h-10" />
                </div>
              ) : facts && facts.length > 0 ? (
                <>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentFactIndex}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.05 }}
                      className="flex-grow"
                    >
                      <span className="inline-block bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-bold mb-4 uppercase tracking-wider">
                        Did you know?
                      </span>
                      <h3 className="text-xl font-bold text-gray-900 mb-4">
                        {facts[currentFactIndex].title || "Fact #" + (currentFactIndex + 1)}
                      </h3>
                      <p className="text-lg text-gray-600 leading-relaxed">
                        {facts[currentFactIndex].content}
                      </p>
                    </motion.div>
                  </AnimatePresence>

                  <button 
                    onClick={nextFact}
                    className="mt-8 w-full py-4 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    Next Fact <ArrowRightSmall />
                  </button>
                </>
              ) : (
                <div className="flex-grow flex items-center justify-center text-gray-400">
                  No facts found yet.
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}

function ArrowRightSmall() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}
