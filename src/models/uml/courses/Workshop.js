/*
 * UML architectural skeleton for the SAIT Youth Initiative project.
 * This class mirrors the final Class Diagram.
 *
 * Method bodies are intentionally left empty as permitted by the
 * Small System Prototype requirements. The working MVP logic remains
 * in the existing Next.js pages, API routes, Firebase services, and
 * application components.
 */

export default class Workshop {
  constructor(
    courseCode = "",
    name = "",
    description = "",
    schedule = null
  ) {
    this.courseCode = courseCode;       // String
    this.name = name;                   // String
    this.description = description;     // String
    this.schedule = schedule;           // DateTime
  }

  addCourse() {}

  updateCourse() {}

  deleteCourse() {}
}
