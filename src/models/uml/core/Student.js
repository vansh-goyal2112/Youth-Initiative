/*
 * UML architectural skeleton for the SAIT Youth Initiative project.
 * This class mirrors the final Class Diagram.
 *
 * Method bodies are intentionally left empty as permitted by the
 * Small System Prototype requirements. The working MVP logic remains
 * in the existing Next.js pages, API routes, Firebase services, and
 * application components.
 */

import User from "./User";

export default class Student extends User {
  constructor(
    userID = "",
    name = "",
    email = "",
    password = "",
    points = 0,
    badges = []
  ) {
    super(userID, name, email, password);

    this.points = points;       // Int
    this.badges = badges;       // List
  }

  trackLearningJourney() {}

  chooseCourse() {}

  redeemPoints() {}
}
