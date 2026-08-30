import io
import requests
import qrcode
from PIL import Image, ImageDraw, ImageFont
import logging
import os
import urllib.request
import threading

logger = logging.getLogger(__name__)

FONT_PATH = os.path.join(os.path.dirname(__file__), "courbd.ttf")

def get_ticket_font(font_size: int):
    try:
        if os.path.exists(FONT_PATH):
            return ImageFont.truetype(FONT_PATH, font_size)
        else:
            logger.error("Local font courbd.ttf not found in utils folder.")
            return ImageFont.load_default()
    except Exception as e:
        logger.error(f"Failed to load font: {e}")
        return ImageFont.load_default()

def generate_visual_ticket(
    template_url: str,
    qr_config: dict,
    name_config: dict,
    matric_config: dict,
    font_family: str,
    student_name: str,
    matric_number: str,
    qr_data: str
) -> bytes:
    """
    Downloads a ticket template, overlays QR code and text, and returns a PNG buffer.
    """
    try:
        # 1. Fetch template image
        # In a real system you might want to cache this image locally
        # rather than downloading it per student. For this iteration, we keep it simple.
        response = requests.get(template_url, timeout=10)
        response.raise_for_status()
        base_image = Image.open(io.BytesIO(response.content)).convert("RGBA")
        
        # 2. Generate QR Code
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=2,
        )
        qr.add_data(qr_data)
        qr.make(fit=True)
        qr_img = qr.make_image(fill_color="black", back_color="white").convert("RGBA")
        
        img_w, img_h = base_image.size

        # Resize QR code according to config percentage
        qr_w_pct = float(qr_config.get("w", 20)) / 100.0
        qr_size_px = int(img_w * qr_w_pct)
        qr_img = qr_img.resize((qr_size_px, qr_size_px), Image.Resampling.LANCZOS)
        
        # Paste QR code onto base image using percentage coordinates
        qr_x = int(img_w * float(qr_config.get("x", 0)) / 100.0)
        qr_y = int(img_h * float(qr_config.get("y", 0)) / 100.0)
        base_image.paste(qr_img, (qr_x, qr_y), qr_img)
        
        # 3. Draw Text
        draw = ImageDraw.Draw(base_image)
        
        # Helper to draw text
        def draw_text(text: str, config: dict):
            if not text:
                return
            x = int(img_w * float(config.get("x", 0)) / 100.0)
            y = int(img_h * float(config.get("y", 0)) / 100.0)
            # Reduce font size multiplier to fit better visually (70% of box height)
            box_h_pct = float(config.get("h", 5)) / 100.0
            font_size = int(img_h * box_h_pct * 0.7)
            color = config.get("color", "#000000")
            
            font = get_ticket_font(font_size)
            
            draw.text((x, y), text, font=font, fill=color)

        draw_text(student_name, name_config)
        draw_text(matric_number, matric_config)
        
        # 4. Save to buffer (compositing over white background to fix transparency issues)
        white_bg = Image.new("RGBA", base_image.size, (255, 255, 255, 255))
        white_bg.paste(base_image, (0, 0), base_image)
        output_buffer = io.BytesIO()
        white_bg.convert("RGB").save(output_buffer, format="PNG")
        return output_buffer.getvalue()
        
    except Exception as e:
        logger.error(f"Failed to generate visual ticket: {str(e)}")
        raise

def generate_printable_tickets_pdf(ticket_buffers: list[bytes]) -> bytes:
    """
    Takes a list of individual ticket PNG buffers and tiles them onto an A4 PDF document.
    Returns the raw PDF bytes.
    """
    if not ticket_buffers:
        return b""
        
    try:
        # A4 paper size at 300 DPI
        A4_WIDTH = 2480
        A4_HEIGHT = 3508
        MARGIN = 100
        
        # Open first ticket to get aspect ratio
        first_ticket = Image.open(io.BytesIO(ticket_buffers[0]))
        tw, th = first_ticket.size
        
        # Determine grid size (simple fit strategy)
        # Let's try 2 columns
        cols = 2
        
        # Calculate available width for each ticket
        usable_width = A4_WIDTH - (MARGIN * (cols + 1))
        scaled_w = usable_width // cols
        
        # Scale height proportionally
        scale_ratio = scaled_w / tw
        scaled_h = int(th * scale_ratio)
        
        # Determine rows based on scaled height
        usable_height = A4_HEIGHT - (MARGIN * 2)
        rows = usable_height // (scaled_h + MARGIN)
        
        if rows < 1:
            rows = 1
            cols = 1
            scaled_w = A4_WIDTH - (MARGIN * 2)
            scale_ratio = scaled_w / tw
            scaled_h = int(th * scale_ratio)
            
        tickets_per_page = cols * rows
        
        pages = []
        current_page = None
        current_x = MARGIN
        current_y = MARGIN
        count_on_page = 0
        
        for i, t_buf in enumerate(ticket_buffers):
            if count_on_page == 0:
                # Start new page
                current_page = Image.new("RGB", (A4_WIDTH, A4_HEIGHT), "white")
                pages.append(current_page)
                current_x = MARGIN
                current_y = MARGIN
                
            img = Image.open(io.BytesIO(t_buf)).convert("RGB")
            img = img.resize((scaled_w, scaled_h), Image.Resampling.LANCZOS)
            
            # Draw cutting border (optional thin gray line)
            draw = ImageDraw.Draw(img)
            draw.rectangle([0, 0, scaled_w - 1, scaled_h - 1], outline="#CCCCCC", width=2)
            
            current_page.paste(img, (current_x, current_y))
            count_on_page += 1
            
            if count_on_page < tickets_per_page:
                if count_on_page % cols == 0:
                    current_x = MARGIN
                    current_y += scaled_h + MARGIN
                else:
                    current_x += scaled_w + MARGIN
            else:
                count_on_page = 0
                
        # Save pages to PDF buffer
        out_pdf = io.BytesIO()
        if pages:
            # save_all=True requires the first image in list, and append_images for the rest
            pages[0].save(
                out_pdf, 
                format="PDF", 
                resolution=300.0,
                save_all=True, 
                append_images=pages[1:]
            )
            
        return out_pdf.getvalue()
    except Exception as e:
        logger.error(f"Failed to generate printable PDF: {str(e)}")
        raise
