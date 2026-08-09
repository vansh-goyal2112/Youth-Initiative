/*
 * UML architectural skeleton for the SAIT Youth Initiative project.
 * This class mirrors the final Class Diagram.
 *
 * Method bodies are intentionally left empty as permitted by the
 * Small System Prototype requirements. The working MVP logic remains
 * in the existing Next.js pages, API routes, Firebase services, and
 * application components.
 */

import Workshop from "./Workshop";

export default class InPersonCourse extends Workshop {
  constructor(
    courseCode = "",
    name = "",
    description = "",
    schedule = null,
    location = ""
  ) {
    super(courseCode, name, description, schedule);

    this.location = location;           // String
  }
}
