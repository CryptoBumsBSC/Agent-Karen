import { useQuery } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { ContentType } from "@shared/schema";

export function useContent(type?: ContentType) {
  return useQuery({
    queryKey: [api.content.list.path, type],
    queryFn: async () => {
      const url = type 
        ? buildUrl(api.content.list.path) + `?type=${type}` 
        : api.content.list.path;
        
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch content");
      return api.content.list.responses[200].parse(await res.json());
    },
  });
}
