export const WORKSHOP_FEEDBACK_XP = 20;
export const FEEDBACK_QUESTIONS = Object.freeze([
  { id: "enjoyment", label: "How much did you enjoy this workshop?", options: ["Loved it! (5/5)", "Really liked it (4/5)", "It was good (3/5)", "It was okay (2/5)", "Not for me (1/5)"] },
  { id: "favorite", label: "What was the best part?", options: ["Trying things out", "Learning something new", "Making something", "Working with others", "The instructor"] },
  { id: "pace", label: "Was it easy to follow along?", options: ["Yes!", "Mostly", "Sometimes", "Not really"] },
  { id: "improve", label: "What could make it even better?", options: ["More hands-on activities", "More time", "Clearer steps", "More help", "Nothing, it was great"] },
  { id: "recommend", label: "Would you tell a friend to try it?", options: ["Definitely!", "Maybe", "Not sure", "No"] },
]);
export function validateWorkshopFeedback(answers, comment) {
  return answers && typeof answers === "object" && !Array.isArray(answers) &&
    FEEDBACK_QUESTIONS.every(q => typeof answers[q.id] === "string" && q.options.includes(answers[q.id])) &&
    (comment === undefined || (typeof comment === "string" && comment.length <= 500));
}
