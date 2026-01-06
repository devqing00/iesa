"""
Email Notification System

Handles sending transactional emails for important events.
Supports multiple providers (SendGrid, Resend, SMTP).
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
import os
import logging
from enum import Enum

logger = logging.getLogger("iesa_backend")


class EmailProvider(Enum):
    """Supported email providers"""
    SENDGRID = "sendgrid"
    RESEND = "resend"
    SMTP = "smtp"
    CONSOLE = "console"  # For development - prints to console


class EmailTemplate(Enum):
    """Email template types"""
    PAYMENT_RECEIPT = "payment_receipt"
    PAYMENT_REMINDER = "payment_reminder"
    EVENT_REGISTRATION = "event_registration"
    ANNOUNCEMENT = "announcement"
    ROLE_ASSIGNED = "role_assigned"
    WELCOME = "welcome"
    PASSWORD_RESET = "password_reset"


class EmailService:
    """Unified email service supporting multiple providers"""
    
    def __init__(self):
        self.provider = self._detect_provider()
        self.from_email = os.getenv("EMAIL_FROM", "noreply@iesa.com")
        self.from_name = os.getenv("EMAIL_FROM_NAME", "IESA Platform")
        
        if self.provider == EmailProvider.SENDGRID:
            self._init_sendgrid()
        elif self.provider == EmailProvider.RESEND:
            self._init_resend()
        elif self.provider == EmailProvider.SMTP:
            self._init_smtp()
        elif self.provider == EmailProvider.CONSOLE:
            logger.warning("⚠️  Using console email provider (development mode)")
    
    def _detect_provider(self) -> EmailProvider:
        """Auto-detect email provider based on environment variables"""
        if os.getenv("SENDGRID_API_KEY"):
            return EmailProvider.SENDGRID
        elif os.getenv("RESEND_API_KEY"):
            return EmailProvider.RESEND
        elif os.getenv("SMTP_HOST"):
            return EmailProvider.SMTP
        else:
            return EmailProvider.CONSOLE
    
    def _init_sendgrid(self):
        """Initialize SendGrid client"""
        try:
            from sendgrid import SendGridAPIClient
            self.client = SendGridAPIClient(os.getenv("SENDGRID_API_KEY"))
            logger.info("✅ SendGrid email provider initialized")
        except ImportError:
            logger.error("❌ SendGrid not installed. Run: pip install sendgrid")
            self.provider = EmailProvider.CONSOLE
    
    def _init_resend(self):
        """Initialize Resend client"""
        try:
            import resend
            resend.api_key = os.getenv("RESEND_API_KEY")
            self.client = resend
            logger.info("✅ Resend email provider initialized")
        except ImportError:
            logger.error("❌ Resend not installed. Run: pip install resend")
            self.provider = EmailProvider.CONSOLE
    
    def _init_smtp(self):
        """Initialize SMTP client"""
        import smtplib
        self.smtp_host = os.getenv("SMTP_HOST")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER")
        self.smtp_password = os.getenv("SMTP_PASSWORD")
        logger.info("✅ SMTP email provider initialized")
    
    async def send_email(
        self,
        to: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        attachments: Optional[List[Dict[str, Any]]] = None
    ) -> bool:
        """
        Send an email using the configured provider.
        
        Args:
            to: Recipient email address
            subject: Email subject
            html_content: HTML email body
            text_content: Plain text fallback
            attachments: List of attachments (for receipts, etc.)
            
        Returns:
            True if sent successfully, False otherwise
        """
        try:
            if self.provider == EmailProvider.SENDGRID:
                return await self._send_sendgrid(to, subject, html_content, text_content, attachments)
            elif self.provider == EmailProvider.RESEND:
                return await self._send_resend(to, subject, html_content, text_content)
            elif self.provider == EmailProvider.SMTP:
                return await self._send_smtp(to, subject, html_content, text_content)
            elif self.provider == EmailProvider.CONSOLE:
                return await self._send_console(to, subject, html_content)
            
        except Exception as e:
            logger.error(f"Failed to send email to {to}: {str(e)}")
            return False
    
    async def _send_sendgrid(self, to, subject, html_content, text_content, attachments):
        """Send email via SendGrid"""
        from sendgrid.helpers.mail import Mail, Attachment, FileContent, FileName, FileType, Disposition
        import base64
        
        message = Mail(
            from_email=(self.from_email, self.from_name),
            to_emails=to,
            subject=subject,
            html_content=html_content,
            plain_text_content=text_content
        )
        
        if attachments:
            for att in attachments:
                encoded = base64.b64encode(att["content"]).decode()
                attachment = Attachment(
                    FileContent(encoded),
                    FileName(att["filename"]),
                    FileType(att.get("type", "application/pdf")),
                    Disposition("attachment")
                )
                message.attachment = attachment
        
        response = self.client.send(message)
        success = response.status_code in [200, 201, 202]
        
        if success:
            logger.info(f"✅ Email sent to {to} via SendGrid")
        else:
            logger.error(f"❌ SendGrid error: {response.status_code}")
        
        return success
    
    async def _send_resend(self, to, subject, html_content, text_content):
        """Send email via Resend"""
        params = {
            "from": f"{self.from_name} <{self.from_email}>",
            "to": [to],
            "subject": subject,
            "html": html_content,
        }
        
        if text_content:
            params["text"] = text_content
        
        response = self.client.Emails.send(params)
        success = response.get("id") is not None
        
        if success:
            logger.info(f"✅ Email sent to {to} via Resend")
        else:
            logger.error(f"❌ Resend error: {response}")
        
        return success
    
    async def _send_smtp(self, to, subject, html_content, text_content):
        """Send email via SMTP"""
        import smtplib
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText
        
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{self.from_name} <{self.from_email}>"
        msg["To"] = to
        
        if text_content:
            msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))
        
        with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
            server.starttls()
            server.login(self.smtp_user, self.smtp_password)
            server.send_message(msg)
        
        logger.info(f"✅ Email sent to {to} via SMTP")
        return True
    
    async def _send_console(self, to, subject, html_content):
        """Print email to console (development)"""
        print("\n" + "="*80)
        print("📧 EMAIL (Console Mode)")
        print("="*80)
        print(f"To: {to}")
        print(f"From: {self.from_name} <{self.from_email}>")
        print(f"Subject: {subject}")
        print("-"*80)
        print(html_content[:500] + "..." if len(html_content) > 500 else html_content)
        print("="*80 + "\n")
        return True
    
    async def send_template_email(
        self,
        to: str,
        template: EmailTemplate,
        context: Dict[str, Any]
    ) -> bool:
        """
        Send a templated email.
        
        Args:
            to: Recipient email
            template: EmailTemplate enum
            context: Template variables
        """
        subject, html = self._render_template(template, context)
        return await self.send_email(to, subject, html)
    
    def _render_template(self, template: EmailTemplate, context: Dict[str, Any]) -> tuple[str, str]:
        """Render email template"""
        
        if template == EmailTemplate.PAYMENT_RECEIPT:
            subject = f"Payment Receipt - {context.get('payment_title', 'IESA Payment')}"
            html = f"""
            <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1E4528;">Payment Receipt</h2>
                <p>Dear {context.get('student_name', 'Student')},</p>
                <p>Your payment has been confirmed!</p>
                <div style="background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 8px;">
                    <p><strong>Payment:</strong> {context.get('payment_title')}</p>
                    <p><strong>Amount:</strong> ₦{context.get('amount'):,.2f}</p>
                    <p><strong>Reference:</strong> {context.get('reference')}</p>
                    <p><strong>Date:</strong> {context.get('date')}</p>
                </p>
                <p>Thank you for your payment!</p>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                <p style="color: #666; font-size: 12px;">
                    Industrial Engineering Students' Association<br>
                    University of Ibadan
                </p>
            </body>
            </html>
            """
            
        elif template == EmailTemplate.WELCOME:
            subject = "Welcome to IESA Platform!"
            html = f"""
            <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1E4528;">Welcome to IESA!</h2>
                <p>Dear {context.get('name', 'Student')},</p>
                <p>Your account has been created successfully.</p>
                <p>You can now access the IESA platform and:</p>
                <ul>
                    <li>View announcements and events</li>
                    <li>Make departmental payments</li>
                    <li>Track your academic progress</li>
                    <li>Access resources and timetables</li>
                </ul>
                <p><a href="{context.get('dashboard_url', '#')}" style="background: #1E4528; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0;">Go to Dashboard</a></p>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                <p style="color: #666; font-size: 12px;">
                    Industrial Engineering Students' Association<br>
                    University of Ibadan
                </p>
            </body>
            </html>
            """
            
        elif template == EmailTemplate.ROLE_ASSIGNED:
            subject = f"You've been assigned a role: {context.get('position')}"
            html = f"""
            <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1E4528;">New Role Assignment</h2>
                <p>Dear {context.get('name', 'Student')},</p>
                <p>You have been assigned the role of <strong>{context.get('position')}</strong> for the {context.get('session')} session.</p>
                <p>This role comes with the following permissions:</p>
                <ul>
                    {''.join(f"<li>{perm}</li>" for perm in context.get('permissions', []))}
                </ul>
                <p>Please log in to access your new capabilities.</p>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                <p style="color: #666; font-size: 12px;">
                    Industrial Engineering Students' Association<br>
                    University of Ibadan
                </p>
            </body>
            </html>
            """
        
        else:
            subject = "IESA Notification"
            html = "<p>You have a new notification from IESA.</p>"
        
        return subject, html


# Global email service instance
_email_service: Optional[EmailService] = None


def get_email_service() -> EmailService:
    """Get or create the global email service instance"""
    global _email_service
    if _email_service is None:
        _email_service = EmailService()
    return _email_service


# Convenience functions for common emails

async def send_payment_receipt(
    to: str,
    student_name: str,
    payment_title: str,
    amount: float,
    reference: str,
    date: str
):
    """Send a payment receipt email"""
    service = get_email_service()
    return await service.send_template_email(
        to=to,
        template=EmailTemplate.PAYMENT_RECEIPT,
        context={
            "student_name": student_name,
            "payment_title": payment_title,
            "amount": amount,
            "reference": reference,
            "date": date
        }
    )


async def send_welcome_email(to: str, name: str, dashboard_url: str):
    """Send a welcome email to new users"""
    service = get_email_service()
    return await service.send_template_email(
        to=to,
        template=EmailTemplate.WELCOME,
        context={
            "name": name,
            "dashboard_url": dashboard_url
        }
    )


async def send_role_assignment_email(
    to: str,
    name: str,
    position: str,
    session: str,
    permissions: List[str]
):
    """Send role assignment notification"""
    service = get_email_service()
    return await service.send_template_email(
        to=to,
        template=EmailTemplate.ROLE_ASSIGNED,
        context={
            "name": name,
            "position": position,
            "session": session,
            "permissions": permissions
        }
    )
