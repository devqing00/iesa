"""
PDF Timetable Generator for IESA

Generates professional PDF timetable schedules with:
- IESA logo and branding
- Weekly schedule grid
- Color-coded class types (lecture, practical, tutorial)
- Student/level information
- Modern card-based layout

NOTE: Heavy imports (reportlab) are lazy-loaded inside methods
to avoid consuming memory on startup when timetables aren't being generated.
"""

from io import BytesIO
from datetime import datetime
from typing import List, Optional
import os


_LOGO_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))),
    "public", "assets", "images", "logo.png"
)


class TimetableGenerator:
    """Generate PDF timetable schedules"""

    # Brand colors
    NAVY = "#0F0F2D"
    LIME = "#C8F31D"
    TEAL = "#4CA868"
    TEAL_LIGHT = "#E8F5E9"
    CORAL = "#E06050"
    CORAL_LIGHT = "#FDECEC"
    LAVENDER = "#9B72CF"
    LAVENDER_LIGHT = "#F0E8F8"
    GHOST = "#F8F8FC"
    SUNNY = "#E8D44D"
    SUNNY_LIGHT = "#FFF8E1"

    TYPE_COLORS = {
        "lecture": ("#0F0F2D", "#FFFFFF"),      # Navy bg, white text
        "practical": ("#E06050", "#FFFFFF"),     # Coral bg, white text
        "tutorial": ("#4CA868", "#0F0F2D"),     # Teal bg, navy text
    }

    DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

    def __init__(self):
        from reportlab.lib.pagesizes import A4, landscape
        self.pagesize = landscape(A4)
        self.width, self.height = self.pagesize

    def generate_timetable(
        self,
        classes: List[dict],
        student_name: str,
        student_level: int,
        session_name: str,
        generated_at: Optional[datetime] = None,
    ) -> BytesIO:
        """Generate a professional PDF timetable."""
        from reportlab.lib.units import inch, mm
        from reportlab.lib import colors
        from reportlab.pdfgen import canvas
        from reportlab.lib.utils import ImageReader

        buffer = BytesIO()
        pdf = canvas.Canvas(buffer, pagesize=self.pagesize)
        pdf.setTitle(f"Timetable - Level {student_level}")

        W = self.width
        H = self.height
        margin = 0.6 * inch
        gen_time = generated_at or datetime.now()

        # ── BACKGROUND ──
        pdf.setFillColor(colors.HexColor(self.GHOST))
        pdf.rect(0, 0, W, H, fill=True, stroke=False)

        # ── HEADER BAND ──
        header_h = 60
        pdf.setFillColor(colors.HexColor(self.NAVY))
        pdf.roundRect(margin, H - margin - header_h, W - 2 * margin, header_h, 10, fill=True, stroke=False)

        # Logo
        try:
            if os.path.exists(_LOGO_PATH):
                logo = ImageReader(_LOGO_PATH)
                pdf.drawImage(logo, margin + 12, H - margin - header_h + 10, width=40, height=40, mask="auto")
        except Exception:
            pass

        # Title text
        pdf.setFillColor(colors.white)
        pdf.setFont("Helvetica-Bold", 18)
        pdf.drawString(margin + 60, H - margin - 28, "IESA CLASS TIMETABLE")

        pdf.setFont("Helvetica", 10)
        pdf.drawString(margin + 60, H - margin - 45, f"Level {student_level}  •  {session_name}  •  {student_name}")

        # Date on right
        pdf.setFont("Helvetica", 9)
        date_text = gen_time.strftime("%B %d, %Y")
        pdf.drawRightString(W - margin - 12, H - margin - 28, f"Generated: {date_text}")

        # ── GROUP CLASSES BY DAY ──
        schedule: dict[str, list] = {day: [] for day in self.DAYS}
        for cls in classes:
            day = cls.get("day", "")
            if day in schedule:
                schedule[day].append(cls)

        # Sort each day by start time
        for day in self.DAYS:
            schedule[day].sort(key=lambda c: c.get("startTime", "00:00"))

        # ── TABLE GRID ──
        table_top = H - margin - header_h - 20
        table_left = margin
        table_width = W - 2 * margin
        col_width = table_width / len(self.DAYS)
        day_header_h = 28

        # Day headers
        for i, day in enumerate(self.DAYS):
            x = table_left + i * col_width
            # Header cell
            bg_color = colors.HexColor(self.LIME) if i % 2 == 0 else colors.HexColor(self.TEAL)
            pdf.setFillColor(bg_color)
            pdf.roundRect(x + 2, table_top - day_header_h, col_width - 4, day_header_h, 6, fill=True, stroke=False)
            pdf.setFillColor(colors.HexColor(self.NAVY))
            pdf.setFont("Helvetica-Bold", 11)
            text_w = pdf.stringWidth(day, "Helvetica-Bold", 11)
            pdf.drawString(x + (col_width - text_w) / 2, table_top - day_header_h + 9, day)

        # ── CLASS CARDS ──
        card_start_y = table_top - day_header_h - 10
        card_padding = 6
        card_gap = 5

        for i, day in enumerate(self.DAYS):
            x = table_left + i * col_width + card_padding
            y = card_start_y
            card_w = col_width - 2 * card_padding

            for cls in schedule[day]:
                course_code = cls.get("courseCode", "")
                course_title = cls.get("courseTitle", "")
                start_time = cls.get("startTime", "")
                end_time = cls.get("endTime", "")
                venue = cls.get("venue", "")
                lecturer = cls.get("lecturer", "")
                class_type = cls.get("type", cls.get("classType", "lecture"))

                bg_hex, text_hex = self.TYPE_COLORS.get(class_type, self.TYPE_COLORS["lecture"])

                # Calculate card height based on content
                card_h = 65
                if lecturer:
                    card_h += 12

                # Check if we need a new column (overflow)
                if y - card_h < margin + 20:
                    break

                # Card background
                pdf.setFillColor(colors.HexColor(bg_hex))
                pdf.roundRect(x, y - card_h, card_w, card_h, 6, fill=True, stroke=False)

                # Card content
                text_color = colors.HexColor(text_hex)
                pdf.setFillColor(text_color)

                # Course code
                pdf.setFont("Helvetica-Bold", 9)
                pdf.drawString(x + 5, y - 13, course_code)

                # Time
                pdf.setFont("Helvetica", 7)
                time_text = f"{start_time} - {end_time}"
                pdf.drawRightString(x + card_w - 5, y - 13, time_text)

                # Course title (truncate if needed)
                pdf.setFont("Helvetica", 7.5)
                display_title = course_title[:28] + "..." if len(course_title) > 28 else course_title
                pdf.drawString(x + 5, y - 28, display_title)

                # Venue
                pdf.setFont("Helvetica-Bold", 7)
                pdf.drawString(x + 5, y - 42, f"📍 {venue}")

                # Type badge
                pdf.setFont("Helvetica", 6)
                badge_text = class_type.upper()
                badge_w = pdf.stringWidth(badge_text, "Helvetica", 6) + 8
                # Semi-transparent badge
                if class_type == "lecture":
                    pdf.setFillColor(colors.HexColor("#FFFFFF"))
                    pdf.setStrokeColor(colors.HexColor("#FFFFFF"))
                else:
                    pdf.setFillColor(colors.HexColor(self.NAVY))
                    pdf.setStrokeColor(colors.HexColor(self.NAVY))
                pdf.roundRect(x + card_w - badge_w - 5, y - card_h + 5, badge_w, 14, 3, fill=True, stroke=False)
                if class_type == "lecture":
                    pdf.setFillColor(colors.HexColor(self.NAVY))
                else:
                    pdf.setFillColor(colors.white)
                pdf.drawString(x + card_w - badge_w - 1, y - card_h + 9, badge_text)

                # Lecturer (if present)
                if lecturer:
                    pdf.setFillColor(text_color)
                    pdf.setFont("Helvetica", 6.5)
                    lec_display = lecturer[:25] + "..." if len(lecturer) > 25 else lecturer
                    pdf.drawString(x + 5, y - 55, lec_display)

                y -= card_h + card_gap

        # ── FOOTER ──
        pdf.setFillColor(colors.HexColor(self.NAVY))
        pdf.setFont("Helvetica", 7)
        pdf.drawString(margin, margin - 5, "Industrial Engineering Students' Association (IESA) • University of Ibadan")
        pdf.drawRightString(W - margin, margin - 5, "This timetable is auto-generated and subject to change.")

        # ── LEGEND ──
        legend_y = margin + 15
        pdf.setFont("Helvetica-Bold", 8)
        pdf.setFillColor(colors.HexColor(self.NAVY))
        pdf.drawString(margin, legend_y, "Legend:")

        legend_x = margin + 50
        for type_name, (bg, _) in self.TYPE_COLORS.items():
            pdf.setFillColor(colors.HexColor(bg))
            pdf.roundRect(legend_x, legend_y - 2, 10, 10, 2, fill=True, stroke=False)
            pdf.setFillColor(colors.HexColor(self.NAVY))
            pdf.setFont("Helvetica", 7)
            pdf.drawString(legend_x + 14, legend_y, type_name.capitalize())
            legend_x += 80

        pdf.save()
        buffer.seek(0)
        return buffer


_timetable_generator = None


def generate_timetable_pdf(
    classes: List[dict],
    student_name: str,
    student_level: int,
    session_name: str,
) -> BytesIO:
    """
    Generate a timetable PDF.
    Uses a lazy-initialized singleton to avoid heavy imports on startup.
    """
    global _timetable_generator
    if _timetable_generator is None:
        _timetable_generator = TimetableGenerator()

    return _timetable_generator.generate_timetable(
        classes=classes,
        student_name=student_name,
        student_level=student_level,
        session_name=session_name,
    )
