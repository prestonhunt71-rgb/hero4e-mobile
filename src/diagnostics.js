const entries=[];
const push=(level,message)=>{entries.push({time:new Date().toISOString(),level,message:String(message).slice(0,500)});if(entries.length>80)entries.shift();};
export function installDiagnostics4e(){
  addEventListener("error",event=>push("error",`${event.message} @ ${event.filename||"app"}:${event.lineno||0}`));
  addEventListener("unhandledrejection",event=>push("rejection",event.reason?.stack||event.reason||"Unhandled rejection"));
  push("info","Application session started");
}
export function logDiagnostic4e(message,level="info"){push(level,message);}
export async function issueReport4e({summary,steps,character,page,editMode}){
  const cacheKeys="caches" in globalThis?await caches.keys().catch(()=>[]):[];
  const lines=[`Summary: ${summary}`,`Steps / details: ${steps||"Not provided"}`,"",`Time: ${new Date().toISOString()}`,`Character: ${character?.name||"None"} (${character?.id||"no id"})`,`Page: ${page||"unknown"}`,`Mode: ${editMode?"edit":"play"}`,`Online: ${navigator.onLine}`,`Viewport: ${innerWidth}x${innerHeight}`,`Screen: ${screen.width}x${screen.height}`,`Language: ${navigator.language}`,`User agent: ${navigator.userAgent}`,`Service worker: ${navigator.serviceWorker?.controller?.scriptURL||"not controlling"}`,`Caches: ${cacheKeys.join(", ")||"none"}`,"","Recent app diagnostics:",...entries.slice(-40).map(entry=>`${entry.time} [${entry.level}] ${entry.message}`)];
  return lines.join("\n").slice(0,9000);
}
export function emailIssue4e(report){const subject=encodeURIComponent("HERO4E Mobile issue report"),body=encodeURIComponent(report);location.href=`mailto:prestonhunt@hotmail.com?subject=${subject}&body=${body}`;}
