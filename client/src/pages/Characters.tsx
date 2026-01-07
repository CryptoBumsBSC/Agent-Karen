import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { CharacterCard } from "@/components/CharacterCard";
import { useCharacters } from "@/hooks/use-characters";
import { motion } from "framer-motion";
import { Search, Loader2 } from "lucide-react";
import { useState } from "react";

export default function Characters() {
  const { data: characters, isLoading, error } = useCharacters();
  const [search, setSearch] = useState("");

  const filteredCharacters = characters?.filter(char => 
    char.name.toLowerCase().includes(search.toLowerCase()) || 
    char.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col font-body bg-slate-50">
      <Navigation />
      
      <main className="flex-grow container max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-16">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display text-5xl font-bold mb-4 text-gray-900"
          >
            Meet the Crew
          </motion.h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            The personalities that make the Dudley Bud universe go 'round.
          </p>
        </div>

        {/* Search Bar */}
        <div className="max-w-md mx-auto mb-12 relative">
          <input 
            type="text" 
            placeholder="Search characters..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-4 rounded-full border-2 border-transparent bg-white shadow-lg focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-lg"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <h3 className="text-xl font-bold text-red-500">Failed to load crew members.</h3>
            <p className="text-gray-500 mt-2">Maybe they're on a break. Try again later.</p>
          </div>
        ) : filteredCharacters?.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-xl text-gray-500">No characters found matching "{search}"</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredCharacters?.map((char, i) => (
              <CharacterCard key={char.id} character={char} index={i} />
            ))}
          </div>
        )}
      </main>
      
      <Footer />
    </div>
  );
}
