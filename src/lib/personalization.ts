/**
 * Personalization Interpolation Utility
 *
 * Replaces template variables like `{{first_name}}`, `{{student_name}}`,
 * `{{matric_no}}`, `{{level}}`, `{{department}}`, `{{email}}` with
 * the student's actual profile details.
 */

export interface StudentProfileLike {
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  matricNumber?: string | null;
  currentLevel?: string | null;
  level?: string | null;
  department?: string | null;
  email?: string | null;
}

export function interpolatePersonalization(
  text: string | undefined | null,
  studentUser?: StudentProfileLike | null
): string {
  if (!text) return "";
  if (!text.includes("{{")) return text;

  const firstName =
    studentUser?.firstName ||
    studentUser?.name?.split(" ")[0] ||
    "Student";
  const lastName = studentUser?.lastName || "";
  const studentName =
    studentUser?.name ||
    `${firstName} ${lastName}`.trim() ||
    firstName;
  const matricNo = studentUser?.matricNumber || "";
  const level = studentUser?.currentLevel || studentUser?.level || "";
  const department =
    studentUser?.department || "Industrial and Production Engineering";
  const email = studentUser?.email || "";

  return text
    .replace(/\{\{\s*first_name\s*\}\}/gi, firstName)
    .replace(/\{\{\s*firstname\s*\}\}/gi, firstName)
    .replace(/\{\{\s*last_name\s*\}\}/gi, lastName)
    .replace(/\{\{\s*lastname\s*\}\}/gi, lastName)
    .replace(/\{\{\s*student_name\s*\}\}/gi, studentName)
    .replace(/\{\{\s*studentname\s*\}\}/gi, studentName)
    .replace(/\{\{\s*full_name\s*\}\}/gi, studentName)
    .replace(/\{\{\s*fullname\s*\}\}/gi, studentName)
    .replace(/\{\{\s*matric_no\s*\}\}/gi, matricNo)
    .replace(/\{\{\s*matricno\s*\}\}/gi, matricNo)
    .replace(/\{\{\s*matric_number\s*\}\}/gi, matricNo)
    .replace(/\{\{\s*matricnumber\s*\}\}/gi, matricNo)
    .replace(/\{\{\s*level\s*\}\}/gi, level)
    .replace(/\{\{\s*current_level\s*\}\}/gi, level)
    .replace(/\{\{\s*department\s*\}\}/gi, department)
    .replace(/\{\{\s*dept\s*\}\}/gi, department)
    .replace(/\{\{\s*email\s*\}\}/gi, email);
}
