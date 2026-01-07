import { motion } from "framer-motion";
import type { Character } from "@shared/schema";
import { User } from "lucide-react";

export function CharacterCard({ character, index }: { character: Character; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="group relative bg-white rounded-3xl p-4 shadow-lg border-2 border-transparent hover:border-primary/20 transition-all duration-300 hover:-translate-y-2 hover:shadow-xl"
    >
      <div className="aspect-square rounded-2xl bg-gradient-to-br from-green-50 to-blue-50 mb-4 overflow-hidden relative">
        {character.imageUrl ? (
          <img 
            src={character.imageUrl} 
            alt={character.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-primary/20">
            <User size={64} />
          </div>
        )}
        <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-primary shadow-sm">
          {character.role}
        </div>
      </div>
      
      <h3 className="font-display text-xl font-bold text-gray-900 mb-2">{character.name}</h3>
      <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">
        {character.description}
      </p>
    </motion.div>
  );
}
