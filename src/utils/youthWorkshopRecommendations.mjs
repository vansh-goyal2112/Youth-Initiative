export function recommendYouthWorkshops({workshops=[],registrations=[],student={}}) {
  student = student || {};
  const joined=new Set(registrations.filter(r=>r.status!=="cancelled").map(r=>r.workshopId));
  const history=registrations.filter(r=>r.status==="completed").map(r=>r.workshopSnapshot||r.workshop).filter(Boolean);
  const interests=(student.interests||[]).map(i=>String(i).toLowerCase());
  const mode=String(student.learningMode||"").toLowerCase();
  const areas=new Set(history.map(w=>String(w.category||"").toLowerCase()).filter(Boolean));
  const now=Date.now();
  return workshops.filter(w=>{
    if(w.status!=="active"||joined.has(w.id))return false;
    if(w.endDate && new Date(w.endDate+"T23:59:59").getTime()<now)return false;
    return true;
  }).map(w=>{
    const searchable=[w.title,w.category,w.programArea,w.description].filter(Boolean).join(" ").toLowerCase();
    const matched=interests.filter(i=>searchable.includes(i));
    const category=String(w.category||"").toLowerCase();
    const categoryMatch=areas.has(category);
    const modeMatch=mode==="both"||!mode||w.learningMode==="both"||w.learningMode===mode;
    const days=w.startDate?Math.ceil((new Date(w.startDate+"T12:00:00").getTime()-now)/86400000):null;
    const upcoming=days!==null&&days>=0&&days<=14;
    const score=matched.length*35+(categoryMatch?25:0)+(modeMatch?15:0)+(upcoming?10:0);
    const reasons=[...matched.slice(0,2).map(i=>"Matches your interest: "+i)];
    if(categoryMatch)reasons.push("Builds on workshops you've completed");
    if(modeMatch&&mode)reasons.push("Fits your learning preference");
    if(upcoming)reasons.push("Starting soon");
    return {...w,recommendationScore:score,recommendationReasons:reasons};
  }).sort((a,b)=>b.recommendationScore-a.recommendationScore||String(a.title).localeCompare(String(b.title))).slice(0,3);
}
