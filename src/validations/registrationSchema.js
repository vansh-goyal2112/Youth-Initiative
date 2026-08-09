import * as Yup from "yup";

const nameRegex =
  /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:[ '-][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/;

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) {
    return null;
  }

  const today = new Date();
  const birthDate = new Date(
    `${dateOfBirth}T00:00:00`
  );

  if (Number.isNaN(birthDate.getTime())) {
    return null;
  }

  let age =
    today.getFullYear() - birthDate.getFullYear();

  const monthDifference =
    today.getMonth() - birthDate.getMonth();

  const birthdayNotReached =
    monthDifference < 0 ||
    (monthDifference === 0 &&
      today.getDate() < birthDate.getDate());

  if (birthdayNotReached) {
    age -= 1;
  }

  return age;
}

export const registrationSchema = Yup.object({
  firstName: Yup.string()
    .transform((value) =>
      typeof value === "string"
        ? value.trim().replace(/\s+/g, " ")
        : value
    )
    .required("First name is required.")
    .min(2, "First name must contain at least 2 characters.")
    .max(40, "First name cannot exceed 40 characters.")
    .matches(
      nameRegex,
      "Enter a valid first name using letters, spaces, apostrophes or hyphens."
    ),

  lastName: Yup.string()
    .transform((value) =>
      typeof value === "string"
        ? value.trim().replace(/\s+/g, " ")
        : value
    )
    .required("Last name is required.")
    .min(2, "Last name must contain at least 2 characters.")
    .max(40, "Last name cannot exceed 40 characters.")
    .matches(
      nameRegex,
      "Enter a valid last name using letters, spaces, apostrophes or hyphens."
    ),

  email: Yup.string()
    .transform((value) =>
      typeof value === "string"
        ? value.trim().toLowerCase()
        : value
    )
    .required("Email address is required.")
    .email("Enter a valid email address.")
    .max(254, "Email address is too long."),

  dateOfBirth: Yup.string()
    .required("Date of birth is required.")
    .test(
      "valid-date",
      "Enter a valid date of birth.",
      (value) => {
        if (!value) {
          return false;
        }

        const date = new Date(`${value}T00:00:00`);

        return !Number.isNaN(date.getTime());
      }
    )
    .test(
      "not-future",
      "Date of birth cannot be in the future.",
      (value) => {
        if (!value) {
          return false;
        }

        const selectedDate = new Date(
          `${value}T00:00:00`
        );

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return selectedDate < today;
      }
    )
    .test(
      "reasonable-age",
      "Enter a valid student date of birth.",
      (value) => {
        const age = calculateAge(value);

        if (age === null) {
          return false;
        }

        return age >= 5 && age <= 25;
      }
    ),
});

export { calculateAge };