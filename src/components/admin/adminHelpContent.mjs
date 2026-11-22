const guides = {
  "/admin": {
    title: "Dashboard",
    intro: "Start here to see what needs attention and open the tools you use most.",
    steps: [
      { text: "Check Needs attention for items waiting on staff. Select a count to open the right page." },
      { text: "Use Everyday shortcuts to open the tools available to your role." },
      { text: "Look at At a glance for the current student and workshop totals." },
    ],
    tip: "A dash means the count is unavailable or you do not have access to it.",
  },
  "/admin/students": {
    title: "Student directory",
    permission: "students.view",
    intro: "Find a student and check their profile or registration status.",
    steps: [
      { text: "Search by name, Youth ID or email. Match the Youth ID before opening a profile." },
      { permission: "students.edit", text: "To fix a grade, choose Edit student profile, select the correct school grade, and save." },
      { permission: "xp.adjust", text: "To grant or correct XP, open the student profile and find Adjust student XP. Choose Grant XP or Correct erroneous XP, then enter the amount and reason." },
    ],
    tip: "Students waiting for account activation are listed above the directory.",
  },
  "/admin/reports": {
    title: "Student reports",
    permission: "reports.generate",
    intro: "See one student's workshop history, badges and progress.",
    steps: [
      { text: "Search by student name, email or Youth ID. Check the birth date and choose Generate report on the matching student." },
      { text: "Check the name and review the workshop history before sharing the report." },
      { permission: "reports.export", text: "Choose Export CSV if you need a spreadsheet copy." },
    ],
    tip: "Keep student reports in approved staff channels.",
  },
  "/admin/completions": {
    title: "Review claims",
    permission: "completion.review",
    intro: "Review workshop attendance that students reported themselves.",
    steps: [
      { text: "Open Pending review and search by the student or workshop name." },
      { text: "Check the workshop and date. Approve the claim if it is correct." },
      { permission: "completion.reverse", text: "If a claim is wrong, select Reverse, explain why, and confirm." },
    ],
    tip: "Students receive half XP when they report attendance. Approval does not award it again.",
  },
  "/admin/workshops": {
    title: "Workshop studio",
    permission: "workshops.view",
    intro: "Find workshops and check which sessions are available to students.",
    steps: [
      { text: "Search the workshop list and open the record you want to review." },
      { permission: "workshops.create", text: "To add a workshop, choose Create workshop and fill in the program details." },
      { permission: "workshops.edit", text: "Open the workshop editor to update the description, image or grade range. Use the session controls to add or update workshop dates." },
    ],
    tip: "Active, open workshops can appear in student recommendations the next time students load Home or Journey. Check the grade range, date and registration link, and add accurate interest tags. Future SAIT pathways use a separate catalogue refreshed by the Ingest SAIT programs and workshops workflow in GitHub Actions.",
  },
  "/admin/badges": {
    title: "Badges",
    permission: "badges.manage",
    intro: "Set up badges students can earn by completing workshops.",
    steps: [
      { text: "Choose a badge in the catalogue to edit it, or start a new badge." },
      { text: "Add a name, description and artwork, then set the earning rules." },
      { text: "Review the rules and save the badge." },
    ],
    tip: "Describe what students did to earn the badge in a few plain words.",
  },
  "/admin/engagement": {
    title: "Engagement insights",
    permission: "attendance.view",
    intro: "See which workshops students attended and compare participation over time.",
    steps: [
      { text: "Choose the time period you want to review." },
      { text: "Look at Most attended workshops and use the details below for individual workshop totals." },
    ],
    tip: "The totals count verified check-ins. A registration alone does not count as attendance.",
  },
  "/admin/attendance": {
    title: "Attendance",
    permission: "attendance.manage",
    intro: "Check students in when they arrive for a workshop.",
    steps: [
      { text: "Select the workshop and its session, then choose Generate check-in QR." },
      { text: "Show the QR code. Students can scan it or enter the four-digit code in their app." },
    ],
    tip: "The code expires. Generate a new one if students still need to check in.",
  },
  "/admin/redeem-xp": {
    title: "Redeem XP",
    permission: "xp.redeem",
    intro: "Record a reward when a student spends XP at a booth or SAIT event.",
    steps: [
      { text: "Search by student name or Youth ID. Match the Youth ID and select the student." },
      { text: "Check their XP available to spend, then enter the XP cost and the reward and event." },
      { text: "Select Confirm XP redemption. Check the updated balance and Recent redemptions before handing over the reward." },
    ],
    tip: "If the result is unclear, check the redemption log before trying again.",
  },
  "/admin/team": {
    title: "Team & access",
    permission: "admins.view",
    intro: "See which staff have access to the admin portal.",
    steps: [
      { text: "Find a staff member in the Staff directory and select their name." },
      { permission: "admins.approve", text: "Review pending access requests and approve staff who should have access." },
      { permission: "admins.manage", text: "Use Employee access to update the staff member's role or permissions, then save." },
    ],
    tip: "Give staff access to the tools they need for their work.",
  },
  "/admin/audit": {
    title: "Audit activity",
    permission: "audit.view",
    intro: "Look up administrative changes made in the portal.",
    steps: [
      { text: "Use Filter activity to search for a recorded action or resource." },
      { text: "Check the date and staff member to find the event you were looking for." },
    ],
    tip: "Use this page to review what happened before making further changes.",
  },
  "/admin/security": {
    title: "Account security",
    intro: "Set up the authenticator app that protects your staff sign-in.",
    steps: [
      { text: "Start authenticator setup and scan the QR code in your authenticator app." },
      { text: "Enter the current six-digit code to verify setup." },
    ],
    tip: "Keep your setup key and verification codes private.",
  },
  "/admin/media": {
    title: "Homepage banner",
    permission: "workshops.edit",
    intro: "Update the image students see at the top of their homepage.",
    steps: [
      { text: "Under Student homepage, choose the image you want to use." },
      { text: "Upload it and check the preview. Open the student homepage to confirm it looks right." },
    ],
    tip: "Use the Reward artwork uploader on this page to change the reward celebration image.",
  },
  "/admin/feedback": {
    title: "Workshop feedback",
    permission: "reports.generate",
    intro: "Read feedback collected before workshop surveys were retired.",
    steps: [
      { text: "Open a workshop's results and read the summary." },
      { text: "Use the CSV export if you need a copy of the historical results." },
    ],
    tip: "This page contains historical responses.",
  },
};

const eventStaffPaths = ["/admin/attendance", "/admin/redeem-xp"];

export function getAdminGuide(path, role, permissions) {
  const guide = guides[path];
  if (!guide) return null;
  if (role === "event_staff" && !eventStaffPaths.includes(path)) return null;
  if (guide.permission && !permissions.includes(guide.permission)) {
    if (role !== "event_staff" || path !== "/admin/attendance") return null;
    return {
      ...guide,
      steps: [
        { text: "Ask the workshop coordinator to start the check-in and show you the QR code." },
        { text: "Help students scan the QR code or enter the four-digit code in their app." },
      ],
      tip: "Ask the coordinator for a new code if the current one expires.",
    };
  }
  return { ...guide, steps: guide.steps.filter(step => !step.permission || permissions.includes(step.permission)) };
}

export function getAdminTour(paths, role, permissions) {
  return (role === "event_staff" ? eventStaffPaths : paths)
    .map(path => getAdminGuide(path, role, permissions))
    .filter(Boolean);
}
