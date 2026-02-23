"""
PDF Ticket Generator for IESA Events

Generates professional event tickets with:
- IESA branding
- Event information
- Student/attendee information
- QR code for verification
- Date and venue details

NOTE: Heavy imports (reportlab, qrcode) are lazy-loaded inside methods
to avoid consuming memory on startup when tickets aren't being generated.
"""

from io import BytesIO
from datetime import datetime
from typing import Optional


class TicketGenerator:
    """Generate PDF tickets for events"""
    
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
            box_size=10,
            border=1,
        )
        qr.add_data(data)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Save to BytesIO
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
        """
        Generate a PDF event ticket
        
        Args:
            event_id: Event ID
            event_title: Event title
            event_date: Event date and time
            event_location: Event venue/location
            student_name: Attendee's full name
            student_email: Attendee's email
            student_level: Student's level (e.g., "300")
            reference: Payment reference (if paid event)
            ticket_number: Optional unique ticket number
            event_category: Event category (e.g., "Ceremony", "Workshop")
            
        Returns:
            BytesIO: PDF file as bytes
        """
        from reportlab.lib.units import inch
        from reportlab.lib import colors
        from reportlab.pdfgen import canvas
        from reportlab.lib.utils import ImageReader

        buffer = BytesIO()
        
        # Create PDF document
        pdf = canvas.Canvas(buffer, pagesize=self.pagesize)
        pdf.setTitle(f"Event Ticket - {event_title}")
        
        # --- HEADER ---
        # IESA Title with lime green accent
        pdf.setFont("Helvetica-Bold", 24)
        pdf.setFillColor(colors.HexColor("#0F0F2D"))  # Navy
        pdf.drawCentredString(self.width / 2, self.height - 1 * inch, "IESA")
        
        pdf.setFont("Helvetica", 12)
        pdf.setFillColor(colors.black)
        pdf.drawCentredString(
            self.width / 2,
            self.height - 1.3 * inch,
            "Industrial Engineering Students' Association"
        )
        pdf.drawCentredString(
            self.width / 2,
            self.height - 1.55 * inch,
            "University of Ibadan"
        )
        
        # Horizontal line with lime accent
        pdf.setStrokeColor(colors.HexColor("#C8F31D"))  # Lime
        pdf.setLineWidth(3)
        pdf.line(1 * inch, self.height - 1.85 * inch, self.width - 1 * inch, self.height - 1.85 * inch)
        
        # --- TICKET TITLE ---
        pdf.setFont("Helvetica-Bold", 20)
        pdf.setFillColor(colors.HexColor("#0F0F2D"))  # Navy
        pdf.drawCentredString(self.width / 2, self.height - 2.4 * inch, "EVENT TICKET")
        
        # Ticket number/reference
        pdf.setFont("Helvetica", 10)
        pdf.setFillColor(colors.grey)
        ticket_ref = ticket_number or reference
        pdf.drawCentredString(self.width / 2, self.height - 2.7 * inch, f"Ticket: {ticket_ref}")
        
        # --- EVENT DETAILS BOX ---
        y_position = self.height - 3.3 * inch
        left_margin = 1.2 * inch
        right_margin = self.width - 1.2 * inch
        
        # Draw colored box for event info
        pdf.setFillColor(colors.HexColor("#C8F31D"))  # Lime background
        pdf.setStrokeColor(colors.HexColor("#0F0F2D"))  # Navy border
        pdf.setLineWidth(2)
        box_height = 1.5 * inch
        pdf.roundRect(left_margin - 0.2 * inch, y_position - box_height, 
                     right_margin - left_margin + 0.4 * inch, box_height, 
                     10, stroke=1, fill=1)
        
        # Event title
        pdf.setFillColor(colors.HexColor("#0F0F2D"))
        pdf.setFont("Helvetica-Bold", 16)
        y_position -= 0.4 * inch
        
        # Wrap long event titles
        if len(event_title) > 40:
            words = event_title.split()
            lines = []
            current_line = []
            for word in words:
                current_line.append(word)
                if len(' '.join(current_line)) > 40:
                    current_line.pop()
                    lines.append(' '.join(current_line))
                    current_line = [word]
            if current_line:
                lines.append(' '.join(current_line))
            
            for line in lines[:2]:  # Max 2 lines
                pdf.drawCentredString(self.width / 2, y_position, line)
                y_position -= 0.25 * inch
        else:
            pdf.drawCentredString(self.width / 2, y_position, event_title)
            y_position -= 0.4 * inch
        
        # Event date and category
        pdf.setFont("Helvetica-Bold", 11)
        formatted_date = event_date.strftime("%B %d, %Y at %I:%M %p")
        pdf.drawCentredString(self.width / 2, y_position, formatted_date)
        y_position -= 0.3 * inch
        
        pdf.setFont("Helvetica", 10)
        pdf.drawCentredString(self.width / 2, y_position, f"{event_category} • {event_location}")
        
        # --- ATTENDEE INFORMATION ---
        y_position = self.height - 5.3 * inch
        pdf.setFillColor(colors.black)
        pdf.setFont("Helvetica-Bold", 12)
        pdf.drawString(left_margin, y_position, "ATTENDEE INFORMATION")
        
        pdf.setStrokeColor(colors.HexColor("#0F0F2D"))
        pdf.setLineWidth(1)
        pdf.line(left_margin, y_position - 5, right_margin, y_position - 5)
        y_position -= 0.35 * inch
        
        pdf.setFont("Helvetica", 10)
        details = [
            ("Name:", student_name),
            ("Email:", student_email),
            ("Level:", student_level),
        ]
        
        line_height = 0.25 * inch
        for label, value in details:
            pdf.setFont("Helvetica-Bold", 10)
            pdf.drawString(left_margin, y_position, label)
            pdf.setFont("Helvetica", 10)
            pdf.drawString(left_margin + 1.2 * inch, y_position, value)
            y_position -= line_height
        
        # --- QR CODE ---
        qr_data = f"IESA_EVENT:{event_id}|TICKET:{ticket_ref}|ATTENDEE:{student_email}"
        qr_buffer = self.generate_qr_code(qr_data)
        qr_image = ImageReader(qr_buffer)
        
        qr_size = 1.5 * inch
        qr_x = (self.width - qr_size) / 2
        qr_y = self.height - 8.5 * inch
        
        pdf.drawImage(qr_image, qr_x, qr_y, width=qr_size, height=qr_size)
        
        # QR code label
        pdf.setFont("Helvetica", 9)
        pdf.setFillColor(colors.grey)
        pdf.drawCentredString(self.width / 2, qr_y - 0.25 * inch, 
                             "Scan this QR code at the event entrance")
        
        # --- FOOTER ---
        footer_y = 0.8 * inch
        pdf.setFont("Helvetica", 8)
        pdf.setFillColor(colors.grey)
        pdf.drawCentredString(self.width / 2, footer_y, 
                             "This ticket is non-transferable. Present this ticket at the event.")
        pdf.drawCentredString(self.width / 2, footer_y - 0.2 * inch, 
                             "For support, contact: iesa@ui.edu.ng")
        
        # Add decorative elements
        pdf.setStrokeColor(colors.HexColor("#C8F31D"))
        pdf.setLineWidth(2)
        pdf.line(1 * inch, 0.5 * inch, self.width - 1 * inch, 0.5 * inch)
        
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
