import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useCharacters() {
  return useQuery({
    queryKey: [api.characters.list.path],
    queryFn: async () => {
      const res = await fetch(api.characters.list.path);
      if (!res.ok) throw new Error("Failed to fetch characters");
      return api.characters.list.responses[200].parse(await res.json());
    },
  });
}
