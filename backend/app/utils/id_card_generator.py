"""
Digital ID Card Generator for IESA Students

Generates student ID cards with:
- Student information
- Photo placeholder
- QR code for verification
- Payment status indicator
- Academic session info
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from io import BytesIO
from datetime import datetime
import qrcode
from typing import Optional


class IDCardGenerator:
    """Generate digital ID cards for students"""
    
    # Standard ID card size (CR80 - credit card size scaled up)
    CARD_WIDTH = 3.375 * inch
    CARD_HEIGHT = 2.125 * inch
    
    def __init__(self):
        self.pagesize = (self.CARD_WIDTH, self.CARD_HEIGHT)
        
    def generate_qr_code(self, data: str) -> BytesIO:
        """Generate QR code as BytesIO"""
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=1,
        )
        qr.add_data(data)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        return buffer
    
    def generate_id_card(
        self,
        student_id: str,
        matric_number: str,
        full_name: str,
        level: str,
        department: str,
        session: str,
        payment_status: str = "Not Paid",
        photo_url: Optional[str] = None
    ) -> BytesIO:
        """
        Generate a digital ID card
        
        Args:
            student_id: Unique student ID
            matric_number: Student's matriculation number
            full_name: Student's full name
            level: Current level (e.g., "300")
            department: Department name
            session: Academic session (e.g., "2025/2026")
            payment_status: Payment status ("Paid" or "Not Paid")
            photo_url: URL to student's photo (optional)
            
        Returns:
            BytesIO: PDF file as bytes
        """
        buffer = BytesIO()
        
        # Create PDF document
        pdf = canvas.Canvas(buffer, pagesize=self.pagesize)
        pdf.setTitle(f"ID Card - {matric_number}")
        
        # --- CARD BACKGROUND ---
        # Main card background (light green)
        pdf.setFillColor(colors.HexColor("#E8F5E9"))
        pdf.rect(0, 0, self.CARD_WIDTH, self.CARD_HEIGHT, fill=True, stroke=False)
        
        # Top header bar (dark green)
        header_height = 0.5 * inch
        pdf.setFillColor(colors.HexColor("#1E4528"))
        pdf.rect(0, self.CARD_HEIGHT - header_height, self.CARD_WIDTH, header_height, fill=True, stroke=False)
        
        # Bottom status bar
        status_height = 0.3 * inch
        if payment_status.lower() == "paid":
            pdf.setFillColor(colors.HexColor("#4CA868"))  # Green for paid
        else:
            pdf.setFillColor(colors.HexColor("#FF6B6B"))  # Red for unpaid
        pdf.rect(0, 0, self.CARD_WIDTH, status_height, fill=True, stroke=False)
        
        # --- HEADER TEXT ---
        pdf.setFillColor(colors.white)
        pdf.setFont("Helvetica-Bold", 14)
        pdf.drawCentredString(self.CARD_WIDTH / 2, self.CARD_HEIGHT - 0.22 * inch, "IESA")
        
        pdf.setFont("Helvetica", 7)
        pdf.drawCentredString(
            self.CARD_WIDTH / 2,
            self.CARD_HEIGHT - 0.35 * inch,
            "Industrial Engineering Students' Association"
        )
        
        # --- PHOTO PLACEHOLDER ---
        photo_size = 0.9 * inch
        photo_x = 0.15 * inch
        photo_y = self.CARD_HEIGHT - header_height - photo_size - 0.15 * inch
        
        # Draw photo border/placeholder
        pdf.setStrokeColor(colors.HexColor("#1E4528"))
        pdf.setLineWidth(2)
        pdf.setFillColor(colors.HexColor("#FFFFFF"))
        pdf.rect(photo_x, photo_y, photo_size, photo_size, fill=True, stroke=True)
        
        # Placeholder text if no photo
        if not photo_url:
            pdf.setFillColor(colors.grey)
            pdf.setFont("Helvetica", 8)
            pdf.drawCentredString(
                photo_x + photo_size / 2,
                photo_y + photo_size / 2 - 0.05 * inch,
                "PHOTO"
            )
        
        # --- STUDENT INFORMATION ---
        info_x = photo_x + photo_size + 0.15 * inch
        info_y = self.CARD_HEIGHT - header_height - 0.2 * inch
        line_height = 0.15 * inch
        
        pdf.setFillColor(colors.HexColor("#1E4528"))
        
        # Name
        pdf.setFont("Helvetica-Bold", 10)
        pdf.drawString(info_x, info_y, full_name.upper())
        info_y -= line_height
        
        # Matric Number
        pdf.setFont("Helvetica", 8)
        pdf.drawString(info_x, info_y, f"Matric: {matric_number}")
        info_y -= line_height * 0.8
        
        # Level
        pdf.drawString(info_x, info_y, f"Level: {level}")
        info_y -= line_height * 0.8
        
        # Department
        pdf.setFont("Helvetica", 7)
        pdf.drawString(info_x, info_y, department[:25])  # Truncate if too long
        info_y -= line_height * 0.8
        
        # Session
        pdf.drawString(info_x, info_y, f"Session: {session}")
        
        # --- QR CODE ---
        # Generate QR code with verification data
        qr_data = f"IESA|{student_id}|{matric_number}|{level}|{payment_status}"
        qr_buffer = self.generate_qr_code(qr_data)
        
        qr_size = 0.75 * inch
        qr_x = self.CARD_WIDTH - qr_size - 0.12 * inch
        qr_y = 0.4 * inch
        
        # Use ImageReader to properly handle the BytesIO object
        pdf.drawImage(
            ImageReader(qr_buffer),
            qr_x,
            qr_y,
            width=qr_size,
            height=qr_size,
            preserveAspectRatio=True,
            mask='auto'
        )
        
        # --- STATUS BAR TEXT ---
        pdf.setFillColor(colors.white)
        pdf.setFont("Helvetica-Bold", 9)
        status_text = f"DUES: {payment_status.upper()}"
        pdf.drawCentredString(self.CARD_WIDTH / 2, 0.1 * inch, status_text)
        
        # --- CARD BORDER ---
        pdf.setStrokeColor(colors.HexColor("#1E4528"))
        pdf.setLineWidth(3)
        pdf.rect(0, 0, self.CARD_WIDTH, self.CARD_HEIGHT, fill=False, stroke=True)
        
        # Save PDF
        pdf.showPage()
        pdf.save()
        
        buffer.seek(0)
        return buffer


# Singleton instance
id_card_generator = IDCardGenerator()


def generate_student_id_card(
    student_id: str,
    matric_number: str,
    full_name: str,
    level: str,
    department: str = "Industrial Engineering",
    session: str = "2025/2026",
    payment_status: str = "Not Paid",
    photo_url: Optional[str] = None
) -> BytesIO:
    """
    Generate a student ID card
    
    Convenience function that uses the global id_card_generator instance.
    """
    return id_card_generator.generate_id_card(
        student_id=student_id,
        matric_number=matric_number,
        full_name=full_name,
        level=level,
        department=department,
        session=session,
        payment_status=payment_status,
        photo_url=photo_url
    )
