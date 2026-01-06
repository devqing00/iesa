"""
Premium Digital ID Card Generator for IESA Students

Generates premium student ID cards with:
- Modern gradient design matching frontend preview
- Student information with elegant typography
- High-quality photo integration
- QR code for verification
- Payment status indicator with glow effect
- Professional IESA branding
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.graphics.shapes import Drawing, Rect, Circle
from io import BytesIO
from datetime import datetime
import qrcode
from typing import Optional
import requests
from PIL import Image


class IDCardGenerator:
    """Generate premium digital ID cards for students"""
    
    # Standard ID card size (CR80 - credit card size scaled up for better quality)
    CARD_WIDTH = 3.375 * inch
    CARD_HEIGHT = 2.125 * inch
    
    # Premium color palette
    COLORS = {
        'bg_dark': '#0f2818',
        'bg_mid': '#1a3d28',
        'bg_light': '#0d1f14',
        'accent_emerald': '#10b981',
        'accent_teal': '#14b8a6',
        'status_paid': '#4ade80',
        'status_unpaid': '#f87171',
        'white': '#ffffff',
        'white_80': '#ffffffcc',
        'white_50': '#ffffff80',
        'white_40': '#ffffff66',
        'white_20': '#ffffff33',
        'white_10': '#ffffff1a',
        'white_05': '#ffffff0d',
    }
    
    def __init__(self):
        self.pagesize = (self.CARD_WIDTH, self.CARD_HEIGHT)
        
    def generate_qr_code(self, data: str) -> BytesIO:
        """Generate QR code as BytesIO with premium styling"""
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=1,
        )
        qr.add_data(data)
        qr.make(fit=True)
        
        # Use dark green color matching the card theme
        img = qr.make_image(fill_color="#1a3d28", back_color="white")
        
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        return buffer
    
    def _draw_gradient_background(self, pdf):
        """Draw premium gradient background with mesh effect"""
        # Base gradient from dark to mid-dark green
        gradient_colors = [
            '#0f2818',
            '#112a1c',
            '#142f20',
            '#173424',
            '#1a3928',
            '#1a3d28',
            '#183a26',
            '#163724',
            '#143422',
            '#0d1f14',
        ]
        
        rect_height = self.CARD_HEIGHT / len(gradient_colors)
        
        for i, color in enumerate(gradient_colors):
            pdf.setFillColor(colors.HexColor(color))
            pdf.rect(
                0, 
                self.CARD_HEIGHT - (i + 1) * rect_height, 
                self.CARD_WIDTH, 
                rect_height + 1,  # +1 to prevent gaps
                fill=True, 
                stroke=False
            )
        
        # Add subtle mesh/glow effects using semi-transparent circles
        # Top right emerald glow
        pdf.setFillColorRGB(0.063, 0.725, 0.506, alpha=0.08)  # emerald-500
        pdf.circle(
            self.CARD_WIDTH * 0.9, 
            self.CARD_HEIGHT * 0.85, 
            0.8 * inch, 
            fill=True, 
            stroke=False
        )
        
        # Bottom left teal glow
        pdf.setFillColorRGB(0.078, 0.722, 0.651, alpha=0.06)  # teal-500
        pdf.circle(
            self.CARD_WIDTH * 0.1, 
            self.CARD_HEIGHT * 0.15, 
            0.6 * inch, 
            fill=True, 
            stroke=False
        )
        
        # Center subtle glow
        pdf.setFillColorRGB(0.063, 0.725, 0.506, alpha=0.04)
        pdf.circle(
            self.CARD_WIDTH * 0.5, 
            self.CARD_HEIGHT * 0.5, 
            0.5 * inch, 
            fill=True, 
            stroke=False
        )
    
    def _draw_geometric_pattern(self, pdf):
        """Draw subtle geometric grid pattern"""
        pdf.setStrokeColorRGB(1, 1, 1, alpha=0.02)
        pdf.setLineWidth(0.3)
        
        # Draw grid lines
        grid_size = 0.15 * inch
        
        for x in range(int(self.CARD_WIDTH / grid_size) + 1):
            x_pos = x * grid_size
            pdf.line(x_pos, 0, x_pos, self.CARD_HEIGHT)
        
        for y in range(int(self.CARD_HEIGHT / grid_size) + 1):
            y_pos = y * grid_size
            pdf.line(0, y_pos, self.CARD_WIDTH, y_pos)
    
    def _draw_card_border(self, pdf):
        """Draw premium double border with glow effect"""
        # Outer border
        pdf.setStrokeColorRGB(1, 1, 1, alpha=0.1)
        pdf.setLineWidth(2)
        pdf.roundRect(
            0.02 * inch, 
            0.02 * inch, 
            self.CARD_WIDTH - 0.04 * inch, 
            self.CARD_HEIGHT - 0.04 * inch, 
            0.15 * inch, 
            fill=False, 
            stroke=True
        )
        
        # Inner border
        pdf.setStrokeColorRGB(1, 1, 1, alpha=0.05)
        pdf.setLineWidth(1)
        pdf.roundRect(
            0.05 * inch, 
            0.05 * inch, 
            self.CARD_WIDTH - 0.1 * inch, 
            self.CARD_HEIGHT - 0.1 * inch, 
            0.12 * inch, 
            fill=False, 
            stroke=True
        )
    
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
        Generate a premium digital ID card
        
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
        pdf = canvas.Canvas(buffer, pagesize=self.pagesize)
        pdf.setTitle(f"IESA ID Card - {matric_number}")
        
        # === DRAW BACKGROUND ===
        self._draw_gradient_background(pdf)
        self._draw_geometric_pattern(pdf)
        
        # === HEADER SECTION ===
        header_y = self.CARD_HEIGHT - 0.35 * inch
        
        # Logo container (glassmorphism effect)
        logo_size = 0.38 * inch
        logo_x = 0.2 * inch
        logo_y = header_y - logo_size / 2 - 0.05 * inch
        
        # Logo background with gradient effect
        pdf.setFillColorRGB(1, 1, 1, alpha=0.15)
        pdf.roundRect(logo_x, logo_y, logo_size, logo_size, 0.08 * inch, fill=True, stroke=False)
        
        # Logo border
        pdf.setStrokeColorRGB(1, 1, 1, alpha=0.2)
        pdf.setLineWidth(1)
        pdf.roundRect(logo_x, logo_y, logo_size, logo_size, 0.08 * inch, fill=False, stroke=True)
        
        # Logo text "IE"
        pdf.setFillColor(colors.white)
        pdf.setFont("Helvetica-Bold", 11)
        pdf.drawCentredString(logo_x + logo_size / 2, logo_y + logo_size / 2 - 0.05 * inch, "IE")
        
        # IESA branding text
        brand_x = logo_x + logo_size + 0.12 * inch
        pdf.setFillColor(colors.white)
        pdf.setFont("Helvetica-Bold", 12)
        pdf.drawString(brand_x, header_y + 0.02 * inch, "IESA")
        
        pdf.setFont("Helvetica", 5)
        pdf.setFillColorRGB(1, 1, 1, alpha=0.5)
        pdf.drawString(brand_x, header_y - 0.1 * inch, "STUDENT IDENTITY")
        
        # QR Code (premium white background)
        qr_data = f"IESA|{student_id}|{matric_number}|{level}|{payment_status}"
        qr_buffer = self.generate_qr_code(qr_data)
        
        qr_size = 0.55 * inch
        qr_padding = 0.06 * inch
        qr_x = self.CARD_WIDTH - qr_size - qr_padding - 0.15 * inch
        qr_y = header_y - qr_size / 2 - 0.05 * inch
        
        # QR code white container with shadow effect
        pdf.setFillColor(colors.white)
        pdf.roundRect(
            qr_x - qr_padding, 
            qr_y - qr_padding, 
            qr_size + qr_padding * 2, 
            qr_size + qr_padding * 2, 
            0.08 * inch, 
            fill=True, 
            stroke=False
        )
        
        # Draw QR code
        pdf.drawImage(
            ImageReader(qr_buffer),
            qr_x,
            qr_y,
            width=qr_size,
            height=qr_size,
            preserveAspectRatio=True,
            mask='auto'
        )
        
        # === MAIN CONTENT AREA ===
        content_y = self.CARD_HEIGHT - 0.82 * inch
        
        # Photo area
        photo_width = 0.72 * inch
        photo_height = 0.88 * inch
        photo_x = 0.22 * inch
        photo_y = content_y - photo_height
        
        # Photo container with gradient border
        pdf.setFillColorRGB(1, 1, 1, alpha=0.1)
        pdf.setStrokeColorRGB(1, 1, 1, alpha=0.2)
        pdf.setLineWidth(2)
        pdf.roundRect(
            photo_x, 
            photo_y, 
            photo_width, 
            photo_height, 
            0.08 * inch, 
            fill=True, 
            stroke=True
        )
        
        # Try to load and embed photo
        photo_embedded = False
        if photo_url:
            try:
                response = requests.get(photo_url, timeout=5)
                if response.status_code == 200:
                    img_buffer = BytesIO(response.content)
                    img = Image.open(img_buffer)
                    
                    if img.mode != 'RGB':
                        img = img.convert('RGB')
                    
                    final_buffer = BytesIO()
                    img.save(final_buffer, format='JPEG')
                    final_buffer.seek(0)
                    
                    # Draw image with padding
                    padding = 0.04 * inch
                    pdf.drawImage(
                        ImageReader(final_buffer),
                        photo_x + padding,
                        photo_y + padding,
                        width=photo_width - padding * 2,
                        height=photo_height - padding * 2,
                        preserveAspectRatio=True,
                        mask='auto'
                    )
                    photo_embedded = True
            except Exception as e:
                print(f"Error loading photo: {e}")
        
        # Placeholder if no photo
        if not photo_embedded:
            pdf.setFillColorRGB(1, 1, 1, alpha=0.4)
            pdf.setFont("Helvetica", 8)
            pdf.drawCentredString(
                photo_x + photo_width / 2,
                photo_y + photo_height / 2 - 0.05 * inch,
                "PHOTO"
            )
        
        # Photo accent dot (bottom right)
        accent_dot_size = 0.08 * inch
        pdf.setFillColor(colors.HexColor('#4ade80'))  # emerald-400
        pdf.circle(
            photo_x + photo_width - 0.02 * inch,
            photo_y + 0.02 * inch,
            accent_dot_size / 2,
            fill=True,
            stroke=False
        )
        
        # === STUDENT INFORMATION ===
        info_x = photo_x + photo_width + 0.18 * inch
        info_y = content_y - 0.08 * inch
        line_spacing = 0.18 * inch
        
        # Full Name
        pdf.setFont("Helvetica", 5)
        pdf.setFillColorRGB(1, 1, 1, alpha=0.4)
        pdf.drawString(info_x, info_y, "FULL NAME")
        
        info_y -= 0.1 * inch
        pdf.setFont("Helvetica-Bold", 9)
        pdf.setFillColor(colors.white)
        # Truncate name if too long
        display_name = full_name[:24] if len(full_name) > 24 else full_name
        pdf.drawString(info_x, info_y, display_name.upper())
        
        info_y -= line_spacing
        
        # Matric Number
        pdf.setFont("Helvetica", 5)
        pdf.setFillColorRGB(1, 1, 1, alpha=0.4)
        pdf.drawString(info_x, info_y, "MATRIC NUMBER")
        
        info_y -= 0.1 * inch
        pdf.setFont("Helvetica-Bold", 8)
        pdf.setFillColor(colors.white)
        pdf.drawString(info_x, info_y, matric_number)
        
        info_y -= line_spacing
        
        # Level and Session (side by side)
        col1_x = info_x
        col2_x = info_x + 0.65 * inch
        
        # Level
        pdf.setFont("Helvetica", 5)
        pdf.setFillColorRGB(1, 1, 1, alpha=0.4)
        pdf.drawString(col1_x, info_y, "LEVEL")
        
        pdf.setFont("Helvetica", 5)
        pdf.setFillColorRGB(1, 1, 1, alpha=0.4)
        pdf.drawString(col2_x, info_y, "SESSION")
        
        info_y -= 0.1 * inch
        pdf.setFont("Helvetica-Bold", 8)
        pdf.setFillColor(colors.white)
        pdf.drawString(col1_x, info_y, str(level))
        pdf.drawString(col2_x, info_y, session)
        
        # === FOOTER SECTION ===
        footer_y = 0.22 * inch
        
        # Separator line
        pdf.setStrokeColorRGB(1, 1, 1, alpha=0.1)
        pdf.setLineWidth(0.5)
        pdf.line(0.2 * inch, footer_y + 0.12 * inch, self.CARD_WIDTH - 0.2 * inch, footer_y + 0.12 * inch)
        
        # Payment status with glow effect
        status_dot_x = 0.28 * inch
        is_paid = payment_status.lower() == "paid"
        
        # Status glow (outer)
        if is_paid:
            pdf.setFillColorRGB(0.294, 0.871, 0.502, alpha=0.3)  # emerald glow
        else:
            pdf.setFillColorRGB(0.973, 0.443, 0.443, alpha=0.3)  # red glow
        pdf.circle(status_dot_x, footer_y, 0.06 * inch, fill=True, stroke=False)
        
        # Status dot (inner)
        if is_paid:
            pdf.setFillColor(colors.HexColor('#4ade80'))
        else:
            pdf.setFillColor(colors.HexColor('#f87171'))
        pdf.circle(status_dot_x, footer_y, 0.04 * inch, fill=True, stroke=False)
        
        # Status text
        pdf.setFont("Helvetica-Bold", 6.5)
        if is_paid:
            pdf.setFillColor(colors.HexColor('#4ade80'))
            pdf.drawString(status_dot_x + 0.1 * inch, footer_y - 0.025 * inch, "Dues Paid")
        else:
            pdf.setFillColor(colors.HexColor('#f87171'))
            pdf.drawString(status_dot_x + 0.1 * inch, footer_y - 0.025 * inch, "Payment Pending")
        
        # Validity on the right
        current_year = datetime.now().year
        pdf.setFont("Helvetica", 5.5)
        pdf.setFillColorRGB(1, 1, 1, alpha=0.4)
        valid_text = f"Valid: {current_year}/{current_year + 1}"
        pdf.drawRightString(self.CARD_WIDTH - 0.22 * inch, footer_y - 0.02 * inch, valid_text)
        
        # === DRAW CARD BORDER ===
        self._draw_card_border(pdf)
        
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
