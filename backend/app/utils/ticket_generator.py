"""
PDF Ticket Generator for IESA Events

Generates professional event tickets with:
- IESA logo and branding
- Event information
- Student/attendee information
- QR code for verification
- Date and venue details
- Modern card-based layout

NOTE: Heavy imports (reportlab, qrcode) are lazy-loaded inside methods
to avoid consuming memory on startup when tickets aren't being generated.
"""

from io import BytesIO
from datetime import datetime
from typing import Optional
import os


# Resolve logo path relative to this file
_LOGO_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))),
    "public", "assets", "images", "logo.png"
)


class TicketGenerator:
    """Generate PDF tickets for events"""

    # Brand colors
    NAVY = "#0F0F2D"
    LIME = "#C8F31D"
    TEAL = "#4CA868"
    LAVENDER = "#9B72CF"
    CORAL = "#E06050"
    GHOST = "#F8F8FC"

    def __init__(self):
        from reportlab.lib.pagesizes import A4
        self.pagesize = A4
        self.width, self.height = self.pagesize

    def generate_qr_code(self, data: str) -> BytesIO:
        """Generate QR code as BytesIO"""
        import qrcode as qr_module
        qr = qr_module.QRCode(
            version=1,
            error_correction=qr_module.constants.ERROR_CORRECT_L,
            box_size=8,
            border=1,
        )
        qr.add_data(data)
        qr.make(fit=True)

        img = qr.make_image(fill_color=self.NAVY, back_color="white")

        buffer = BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        return buffer

    def generate_ticket(
        self,
        event_id: str,
        event_title: str,
        event_date: datetime,
        event_location: str,
        student_name: str,
        student_email: str,
        student_level: str,
        reference: str,
        ticket_number: Optional[str] = None,
        event_category: str = "Event"
    ) -> BytesIO:
        """Generate a professional PDF event ticket."""
        from reportlab.lib.units import inch, mm
        from reportlab.lib import colors
        from reportlab.pdfgen import canvas
        from reportlab.lib.utils import ImageReader

        buffer = BytesIO()
        pdf = canvas.Canvas(buffer, pagesize=self.pagesize)
        pdf.setTitle(f"Event Ticket - {event_title}")

        W = self.width
        H = self.height
        left = 1 * inch
        right = W - 1 * inch
        content_w = right - left
        ticket_ref = ticket_number or reference

        # ═══════════════════════════════════════════════════════
        # BACKGROUND
        # ═══════════════════════════════════════════════════════
        pdf.setFillColor(colors.HexColor(self.GHOST))
        pdf.rect(0, 0, W, H, fill=True, stroke=False)

        # ═══════════════════════════════════════════════════════
        # HEADER BAR — navy strip at top
        # ═══════════════════════════════════════════════════════
        header_h = 1.4 * inch
        pdf.setFillColor(colors.HexColor(self.NAVY))
        pdf.rect(0, H - header_h, W, header_h, fill=True, stroke=False)

        # Lime accent bar
        accent_h = 4 * mm
        pdf.setFillColor(colors.HexColor(self.LIME))
        pdf.rect(0, H - header_h - accent_h, W, accent_h, fill=True, stroke=False)

        # Logo
        logo_y = H - header_h + 0.25 * inch
        try:
            if os.path.exists(_LOGO_PATH):
                logo = ImageReader(_LOGO_PATH)
                logo_size = 0.9 * inch
                pdf.drawImage(logo, left, logo_y, width=logo_size, height=logo_size,
                              preserveAspectRatio=True, mask='auto')
                text_x = left + 1.05 * inch
            else:
                text_x = left
        except Exception:
            text_x = left

        # Header text
        pdf.setFillColor(colors.white)
        pdf.setFont("Helvetica-Bold", 22)
        pdf.drawString(text_x, logo_y + 0.55 * inch, "IESA")

        pdf.setFont("Helvetica", 9)
        pdf.setFillColor(colors.HexColor("#CCCCCC"))
        pdf.drawString(text_x, logo_y + 0.32 * inch, "Industrial Engineering Students' Association")
        pdf.drawString(text_x, logo_y + 0.12 * inch, "University of Ibadan, Ibadan")

        # Ticket title — right
        pdf.setFillColor(colors.HexColor(self.LIME))
        pdf.setFont("Helvetica-Bold", 16)
        pdf.drawRightString(right, logo_y + 0.55 * inch, "EVENT TICKET")

        pdf.setFillColor(colors.white)
        pdf.setFont("Helvetica", 9)
        pdf.drawRightString(right, logo_y + 0.32 * inch, f"Ticket: {ticket_ref}")
        pdf.drawRightString(right, logo_y + 0.12 * inch, f"Ref: {reference}")

        # ═══════════════════════════════════════════════════════
        # EVENT INFO CARD — lime background
        # ═══════════════════════════════════════════════════════
        event_card_top = H - header_h - accent_h - 0.3 * inch
        event_card_h = 1.8 * inch
        event_card_y = event_card_top - event_card_h
        card_x = left - 0.1 * inch
        card_w = content_w + 0.2 * inch

        # Card shadow
        pdf.setFillColor(colors.HexColor("#DDDDDD"))
        pdf.roundRect(card_x + 4, event_card_y - 4, card_w, event_card_h, 12, fill=True, stroke=False)

        # Lime card body
        pdf.setFillColor(colors.HexColor(self.LIME))
        pdf.setStrokeColor(colors.HexColor(self.NAVY))
        pdf.setLineWidth(2)
        pdf.roundRect(card_x, event_card_y, card_w, event_card_h, 12, fill=True, stroke=True)

        # Event title
        pdf.setFillColor(colors.HexColor(self.NAVY))
        pdf.setFont("Helvetica-Bold", 18)
        title_y = event_card_top - 0.5 * inch

        # Wrap long titles
        if len(event_title) > 38:
            words = event_title.split()
            lines = []
            current_line = []
            for word in words:
                current_line.append(word)
                if len(' '.join(current_line)) > 38:
                    current_line.pop()
                    lines.append(' '.join(current_line))
                    current_line = [word]
            if current_line:
                lines.append(' '.join(current_line))

            for line in lines[:2]:
                pdf.drawCentredString(W / 2, title_y, line)
                title_y -= 0.28 * inch
        else:
            pdf.drawCentredString(W / 2, title_y, event_title)
            title_y -= 0.4 * inch

        # Date & Location
        formatted_date = event_date.strftime("%A, %B %d, %Y at %I:%M %p")
        pdf.setFont("Helvetica-Bold", 11)
        pdf.drawCentredString(W / 2, title_y, formatted_date)
        title_y -= 0.28 * inch

        pdf.setFont("Helvetica", 10)
        pdf.drawCentredString(W / 2, title_y, f"{event_category}  ·  {event_location}")

        # ═══════════════════════════════════════════════════════
        # ATTENDEE CARD — white
        # ═══════════════════════════════════════════════════════
        attendee_top = event_card_y - 0.25 * inch
        attendee_h = 1.6 * inch
        attendee_y = attendee_top - attendee_h

        # Card shadow
        pdf.setFillColor(colors.HexColor("#DDDDDD"))
        pdf.roundRect(card_x + 3, attendee_y - 3, card_w, attendee_h, 12, fill=True, stroke=False)

        # Card body
        pdf.setFillColor(colors.white)
        pdf.setStrokeColor(colors.HexColor("#E0E0E0"))
        pdf.setLineWidth(0.5)
        pdf.roundRect(card_x, attendee_y, card_w, attendee_h, 12, fill=True, stroke=True)

        # Section header
        y = attendee_top - 0.35 * inch
        section_x = left + 0.1 * inch

        pdf.setFillColor(colors.HexColor(self.LAVENDER))
        pdf.rect(section_x, y - 2, 3, 14, fill=True, stroke=False)
        pdf.setFillColor(colors.HexColor(self.NAVY))
        pdf.setFont("Helvetica-Bold", 11)
        pdf.drawString(section_x + 10, y, "ATTENDEE INFORMATION")

        y -= 0.1 * inch
        pdf.setStrokeColor(colors.HexColor("#E8E8E8"))
        pdf.setLineWidth(0.5)
        pdf.line(section_x, y, right - 0.1 * inch, y)

        y -= 0.28 * inch
        details = [
            ("Name", student_name),
            ("Email", student_email),
            ("Level", student_level),
        ]
        for label, value in details:
            pdf.setFont("Helvetica", 9)
            pdf.setFillColor(colors.HexColor("#888888"))
            pdf.drawString(section_x, y, label)
            pdf.setFont("Helvetica-Bold", 10)
            pdf.setFillColor(colors.HexColor(self.NAVY))
            pdf.drawString(section_x + 1.2 * inch, y, str(value))
            y -= 0.24 * inch

        # ═══════════════════════════════════════════════════════
        # QR CODE — centered below attendee card
        # ═══════════════════════════════════════════════════════
        qr_data = f"IESA_EVENT:{event_id}|TICKET:{ticket_ref}|ATTENDEE:{student_email}"
        qr_buffer = self.generate_qr_code(qr_data)
        qr_image = ImageReader(qr_buffer)

        qr_size = 1.5 * inch
        qr_x = (W - qr_size) / 2
        qr_y = attendee_y - qr_size - 0.4 * inch

        # QR background card
        qr_card_padding = 0.15 * inch
        qr_card_x = qr_x - qr_card_padding
        qr_card_y = qr_y - qr_card_padding - 0.2 * inch
        qr_card_w = qr_size + 2 * qr_card_padding
        qr_card_h = qr_size + 2 * qr_card_padding + 0.3 * inch

        pdf.setFillColor(colors.white)
        pdf.setStrokeColor(colors.HexColor("#E0E0E0"))
        pdf.setLineWidth(0.5)
        pdf.roundRect(qr_card_x, qr_card_y, qr_card_w, qr_card_h, 8, fill=True, stroke=True)

        pdf.drawImage(qr_image, qr_x, qr_y, width=qr_size, height=qr_size,
                      preserveAspectRatio=True, mask='auto')

        pdf.setFont("Helvetica-Bold", 8)
        pdf.setFillColor(colors.HexColor(self.NAVY))
        pdf.drawCentredString(W / 2, qr_y - 0.18 * inch, "Scan at event entrance")

        # ═══════════════════════════════════════════════════════
        # FOOTER
        # ═══════════════════════════════════════════════════════
        footer_y = 1.0 * inch
        pdf.setFont("Helvetica-Oblique", 8)
        pdf.setFillColor(colors.HexColor("#999999"))
        pdf.drawCentredString(W / 2, footer_y,
                             "This ticket is non-transferable. Present this ticket at the event.")

        pdf.setFont("Helvetica", 7)
        pdf.drawCentredString(W / 2, footer_y - 0.18 * inch,
                             f"IESA · University of Ibadan · iesa@ui.edu.ng · Generated {datetime.now().strftime('%B %d, %Y')}")

        # Bottom accent lines
        pdf.setStrokeColor(colors.HexColor(self.NAVY))
        pdf.setLineWidth(2)
        pdf.line(0, 0.3 * inch, W, 0.3 * inch)
        pdf.setStrokeColor(colors.HexColor(self.LIME))
        pdf.setLineWidth(1)
        pdf.line(0, 0.25 * inch, W, 0.25 * inch)

        # Save PDF
        pdf.save()

        buffer.seek(0)
        return buffer


def generate_event_ticket(
    event_id: str,
    event_title: str,
    event_date: datetime,
    event_location: str,
    student_name: str,
    student_email: str,
    student_level: str,
    reference: str,
    ticket_number: Optional[str] = None,
    event_category: str = "Event"
) -> BytesIO:
    """
    Convenience function to generate an event ticket
    """
    generator = TicketGenerator()
    return generator.generate_ticket(
        event_id=event_id,
        event_title=event_title,
        event_date=event_date,
        event_location=event_location,
        student_name=student_name,
        student_email=student_email,
        student_level=student_level,
        reference=reference,
        ticket_number=ticket_number,
        event_category=event_category
    )
