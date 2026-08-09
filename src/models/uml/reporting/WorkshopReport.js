/*
 * UML architectural skeleton for the SAIT Youth Initiative project.
 * This class mirrors the final Class Diagram.
 *
 * Method bodies are intentionally left empty as permitted by the
 * Small System Prototype requirements. The working MVP logic remains
 * in the existing Next.js pages, API routes, Firebase services, and
 * application components.
 */

import Report from "./Report";

export default class WorkshopReport extends Report {
  constructor(
    reportID = "",
    generatedDate = null,
    period = "",
    mostVisited = []
  ) {
    super(reportID, generatedDate);

    this.period = period;             // String
    this.mostVisited = mostVisited;   // List
  }
}
