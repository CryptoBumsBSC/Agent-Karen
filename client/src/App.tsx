import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Characters from "@/pages/Characters";
import Safety from "@/pages/Safety";
import FunZone from "@/pages/FunZone";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/characters" component={Characters} />
      <Route path="/safety" component={Safety} />
      <Route path="/fun-zone" component={FunZone} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
