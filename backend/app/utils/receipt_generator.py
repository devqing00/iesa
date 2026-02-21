"""
PDF Receipt Generator for IESA Payments

Generates professional PDF receipts with:
- IESA branding
- Student information
- Payment details
- QR code for verification
- Transaction reference

NOTE: Heavy imports (reportlab, qrcode) are lazy-loaded inside methods
to avoid consuming ~30-50MB on startup when receipts aren't being generated.
"""

from io import BytesIO
from datetime import datetime
from typing import Optional


class ReceiptGenerator:
    """Generate PDF receipts for payments"""
    
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
        """
        Generate a PDF receipt
        
        Args:
            transaction_id: Unique transaction ID
            reference: Payment reference
            student_name: Student's full name
            student_email: Student's email
            student_level: Student's level (e.g., "300")
            payment_title: Title of the payment
            amount: Amount paid (in Naira)
            paid_at: Payment datetime
            channel: Payment channel (e.g., "Paystack")
            payment_type: Type of payment
            
        Returns:
            BytesIO: PDF file as bytes
        """
        from reportlab.lib.units import inch
        from reportlab.lib import colors
        from reportlab.pdfgen import canvas

        buffer = BytesIO()
        
        # Create PDF document
        pdf = canvas.Canvas(buffer, pagesize=self.pagesize)
        pdf.setTitle(f"Payment Receipt - {reference}")
        
        # --- HEADER ---
        # IESA Title
        pdf.setFont("Helvetica-Bold", 24)
        pdf.setFillColor(colors.HexColor("#1E4528"))  # Dark green
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
            "University of Nigeria, Nsukka"
        )
        
        # Horizontal line
        pdf.setStrokeColor(colors.HexColor("#4CA868"))
        pdf.setLineWidth(2)
        pdf.line(1 * inch, self.height - 1.8 * inch, self.width - 1 * inch, self.height - 1.8 * inch)
        
        # --- RECEIPT TITLE ---
        pdf.setFont("Helvetica-Bold", 18)
        pdf.setFillColor(colors.HexColor("#1E4528"))
        pdf.drawCentredString(self.width / 2, self.height - 2.3 * inch, "PAYMENT RECEIPT")
        
        # --- RECEIPT NUMBER ---
        pdf.setFont("Helvetica", 10)
        pdf.setFillColor(colors.grey)
        pdf.drawCentredString(self.width / 2, self.height - 2.6 * inch, f"Receipt No: {reference}")
        
        # --- PAYMENT DETAILS TABLE ---
        y_position = self.height - 3.2 * inch
        left_margin = 1.2 * inch
        right_margin = self.width - 1.2 * inch
        line_height = 0.25 * inch
        
        pdf.setFillColor(colors.black)
        pdf.setFont("Helvetica-Bold", 11)
        
        # Student Information Section
        pdf.drawString(left_margin, y_position, "STUDENT INFORMATION")
        pdf.setLineWidth(0.5)
        pdf.line(left_margin, y_position - 5, right_margin, y_position - 5)
        y_position -= line_height
        
        pdf.setFont("Helvetica", 10)
        details = [
            ("Name:", student_name),
            ("Email:", student_email),
            ("Level:", student_level),
        ]
        
        for label, value in details:
            pdf.setFont("Helvetica-Bold", 10)
            pdf.drawString(left_margin, y_position, label)
            pdf.setFont("Helvetica", 10)
            pdf.drawString(left_margin + 1.5 * inch, y_position, value)
            y_position -= line_height
        
        y_position -= 0.2 * inch
        
        # Payment Information Section
        pdf.setFont("Helvetica-Bold", 11)
        pdf.drawString(left_margin, y_position, "PAYMENT DETAILS")
        pdf.line(left_margin, y_position - 5, right_margin, y_position - 5)
        y_position -= line_height
        
        payment_details = [
            ("Payment Type:", payment_type),
            ("Description:", payment_title),
            ("Payment Method:", channel),
            ("Transaction Ref:", reference),
            ("Date & Time:", paid_at.strftime("%B %d, %Y at %I:%M %p")),
        ]
        
        for label, value in payment_details:
            pdf.setFont("Helvetica-Bold", 10)
            pdf.drawString(left_margin, y_position, label)
            pdf.setFont("Helvetica", 10)
            pdf.drawString(left_margin + 1.5 * inch, y_position, value)
            y_position -= line_height
        
        y_position -= 0.3 * inch
        
        # --- AMOUNT BOX ---
        box_height = 0.8 * inch
        box_y = y_position - box_height
        
        pdf.setFillColor(colors.HexColor("#E8F5E9"))  # Light green background
        pdf.rect(left_margin - 0.1 * inch, box_y, right_margin - left_margin + 0.2 * inch, box_height, fill=True, stroke=False)
        
        pdf.setStrokeColor(colors.HexColor("#4CA868"))
        pdf.setLineWidth(1.5)
        pdf.rect(left_margin - 0.1 * inch, box_y, right_margin - left_margin + 0.2 * inch, box_height, fill=False, stroke=True)
        
        pdf.setFillColor(colors.black)
        pdf.setFont("Helvetica-Bold", 12)
        pdf.drawString(left_margin, y_position - 0.3 * inch, "TOTAL AMOUNT PAID:")
        
        pdf.setFont("Helvetica-Bold", 24)
        pdf.setFillColor(colors.HexColor("#1E4528"))
        amount_text = f"₦{amount:,.2f}"
        pdf.drawRightString(right_margin, y_position - 0.35 * inch, amount_text)
        
        y_position = box_y - 0.4 * inch
        
        # --- QR CODE ---
        # Generate QR code with verification data
        qr_data = f"IESA-RECEIPT|{reference}|{amount}|{paid_at.isoformat()}"
        qr_buffer = self.generate_qr_code(qr_data)
        
        # Draw QR code
        qr_size = 1.2 * inch
        qr_x = self.width - 2 * inch
        qr_y = 1.5 * inch
        
        pdf.drawImage(
            qr_buffer,
            qr_x,
            qr_y,
            width=qr_size,
            height=qr_size,
            preserveAspectRatio=True,
            mask='auto'
        )
        
        pdf.setFont("Helvetica", 8)
        pdf.setFillColor(colors.grey)
        pdf.drawCentredString(qr_x + qr_size / 2, qr_y - 0.15 * inch, "Scan to verify")
        
        # --- STATUS STAMP ---
        pdf.setFont("Helvetica-Bold", 14)
        pdf.setFillColor(colors.HexColor("#4CA868"))
        pdf.drawString(1.2 * inch, 2 * inch, "STATUS: PAID ✓")
        
        # --- FOOTER ---
        footer_y = 0.8 * inch
        pdf.setFont("Helvetica-Oblique", 9)
        pdf.setFillColor(colors.grey)
        pdf.drawCentredString(
            self.width / 2,
            footer_y,
            "This is an electronically generated receipt and does not require a signature."
        )
        
        pdf.setFont("Helvetica", 8)
        pdf.drawCentredString(
            self.width / 2,
            footer_y - 0.2 * inch,
            "For inquiries, contact: iesa@unn.edu.ng | Generated on " + datetime.now().strftime("%B %d, %Y")
        )
        
        # Horizontal line at bottom
        pdf.setStrokeColor(colors.HexColor("#4CA868"))
        pdf.setLineWidth(1)
        pdf.line(1 * inch, 0.5 * inch, self.width - 1 * inch, 0.5 * inch)
        
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
