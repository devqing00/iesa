"""
PDF Report Generator for Paid Students

Generates a tabular PDF report listing all students who have paid a specific due,
with payment details, method, and reference.

NOTE: Heavy imports (reportlab) are lazy-loaded.
"""

from io import BytesIO
from datetime import datetime
from typing import List, Optional
import os


_LOGO_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))),
    "public", "assets", "images", "logo.png"
)


class PaidStudentsReportGenerator:
    """Generate PDF report of paid students"""

    NAVY = "#0F0F2D"
    LIME = "#C8F31D"
    TEAL = "#4CA868"
    GHOST = "#F8F8FC"
    CORAL = "#E06050"

    def __init__(self):
        from reportlab.lib.pagesizes import A4, landscape
        self.pagesize = landscape(A4)
        self.width, self.height = self.pagesize

    def generate_report(
        self,
        payment_title: str,
        payment_amount: float,
        payment_category: str,
        rows: List[dict],
        generated_at: Optional[datetime] = None,
    ) -> BytesIO:
        """Generate a PDF report with a table of paid students."""
        from reportlab.lib.units import inch
        from reportlab.lib import colors
        from reportlab.pdfgen import canvas
        from reportlab.lib.utils import ImageReader

        buffer = BytesIO()
        pdf = canvas.Canvas(buffer, pagesize=self.pagesize)
        pdf.setTitle(f"Paid Students - {payment_title}")

        W = self.width
        H = self.height
        margin = 0.6 * inch
        gen_time = generated_at or datetime.now()

        def draw_header(page_num: int = 1):
            """Draw page header."""
            # Background
            pdf.setFillColor(colors.HexColor(self.GHOST))
            pdf.rect(0, 0, W, H, fill=True, stroke=False)

            # Header band
            header_h = 55
            pdf.setFillColor(colors.HexColor(self.NAVY))
            pdf.roundRect(margin, H - margin - header_h, W - 2 * margin, header_h, 10, fill=True, stroke=False)

            # Logo
            try:
                if os.path.exists(_LOGO_PATH):
                    logo = ImageReader(_LOGO_PATH)
                    pdf.drawImage(logo, margin + 10, H - margin - header_h + 8, width=38, height=38, mask="auto")
            except Exception:
                pass

            # Title
            pdf.setFillColor(colors.white)
            pdf.setFont("Helvetica-Bold", 16)
            pdf.drawString(margin + 55, H - margin - 25, f"PAYMENT REPORT: {payment_title}")

            pdf.setFont("Helvetica", 9)
            amount_str = f"₦{payment_amount:,.2f}" if payment_amount else ""
            sub = f"{payment_category}  •  {amount_str}  •  {len(rows)} student{'s' if len(rows) != 1 else ''} paid"
            pdf.drawString(margin + 55, H - margin - 42, sub)

            # Date + page
            pdf.drawRightString(W - margin - 10, H - margin - 25, f"Generated: {gen_time.strftime('%B %d, %Y')}")
            pdf.drawRightString(W - margin - 10, H - margin - 42, f"Page {page_num}")

            return H - margin - header_h - 20

        # ── TABLE ──
        columns = [
            ("S/N", 30),
            ("Name", 140),
            ("Matric No.", 90),
            ("Level", 45),
            ("Method", 80),
            ("Reference", 120),
            ("Paid At", 120),
        ]
        total_col_w = sum(c[1] for c in columns)
        # Scale columns to fill available width
        available_w = W - 2 * margin
        scale = available_w / total_col_w
        columns = [(name, int(w * scale)) for name, w in columns]

        row_h = 18
        header_row_h = 22

        def draw_table_header(y: float) -> float:
            """Draw the table header row."""
            x = margin
            pdf.setFillColor(colors.HexColor(self.LIME))
            pdf.roundRect(margin, y - header_row_h, available_w, header_row_h, 4, fill=True, stroke=False)
            pdf.setFillColor(colors.HexColor(self.NAVY))
            pdf.setFont("Helvetica-Bold", 8)
            for col_name, col_w in columns:
                pdf.drawString(x + 4, y - header_row_h + 7, col_name)
                x += col_w
            return y - header_row_h

        page_num = 1
        table_top = draw_header(page_num)
        y = draw_table_header(table_top)

        for i, row in enumerate(rows):
            if y - row_h < margin + 20:
                # New page
                pdf.showPage()
                page_num += 1
                table_top = draw_header(page_num)
                y = draw_table_header(table_top)

            # Alternating row colors
            if i % 2 == 0:
                pdf.setFillColor(colors.white)
            else:
                pdf.setFillColor(colors.HexColor("#F0F0F8"))
            pdf.rect(margin, y - row_h, available_w, row_h, fill=True, stroke=False)

            # Cell content
            pdf.setFillColor(colors.HexColor(self.NAVY))
            pdf.setFont("Helvetica", 7.5)
            x = margin

            cells = [
                str(i + 1),
                row.get("name", "N/A"),
                row.get("matricNumber", "N/A"),
                row.get("level", "N/A"),
                row.get("method", ""),
                row.get("reference", "")[:20],
                self._format_date(row.get("paidAt")),
            ]

            for (_, col_w), cell_text in zip(columns, cells):
                # Truncate if too wide
                max_chars = int(col_w / 4.5)
                display = cell_text[:max_chars] + "…" if len(cell_text) > max_chars else cell_text
                pdf.drawString(x + 4, y - row_h + 5, display)
                x += col_w

            y -= row_h

        # ── FOOTER ──
        pdf.setFillColor(colors.HexColor(self.NAVY))
        pdf.setFont("Helvetica", 7)
        pdf.drawString(margin, margin - 5, "Industrial Engineering Students' Association (IESA) • University of Ibadan")
        pdf.drawRightString(W - margin, margin - 5, "Confidential — For Admin Use Only")

        pdf.save()
        buffer.seek(0)
        return buffer

    @staticmethod
    def _format_date(dt) -> str:
        if dt is None:
            return "N/A"
        if isinstance(dt, str):
            try:
                dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))
            except Exception:
                return dt[:19]
        if hasattr(dt, "strftime"):
            return dt.strftime("%b %d, %Y %H:%M")
        return str(dt)[:19]


_generator = None


def generate_paid_students_pdf(
    payment_title: str,
    payment_amount: float,
    payment_category: str,
    rows: List[dict],
) -> BytesIO:
    """Generate a paid students PDF report (lazy singleton)."""
    global _generator
    if _generator is None:
        _generator = PaidStudentsReportGenerator()

    return _generator.generate_report(
        payment_title=payment_title,
        payment_amount=payment_amount,
        payment_category=payment_category,
        rows=rows,
    )
