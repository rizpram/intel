import IntelligenceApp from "@/components/intelligence-app";
import LiveWorkspace from "@/components/live-workspace";
export const dynamic="force-dynamic";
export default function Home(){return process.env.DEMO_MODE==="true"?<IntelligenceApp/>:<LiveWorkspace/>;}
