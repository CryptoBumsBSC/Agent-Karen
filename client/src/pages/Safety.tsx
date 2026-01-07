import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { useContent } from "@/hooks/use-content";
import { motion } from "framer-motion";
import { ShieldAlert, AlertTriangle, CheckCircle2, FileText, Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function Safety() {
  const { data: legalContent, isLoading: legalLoading } = useContent('legal');
  const { data: scamContent, isLoading: scamLoading } = useContent('scam_term');

  return (
    <div className="min-h-screen flex flex-col font-body bg-slate-50">
      <Navigation />
      
      <main className="flex-grow container max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-600">
            <ShieldAlert size={32} />
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4 text-gray-900">
            Safety & Legal Center
          </h1>
          <p className="text-xl text-gray-600">
            Stay safe in the wild west of Web3. Education is your best defense.
          </p>
        </div>

        <Tabs defaultValue="scam-alert" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8 h-auto p-1 bg-white rounded-full shadow-sm border border-slate-200">
            <TabsTrigger 
              value="scam-alert"
              className="rounded-full py-3 data-[state=active]:bg-primary data-[state=active]:text-white transition-all font-bold"
            >
              Scam Awareness
            </TabsTrigger>
            <TabsTrigger 
              value="legal"
              className="rounded-full py-3 data-[state=active]:bg-secondary data-[state=active]:text-white transition-all font-bold"
            >
              Legal Info
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scam-alert" className="space-y-6">
            <div className="bg-orange-50 border-l-4 border-orange-500 p-6 rounded-r-xl mb-8">
              <div className="flex gap-4">
                <AlertTriangle className="text-orange-500 shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold text-orange-800 text-lg mb-2">Warning Signs</h3>
                  <p className="text-orange-700">
                    If someone DMs you first offering help, it's 99.9% a scam. 
                    Never share your seed phrase. Admins will NEVER ask for your wallet keys.
                  </p>
                </div>
              </div>
            </div>

            <h3 className="font-display text-2xl font-bold mb-4 text-gray-800">Common Scam Terms</h3>
            
            {scamLoading ? (
              <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>
            ) : (
              <div className="grid gap-4">
                {scamContent?.map((item, i) => (
                  <motion.div 
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-bold text-lg text-primary">{item.title}</h4>
                      {item.category && (
                        <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-500 uppercase">
                          {item.category}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600">{item.content}</p>
                  </motion.div>
                ))}
                {(!scamContent || scamContent.length === 0) && (
                  <p className="text-center text-gray-500 py-8">No scam terms loaded yet.</p>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="legal" className="space-y-6">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-100">
                <FileText className="text-secondary" />
                <h3 className="font-display text-2xl font-bold">Important Disclaimers</h3>
              </div>

              {legalLoading ? (
                <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>
              ) : (
                <div className="space-y-6">
                  {legalContent?.map((item) => (
                    <div key={item.id} className="flex gap-4">
                      <CheckCircle2 className="text-green-500 shrink-0 w-6 h-6" />
                      <div>
                        <h4 className="font-bold text-gray-900 mb-1">{item.title || "Legal Note"}</h4>
                        <p className="text-gray-600 leading-relaxed">{item.content}</p>
                      </div>
                    </div>
                  ))}
                  {(!legalContent || legalContent.length === 0) && (
                    <p className="text-center text-gray-500 py-8">No legal info loaded yet.</p>
                  )}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
      
      <Footer />
    </div>
  );
}
