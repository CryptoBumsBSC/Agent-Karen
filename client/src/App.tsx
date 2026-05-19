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
import AdminLogin from "@/pages/admin/Login";
import AdminBootstrap from "@/pages/admin/Bootstrap";
import AcceptInvite from "@/pages/admin/AcceptInvite";
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminTeam from "@/pages/admin/Team";
import CommunityDetail from "@/pages/admin/CommunityDetail";
import BotControls from "@/pages/admin/BotControls";
import BotReference from "@/pages/admin/BotReference";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/characters" component={Characters} />
      <Route path="/safety" component={Safety} />
      <Route path="/fun-zone" component={FunZone} />
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin/bootstrap" component={AdminBootstrap} />
      <Route path="/admin/accept-invite/:token" component={AcceptInvite} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/team" component={AdminTeam} />
      <Route path="/admin/bot" component={BotControls} />
      <Route path="/admin/reference" component={BotReference} />
      <Route path="/admin/community/:chatId" component={CommunityDetail} />
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
