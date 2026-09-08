import { describe, it, expect } from "vitest";
import { AnnouncementSchema } from "@/lib/schemas";

function interpolatePersonalization(text: string, studentUser: any) {
  if (!text) return "";
  const firstName = studentUser?.firstName || studentUser?.name?.split(" ")[0] || "Student";
  const lastName = studentUser?.lastName || "";
  const studentName = `${firstName} ${lastName}`.trim() || firstName;
  const matricNo = studentUser?.matricNumber || "";
  const level = studentUser?.currentLevel || studentUser?.level || "";
  const department = studentUser?.department || "Industrial and Production Engineering";
  const email = studentUser?.email || "";

  return text
    .replace(/\{\{\s*first_name\s*\}\}/gi, firstName)
    .replace(/\{\{\s*last_name\s*\}\}/gi, lastName)
    .replace(/\{\{\s*student_name\s*\}\}/gi, studentName)
    .replace(/\{\{\s*matric_no\s*\}\}/gi, matricNo)
    .replace(/\{\{\s*level\s*\}\}/gi, level)
    .replace(/\{\{\s*department\s*\}\}/gi, department)
    .replace(/\{\{\s*email\s*\}\}/gi, email);
}

describe("AnnouncementSchema validation", () => {
  it("validates a valid announcement form with attachments", () => {
    const valid = {
      title: "Exam Schedule for {{level}} Students",
      content: "<p>Dear {{first_name}}, please find the timetable attached.</p>",
      priority: "high" as const,
      targetLevels: ["300L"],
      targetAudience: "specific_levels" as const,
      attachments: [
        {
          name: "timetable.pdf",
          url: "https://res.cloudinary.com/demo/image/upload/timetable.pdf",
          fileType: "pdf" as const,
          size: 1048576,
        },
      ],
      sendEmail: true,
    };

    const result = AnnouncementSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("supports large rich text content up to 50,000 characters", () => {
    const longContent = "<p>" + "A".repeat(15000) + "</p>";
    const data = {
      title: "Long Announcement",
      content: longContent,
      priority: "normal" as const,
      targetLevels: [],
      targetAudience: "all" as const,
    };

    const result = AnnouncementSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("rejects invalid attachment missing required url", () => {
    const data = {
      title: "Invalid attachment",
      content: "Content",
      priority: "normal" as const,
      targetLevels: [],
      targetAudience: "all" as const,
      attachments: [
        {
          name: "test.pdf",
          // url missing
          fileType: "pdf",
          size: 100,
        },
      ],
    };

    const result = AnnouncementSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

describe("Personalization Tag Interpolation", () => {
  const student = {
    firstName: "Chioma",
    lastName: "Okonkwo",
    matricNumber: "218492",
    currentLevel: "400L",
    department: "Industrial & Production Engineering",
    email: "chioma.okonkwo@students.ui.edu.ng",
  };

  it("interpolates first name and level in title", () => {
    const title = "Urgent for {{first_name}} - {{level}} Briefing";
    const resolved = interpolatePersonalization(title, student);
    expect(resolved).toBe("Urgent for Chioma - 400L Briefing");
  });

  it("interpolates all student tags in rich HTML content", () => {
    const template = `
      <p>Hello <strong>{{student_name}}</strong> ({{matric_no}}),</p>
      <p>Welcome to your {{level}} semester in {{department}}.</p>
      <p>A copy has been sent to {{email}}.</p>
    `;
    const resolved = interpolatePersonalization(template, student);

    expect(resolved).toContain("Chioma Okonkwo");
    expect(resolved).toContain("218492");
    expect(resolved).toContain("400L");
    expect(resolved).toContain("Industrial & Production Engineering");
    expect(resolved).toContain("chioma.okonkwo@students.ui.edu.ng");
  });

  it("handles case-insensitive tags with whitespace", () => {
    const text = "Hi {{ FIRST_NAME }}, your matric is {{   matric_no   }}";
    const resolved = interpolatePersonalization(text, student);
    expect(resolved).toBe("Hi Chioma, your matric is 218492");
  });

  it("gracefully falls back when fields are missing", () => {
    const partialStudent = { name: "Ibrahim Musa" };
    const text = "Hello {{first_name}}, welcome to {{department}}";
    const resolved = interpolatePersonalization(text, partialStudent);
    expect(resolved).toBe("Hello Ibrahim, welcome to Industrial and Production Engineering");
  });
});

describe("Custom Email Parsing & Smart Arrangement", () => {
  it("extracts and deduplicates emails from messy multiline and punctuation-separated text", async () => {
    const { parseAndFormatEmailBlob } = await import("@/components/admin/CustomEmailListManager");

    const rawBlob = `
      john.doe@ui.edu.ng,
      Jane Smith <jane.smith@gmail.com>;
      JOHN.DOE@UI.EDU.NG
      219800@stu.ui.edu.ng
      guest@external.org, jane.smith@gmail.com
      Contact us at info@iesa-ui.org!
    `;

    const { uniqueEmails, totalExtracted, duplicatesRemoved } = parseAndFormatEmailBlob(rawBlob);

    expect(totalExtracted).toBe(7);
    expect(duplicatesRemoved).toBe(2);
    expect(uniqueEmails).toEqual([
      "john.doe@ui.edu.ng",
      "jane.smith@gmail.com",
      "219800@stu.ui.edu.ng",
      "guest@external.org",
      "info@iesa-ui.org",
    ]);
  });

  it("validates AnnouncementSchema with custom_emails audience and list", () => {
    const validCustom = {
      title: "Exclusive Notice",
      content: "<p>Hello custom recipients</p>",
      priority: "urgent" as const,
      targetAudience: "custom_emails" as const,
      customEmails: ["lead1@ui.edu.ng", "lead2@gmail.com"],
      sendEmail: true,
    };

    const result = AnnouncementSchema.safeParse(validCustom);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.targetAudience).toBe("custom_emails");
      expect(result.data.customEmails).toHaveLength(2);
    }
  });
});

