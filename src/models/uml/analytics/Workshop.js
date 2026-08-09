/*
 * UML architectural skeleton for the SAIT Youth Initiative project.
 * This class mirrors the final Class Diagram.
 *
 * Method bodies are intentionally left empty as permitted by the
 * Small System Prototype requirements. The working MVP logic remains
 * in the existing Next.js pages, API routes, Firebase services, and
 * application components.
 */

/*
 * NOTE:
 * The final UML contains a second class also named "Workshop".
 * It is kept in a separate package/folder to preserve the diagram
 * without creating a JavaScript module-name conflict.
 */
export default class Workshop {
  constructor(workshopDate = null, topic = "", capacity = 0) {
    this.workshopDate = workshopDate;   // DateTime
    this.topic = topic;                 // String
    this.capacity = capacity;           // Int
  }

  viewUpcoming() {}
}
