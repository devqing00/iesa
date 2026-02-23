"""
PDF Receipt Generator for IESA Payments

Generates professional PDF receipts with:
- IESA logo and branding
- Student information
- Payment details
- QR code for verification
- Transaction reference
- Modern card-based layout

NOTE: Heavy imports (reportlab, qrcode) are lazy-loaded inside methods
to avoid consuming ~30-50MB on startup when receipts aren't being generated.
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


class ReceiptGenerator:
    """Generate PDF receipts for payments"""

    # Brand colors
    NAVY = "#0F0F2D"
    LIME = "#C8F31D"
    TEAL = "#4CA868"
    TEAL_LIGHT = "#E8F5E9"
    GHOST = "#F8F8FC"
    CORAL = "#E06050"

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

    def generate_receipt(
        self,
        transaction_id: str,
        reference: str,
        student_name: str,
        student_email: str,
        student_level: str,
        payment_title: str,
        amount: float,
        paid_at: datetime,
        channel: str = "Paystack",
        payment_type: str = "Departmental Dues"
    ) -> BytesIO:
        """Generate a professional PDF receipt."""
        from reportlab.lib.units import inch, mm
        from reportlab.lib import colors
        from reportlab.pdfgen import canvas
        from reportlab.lib.utils import ImageReader

        buffer = BytesIO()
        pdf = canvas.Canvas(buffer, pagesize=self.pagesize)
        pdf.setTitle(f"Payment Receipt - {reference}")

        W = self.width
        H = self.height
        left = 1 * inch
        right = W - 1 * inch
        content_w = right - left

        # ═══════════════════════════════════════════════════════
        # BACKGROUND — subtle off-white
        # ═══════════════════════════════════════════════════════
        pdf.setFillColor(colors.HexColor(self.GHOST))
        pdf.rect(0, 0, W, H, fill=True, stroke=False)

        # ═══════════════════════════════════════════════════════
        # HEADER BAR — navy strip at top
        # ═══════════════════════════════════════════════════════
        header_h = 1.4 * inch
        pdf.setFillColor(colors.HexColor(self.NAVY))
        pdf.rect(0, H - header_h, W, header_h, fill=True, stroke=False)

        # Lime accent bar under header
        accent_h = 4 * mm
        pdf.setFillColor(colors.HexColor(self.LIME))
        pdf.rect(0, H - header_h - accent_h, W, accent_h, fill=True, stroke=False)

        # Logo (if available)
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

        # Receipt title — right side of header
        pdf.setFillColor(colors.HexColor(self.LIME))
        pdf.setFont("Helvetica-Bold", 16)
        pdf.drawRightString(right, logo_y + 0.55 * inch, "PAYMENT RECEIPT")

        pdf.setFillColor(colors.white)
        pdf.setFont("Helvetica", 9)
        pdf.drawRightString(right, logo_y + 0.32 * inch, f"Receipt No: {reference}")
        pdf.drawRightString(right, logo_y + 0.12 * inch, f"Date: {paid_at.strftime('%B %d, %Y')}")

        # ═══════════════════════════════════════════════════════
        # MAIN CONTENT CARD — white rounded rect
        # ═══════════════════════════════════════════════════════
        card_top = H - header_h - accent_h - 0.3 * inch
        card_bottom = 1.8 * inch
        card_h = card_top - card_bottom
        card_x = left - 0.1 * inch
        card_w = content_w + 0.2 * inch

        # Card shadow
        pdf.setFillColor(colors.HexColor("#DDDDDD"))
        pdf.roundRect(card_x + 3, card_bottom - 3, card_w, card_h, 12, fill=True, stroke=False)

        # Card body
        pdf.setFillColor(colors.white)
        pdf.setStrokeColor(colors.HexColor("#E0E0E0"))
        pdf.setLineWidth(0.5)
        pdf.roundRect(card_x, card_bottom, card_w, card_h, 12, fill=True, stroke=True)

        # ── Student Information Section ──
        y = card_top - 0.35 * inch
        section_x = left + 0.1 * inch

        # Section header with teal accent
        pdf.setFillColor(colors.HexColor(self.TEAL))
        pdf.rect(section_x, y - 2, 3, 14, fill=True, stroke=False)
        pdf.setFillColor(colors.HexColor(self.NAVY))
        pdf.setFont("Helvetica-Bold", 11)
        pdf.drawString(section_x + 10, y, "STUDENT INFORMATION")

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
            pdf.drawString(section_x + 1.3 * inch, y, str(value))
            y -= 0.24 * inch

        # ── Payment Details Section ──
        y -= 0.15 * inch
        pdf.setFillColor(colors.HexColor(self.CORAL))
        pdf.rect(section_x, y - 2, 3, 14, fill=True, stroke=False)
        pdf.setFillColor(colors.HexColor(self.NAVY))
        pdf.setFont("Helvetica-Bold", 11)
        pdf.drawString(section_x + 10, y, "PAYMENT DETAILS")

        y -= 0.1 * inch
        pdf.setStrokeColor(colors.HexColor("#E8E8E8"))
        pdf.line(section_x, y, right - 0.1 * inch, y)

        y -= 0.28 * inch
        payment_details = [
            ("Category", payment_type),
            ("Description", payment_title),
            ("Method", channel),
            ("Reference", reference),
            ("Date & Time", paid_at.strftime("%B %d, %Y at %I:%M %p")),
        ]
        for label, value in payment_details:
            pdf.setFont("Helvetica", 9)
            pdf.setFillColor(colors.HexColor("#888888"))
            pdf.drawString(section_x, y, label)
            pdf.setFont("Helvetica-Bold", 10)
            pdf.setFillColor(colors.HexColor(self.NAVY))
            # Truncate long values
            display_val = str(value)
            if len(display_val) > 50:
                display_val = display_val[:47] + "..."
            pdf.drawString(section_x + 1.3 * inch, y, display_val)
            y -= 0.24 * inch

        # ── Amount Box ──
        y -= 0.2 * inch
        amount_box_h = 0.7 * inch
        amount_box_y = y - amount_box_h + 0.1 * inch

        # Green background box
        pdf.setFillColor(colors.HexColor(self.TEAL_LIGHT))
        pdf.setStrokeColor(colors.HexColor(self.TEAL))
        pdf.setLineWidth(1.5)
        pdf.roundRect(section_x, amount_box_y, content_w - 0.2 * inch, amount_box_h, 8, fill=True, stroke=True)

        # Label
        pdf.setFont("Helvetica-Bold", 11)
        pdf.setFillColor(colors.HexColor(self.NAVY))
        pdf.drawString(section_x + 12, amount_box_y + amount_box_h - 0.28 * inch, "TOTAL AMOUNT PAID")

        # Amount
        pdf.setFont("Helvetica-Bold", 26)
        pdf.setFillColor(colors.HexColor(self.NAVY))
        amount_text = f"₦{amount:,.2f}"
        pdf.drawRightString(right - 0.2 * inch, amount_box_y + amount_box_h - 0.48 * inch, amount_text)

        # ── Status Badge ──
        y = amount_box_y - 0.35 * inch
        badge_w = 1.6 * inch
        badge_h = 0.3 * inch
        pdf.setFillColor(colors.HexColor(self.TEAL))
        pdf.roundRect(section_x, y, badge_w, badge_h, 6, fill=True, stroke=False)
        pdf.setFillColor(colors.white)
        pdf.setFont("Helvetica-Bold", 10)
        pdf.drawCentredString(section_x + badge_w / 2, y + 0.08 * inch, "PAID SUCCESSFULLY")

        # ═══════════════════════════════════════════════════════
        # QR CODE — bottom right
        # ═══════════════════════════════════════════════════════
        qr_data = f"IESA-RECEIPT|{reference}|{amount}|{paid_at.isoformat()}"
        qr_buffer = self.generate_qr_code(qr_data)
        qr_image = ImageReader(qr_buffer)

        qr_size = 1.0 * inch
        qr_x = right - qr_size
        qr_y = 0.5 * inch

        pdf.drawImage(qr_image, qr_x, qr_y, width=qr_size, height=qr_size,
                       preserveAspectRatio=True, mask='auto')

        pdf.setFont("Helvetica", 7)
        pdf.setFillColor(colors.HexColor("#999999"))
        pdf.drawCentredString(qr_x + qr_size / 2, qr_y - 0.12 * inch, "Scan to verify")

        # ═══════════════════════════════════════════════════════
        # FOOTER
        # ═══════════════════════════════════════════════════════
        footer_y = 1.1 * inch
        pdf.setFont("Helvetica-Oblique", 8)
        pdf.setFillColor(colors.HexColor("#999999"))
        pdf.drawString(left, footer_y,
                      "This is an electronically generated receipt and does not require a signature.")

        pdf.setFont("Helvetica", 7)
        pdf.drawString(left, footer_y - 0.18 * inch,
                      f"IESA · University of Ibadan · iesa@ui.edu.ng · Generated {datetime.now().strftime('%B %d, %Y')}")

        # Bottom accent line
        pdf.setStrokeColor(colors.HexColor(self.NAVY))
        pdf.setLineWidth(2)
        pdf.line(0, 0.3 * inch, W, 0.3 * inch)
        pdf.setStrokeColor(colors.HexColor(self.LIME))
        pdf.setLineWidth(1)
        pdf.line(0, 0.25 * inch, W, 0.25 * inch)

        # Save PDF
        pdf.showPage()
        pdf.save()

        buffer.seek(0)
        return buffer


# Lazy singleton — only created when first receipt is generated
_receipt_generator = None


def generate_payment_receipt(
    transaction_id: str,
    reference: str,
    student_name: str,
    student_email: str,
    student_level: str,
    payment_title: str,
    amount: float,
    paid_at: datetime,
    channel: str = "Paystack",
    payment_type: str = "Departmental Dues"
) -> BytesIO:
    """
    Generate a payment receipt PDF
    
    Convenience function that uses a lazy singleton ReceiptGenerator.
    """
    global _receipt_generator
    if _receipt_generator is None:
        _receipt_generator = ReceiptGenerator()
    
    return _receipt_generator.generate_receipt(
        transaction_id=transaction_id,
        reference=reference,
        student_name=student_name,
        student_email=student_email,
        student_level=student_level,
        payment_title=payment_title,
        amount=amount,
        paid_at=paid_at,
        channel=channel,
        payment_type=payment_type
    )
