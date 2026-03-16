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
from html import escape

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
    EMAIL_VERIFICATION = "email_verification"


class EmailService:
    """Unified email service supporting multiple providers"""
    
    def __init__(self):
        self.smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER")
        self.smtp_password = os.getenv("SMTP_PASSWORD")
        self.smtp_use_tls = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
        self.provider = self._detect_provider()
        self.from_email = (
            os.getenv("EMAIL_FROM")
            or os.getenv("RESEND_FROM_EMAIL")
            or "noreply@iesaui.org"
        )
        self.from_name = os.getenv("EMAIL_FROM_NAME", "IESA Platform")
        self._healthy = False
        self.smtp_fallback_enabled = False
        
        if self.provider == EmailProvider.SENDGRID:
            self._init_sendgrid()
        elif self.provider == EmailProvider.RESEND:
            self._init_resend()
        elif self.provider == EmailProvider.SMTP:
            self._init_smtp()
        elif self.provider == EmailProvider.CONSOLE:
            logger.warning("⚠️  Using console email provider (development mode)")
            self._healthy = True

        # Keep SMTP as fallback path when available (attachments + provider outage fallback)
        if self.provider != EmailProvider.SMTP and self._has_smtp_config():
            self.smtp_fallback_enabled = True
            logger.info(
                f"✅ SMTP fallback enabled (Host: {self.smtp_host}, Port: {self.smtp_port})"
            )
    
    def _detect_provider(self) -> EmailProvider:
        """Auto-detect email provider based on environment variables"""
        # Prefer modern transactional providers first; keep SMTP as fallback path.
        if os.getenv("RESEND_API_KEY"):
            return EmailProvider.RESEND
        elif os.getenv("SENDGRID_API_KEY"):
            return EmailProvider.SENDGRID
        elif self._has_smtp_config():
            return EmailProvider.SMTP
        else:
            return EmailProvider.CONSOLE

    def _has_smtp_config(self) -> bool:
        """Return True if SMTP credentials are present."""
        return bool(self.smtp_host and self.smtp_user and self.smtp_password)
    
    def _init_sendgrid(self):
        """Initialize SendGrid client"""
        try:
            from sendgrid import SendGridAPIClient
            self.client = SendGridAPIClient(os.getenv("SENDGRID_API_KEY"))
            logger.info("✅ SendGrid email provider initialized")
            self._healthy = True
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
            self._healthy = True
        except ImportError:
            logger.error("❌ Resend not installed. Run: pip install resend")
            self.provider = EmailProvider.CONSOLE
    
    def _init_smtp(self):
        """Initialize SMTP client (Gmail or other SMTP servers)"""
        if not self._has_smtp_config():
            logger.error("❌ SMTP credentials not configured. Set SMTP_USER and SMTP_PASSWORD in .env")
            self.provider = EmailProvider.CONSOLE
        else:
            logger.info(f"✅ SMTP email provider initialized (Host: {self.smtp_host}, Port: {self.smtp_port})")
            self._healthy = True
    
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
                success = await self._send_sendgrid(to, subject, html_content, text_content, attachments)
                if not success and self.smtp_fallback_enabled:
                    logger.warning("⚠️ SendGrid failed — retrying with SMTP fallback")
                    return await self._send_smtp(to, subject, html_content, text_content, attachments)
                return success
            elif self.provider == EmailProvider.RESEND:
                # Resend is primary, but keep SMTP fallback for attachments and outages.
                if attachments and self.smtp_fallback_enabled:
                    logger.info("📎 Attachments detected — using SMTP fallback for attachment-safe delivery")
                    return await self._send_smtp(to, subject, html_content, text_content, attachments)

                success = await self._send_resend(to, subject, html_content, text_content)

                if not success and self.smtp_fallback_enabled:
                    logger.warning("⚠️ Resend failed — retrying with SMTP fallback")
                    return await self._send_smtp(to, subject, html_content, text_content, attachments)

                # If attachments exist but no SMTP fallback, send without attachment to avoid hard failure.
                if attachments and not self.smtp_fallback_enabled and success:
                    logger.warning("⚠️ Email sent via Resend without attachments (no SMTP fallback configured)")

                return success
            elif self.provider == EmailProvider.SMTP:
                return await self._send_smtp(to, subject, html_content, text_content, attachments)
            elif self.provider == EmailProvider.CONSOLE:
                return await self._send_console(to, subject, html_content)
            return False
            
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
    
    async def _send_smtp(self, to, subject, html_content, text_content, attachments=None):
        """Send email via SMTP (Gmail or other providers).

        smtplib is synchronous, so we build the message on the current thread
        and offload the blocking network I/O to a thread-pool executor so the
        FastAPI event loop is never stalled.

        Retries up to 3 times with exponential backoff for transient failures.
        """
        import asyncio
        import smtplib
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText
        from email.mime.application import MIMEApplication

        # Build the MIME message (CPU-only, non-blocking)
        msg = MIMEMultipart("mixed")
        msg["Subject"] = subject
        msg["From"] = f"{self.from_name} <{self.smtp_user}>"
        msg["To"] = to

        msg_alternative = MIMEMultipart("alternative")
        if text_content:
            msg_alternative.attach(MIMEText(text_content, "plain", "utf-8"))
        msg_alternative.attach(MIMEText(html_content, "html", "utf-8"))
        msg.attach(msg_alternative)

        if attachments:
            for attachment in attachments:
                part = MIMEApplication(attachment["content"], _subtype=attachment.get("subtype", "pdf"))
                part.add_header(
                    "Content-Disposition",
                    "attachment",
                    filename=attachment["filename"]
                )
                msg.attach(part)

        # Capture instance vars for use inside the thread
        smtp_host = self.smtp_host
        smtp_port = self.smtp_port
        smtp_use_tls = self.smtp_use_tls
        smtp_user = self.smtp_user
        smtp_password = self.smtp_password

        def _do_send():
            """Synchronous SMTP send — runs in a thread-pool worker."""
            with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
                server.set_debuglevel(0)
                if smtp_use_tls:
                    server.starttls()
                server.login(smtp_user, smtp_password)
                server.send_message(msg)

        max_retries = 3
        for attempt in range(1, max_retries + 1):
            try:
                loop = asyncio.get_running_loop()
                await asyncio.wait_for(
                    loop.run_in_executor(None, _do_send),
                    timeout=20.0
                )
                logger.info(f"✅ Email sent to {to} via SMTP ({smtp_host})")
                return True

            except asyncio.TimeoutError:
                logger.error(f"❌ SMTP timed out (>20s) on attempt {attempt}/{max_retries} — check SMTP_HOST/network")
                if attempt < max_retries:
                    wait = 2 ** attempt
                    logger.warning(f"   Retrying in {wait}s...")
                    await asyncio.sleep(wait)
                else:
                    return False
            except smtplib.SMTPAuthenticationError as e:
                logger.error(f"❌ SMTP Authentication failed: {str(e)}")
                logger.error("   Check your SMTP_USER and SMTP_PASSWORD (use App Password for Gmail)")
                return False
            except (smtplib.SMTPServerDisconnected, smtplib.SMTPConnectError, OSError) as e:
                # Permanent network errors (unreachable, refused, no route) — fall back to console immediately
                import errno as _errno
                _permanent_errnos = (
                    _errno.ENETUNREACH,   # 101 — Network is unreachable (dev/no internet)
                    _errno.ECONNREFUSED,  # 111 — Connection refused
                    getattr(_errno, 'ENETDOWN', 100),  # 100 — Network is down
                    getattr(_errno, 'EHOSTUNREACH', 113),  # 113 — No route to host
                )
                if isinstance(e, OSError) and getattr(e, 'errno', None) in _permanent_errnos:
                    logger.warning(
                        f"⚠️  SMTP network unreachable ({e}) — falling back to console output. "
                        f"Set EMAIL_PROVIDER=console in .env to suppress this warning in dev."
                    )
                    return await self._send_console(to, subject, html_content)
                # Transient network errors — retry
                if attempt < max_retries:
                    wait = 2 ** attempt
                    logger.warning(f"⚠️  SMTP transient error (attempt {attempt}/{max_retries}), retrying in {wait}s: {e}")
                    await asyncio.sleep(wait)
                else:
                    logger.error(f"❌ SMTP failed after {max_retries} attempts: {str(e)}")
                    return False
            except smtplib.SMTPException as e:
                logger.error(f"❌ SMTP error: {str(e)}")
                return False
            except Exception as e:
                logger.error(f"❌ Failed to send email via SMTP: {str(e)}")
                return False

        return False
    
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
        def _esc(value: Any) -> str:
            return escape(str(value)) if value is not None else ""

        def _shell(
            *,
            preheader: str,
            eyebrow: str,
            title: str,
            body_html: str,
            badge: str = "IESA Update",
            badge_bg: str = "#C8F31D",
            badge_text: str = "#0F0F2D",
        ) -> str:
            return f"""
            <html>
            <body style="margin:0;padding:24px;background:#FAFAFE;font-family:Inter,Arial,sans-serif;color:#0F0F2D;">
                <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">{_esc(preheader)}</div>
                <div style="max-width:620px;margin:0 auto;background:#FFFFFF;border:3px solid #0F0F2D;border-radius:20px;overflow:hidden;box-shadow:6px 6px 0 #000;">
                    <div style="background:#0F0F2D;padding:16px 24px;border-bottom:4px solid #C8F31D;">
                        <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-weight:800;color:#C8F31D;">IESA · University of Ibadan</div>
                        <div style="margin-top:8px;display:inline-block;padding:6px 10px;border:2px solid #0F0F2D;border-radius:999px;background:{badge_bg};color:{badge_text};font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;">{_esc(badge)}</div>
                    </div>
                    <div style="padding:28px 24px 24px;">
                        <p style="margin:0;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#64748B;font-weight:700;">{_esc(eyebrow)}</p>
                        <h2 style="margin:8px 0 14px;font-size:26px;line-height:1.2;color:#0F0F2D;">{_esc(title)}</h2>
                        {body_html}
                    </div>
                    <div style="background:#F5F6FB;border-top:2px solid #E2E8F0;padding:14px 24px;">
                        <p style="margin:0;font-size:11px;line-height:1.6;color:#64748B;">Industrial Engineering Students' Association · University of Ibadan</p>
                    </div>
                </div>
            </body>
            </html>
            """

        if template == EmailTemplate.PAYMENT_RECEIPT:
            amount = context.get("amount", 0)
            try:
                amount_text = f"₦{float(amount):,.2f}"
            except (TypeError, ValueError):
                amount_text = "₦0.00"

            subject = f"Payment Receipt - {context.get('payment_title', 'IESA Payment')}"
            body = f"""
            <p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#334155;">Hello {_esc(context.get('student_name', 'Student'))}, your payment has been confirmed successfully.</p>
            <div style="background:#F8FAFF;border:2px solid #0F0F2D;border-radius:14px;padding:14px 16px;margin:0 0 16px;">
                <p style="margin:0 0 8px;font-size:13px;color:#0F0F2D;"><strong>Payment:</strong> {_esc(context.get('payment_title', 'IESA Payment'))}</p>
                <p style="margin:0 0 8px;font-size:13px;color:#0F0F2D;"><strong>Reference:</strong> {_esc(context.get('reference', '—'))}</p>
                <p style="margin:0 0 8px;font-size:13px;color:#0F0F2D;"><strong>Date:</strong> {_esc(context.get('date', '—'))}</p>
                <p style="margin:0;font-size:20px;font-weight:900;color:#0F0F2D;">{amount_text}</p>
            </div>
            <div style="background:#ECFDF5;border:2px solid #14B8A6;border-radius:12px;padding:12px 14px;">
                <p style="margin:0;font-size:13px;color:#0F0F2D;">Your official PDF receipt is attached to this email. Keep it for your records.</p>
            </div>
            """
            html = _shell(
                preheader="Your IESA payment receipt is ready.",
                eyebrow="Payment Confirmation",
                title="Receipt Issued",
                body_html=body,
                badge="Payment",
                badge_bg="#C8F31D",
            )

        elif template == EmailTemplate.WELCOME:
            dashboard_url = _esc(context.get("dashboard_url", "#"))
            subject = "Welcome to IESA Platform!"
            body = f"""
            <p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#334155;">Welcome {_esc(context.get('name', 'Student'))}! Your account is now active.</p>
            <div style="background:#F8FAFF;border:2px solid #0F0F2D;border-radius:14px;padding:14px 16px;margin:0 0 16px;">
                <p style="margin:0 0 8px;font-size:13px;color:#0F0F2D;">You can now access announcements, events, payments, resources, and your academic tools.</p>
            </div>
            <a href="{dashboard_url}" style="display:inline-block;background:#C8F31D;color:#0F0F2D;font-size:13px;font-weight:900;text-decoration:none;padding:12px 18px;border:3px solid #0F0F2D;border-radius:12px;box-shadow:3px 3px 0 #0F0F2D;">Open Dashboard</a>
            """
            html = _shell(
                preheader="Your IESA account is ready.",
                eyebrow="Account",
                title="Welcome to IESA",
                body_html=body,
                badge="Welcome",
                badge_bg="#9B72CF",
                badge_text="#FFFFFF",
            )

        elif template == EmailTemplate.ROLE_ASSIGNED:
            permissions = context.get("permissions", [])
            permission_list = "".join(
                f"<li style='margin:0 0 6px;'>{_esc(permission)}</li>" for permission in permissions
            ) or "<li>No explicit permissions listed</li>"
            subject = f"You've been assigned a role: {context.get('position')}"
            body = f"""
            <p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#334155;">Hello {_esc(context.get('name', 'Student'))}, you have been assigned <strong>{_esc(context.get('position', 'Role'))}</strong> for the {_esc(context.get('session', 'current'))} session.</p>
            <div style="background:#F8FAFF;border:2px solid #0F0F2D;border-radius:14px;padding:14px 16px;">
                <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#0F0F2D;">Granted permissions:</p>
                <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.6;color:#334155;">{permission_list}</ul>
            </div>
            """
            html = _shell(
                preheader="A new IESA role has been assigned to your account.",
                eyebrow="Role Update",
                title="New Role Assignment",
                body_html=body,
                badge="Role",
                badge_bg="#5BD4C0",
            )

        elif template == EmailTemplate.EMAIL_VERIFICATION:
            verification_url = _esc(context.get("verification_url", "#"))
            subject = "Verify your IESA email address"
            body = f"""
            <p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#334155;">Hi {_esc(context.get('name', 'Student'))}, please verify your email to complete account setup.</p>
            <a href="{verification_url}" style="display:inline-block;background:#C8F31D;color:#0F0F2D;font-size:13px;font-weight:900;text-decoration:none;padding:12px 18px;border:3px solid #0F0F2D;border-radius:12px;box-shadow:3px 3px 0 #0F0F2D;margin:0 0 14px;">Verify Email Address</a>
            <p style="margin:0 0 8px;font-size:12px;color:#64748B;">If the button does not work, use this link:</p>
            <p style="margin:0;padding:10px 12px;border-radius:10px;background:#F5F6FB;border:1px solid #CBD5E1;word-break:break-all;font-size:12px;color:#334155;">{verification_url}</p>
            <p style="margin:12px 0 0;font-size:12px;color:#64748B;">This link expires in 24 hours.</p>
            """
            html = _shell(
                preheader="Verify your email to finish setting up your IESA account.",
                eyebrow="Security",
                title="Verify Your Email",
                body_html=body,
                badge="Verification",
                badge_bg="#E0C340",
            )

        elif template == EmailTemplate.PASSWORD_RESET:
            reset_url = _esc(context.get("reset_url", "#"))
            subject = "Reset your IESA password"
            body = f"""
            <p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#334155;">Hi {_esc(context.get('name', 'Student'))}, we received a request to reset your password.</p>
            <a href="{reset_url}" style="display:inline-block;background:#C8F31D;color:#0F0F2D;font-size:13px;font-weight:900;text-decoration:none;padding:12px 18px;border:3px solid #0F0F2D;border-radius:12px;box-shadow:3px 3px 0 #0F0F2D;margin:0 0 14px;">Reset Password</a>
            <p style="margin:0 0 8px;font-size:12px;color:#64748B;">If the button does not work, use this link:</p>
            <p style="margin:0;padding:10px 12px;border-radius:10px;background:#F5F6FB;border:1px solid #CBD5E1;word-break:break-all;font-size:12px;color:#334155;">{reset_url}</p>
            <div style="margin-top:14px;background:#FFF7ED;border:2px solid #EA580C;border-radius:12px;padding:10px 12px;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#9A3412;">If you did not request this, ignore this email. Your password remains unchanged.</p>
            </div>
            """
            html = _shell(
                preheader="Password reset requested for your IESA account.",
                eyebrow="Security",
                title="Password Reset",
                body_html=body,
                badge="Reset",
                badge_bg="#E8614D",
                badge_text="#FFFFFF",
            )

        elif template == EmailTemplate.ANNOUNCEMENT:
            priority = str(context.get("priority", "normal")).lower()
            priority_colors = {
                "urgent": "#DC2626",
                "important": "#D97706",
                "normal": "#5BD4C0",
                "info": "#9B72CF",
            }
            priority_labels = {
                "urgent": "Urgent",
                "important": "Important",
                "normal": "Announcement",
                "info": "Info",
            }
            badge_bg = priority_colors.get(priority, "#5BD4C0")
            badge = priority_labels.get(priority, "Announcement")
            target_label = _esc(context.get("target_label", "All Students"))
            content = str(context.get("content", ""))
            content_preview = content[:450] + ("…" if len(content) > 450 else "")
            content_preview = _esc(content_preview).replace("\n", "<br>")
            dashboard_url = _esc(context.get("dashboard_url", "https://iesa-ui.vercel.app/dashboard/announcements"))

            subject = f"[{badge}] {context.get('title', 'New Announcement')} — IESA"
            body = f"""
            <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#334155;">Hello {_esc(context.get('student_name', 'Student'))}, a new update has been published for <strong>{target_label}</strong>.</p>
            <div style="background:#F8FAFF;border:2px solid #0F0F2D;border-radius:14px;padding:14px 16px;margin:0 0 14px;">
                <p style="margin:0 0 8px;font-size:16px;font-weight:900;color:#0F0F2D;">{_esc(context.get('title', 'New Announcement'))}</p>
                <p style="margin:0;font-size:13px;line-height:1.7;color:#334155;">{content_preview}</p>
            </div>
            <a href="{dashboard_url}" style="display:inline-block;background:#C8F31D;color:#0F0F2D;font-size:13px;font-weight:900;text-decoration:none;padding:12px 18px;border:3px solid #0F0F2D;border-radius:12px;box-shadow:3px 3px 0 #0F0F2D;">Read Full Announcement</a>
            """
            html = _shell(
                preheader="A new announcement is available on your dashboard.",
                eyebrow="Broadcast",
                title="IESA Announcement",
                body_html=body,
                badge=badge,
                badge_bg=badge_bg,
                badge_text="#FFFFFF" if priority in {"urgent", "important"} else "#0F0F2D",
            )

        else:
            subject = "IESA Notification"
            html = _shell(
                preheader="You have a new notification from IESA.",
                eyebrow="Notification",
                title="IESA Update",
                body_html="<p style='margin:0;font-size:14px;line-height:1.7;color:#334155;'>You have a new notification from IESA.</p>",
            )
        
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
    date: str,
    student_email: str = None,
    student_level: str = "N/A",
    transaction_id: str = None
):
    """Send a payment receipt email with PDF attachment"""
    from datetime import datetime
    from ..utils.receipt_generator import ReceiptGenerator
    
    service = get_email_service()
    
    # Generate PDF receipt
    pdf_buffer = None
    try:
        generator = ReceiptGenerator()
        pdf_buffer = generator.generate_receipt(
            transaction_id=transaction_id or reference,
            reference=reference,
            student_name=student_name,
            student_email=student_email or to,
            student_level=student_level,
            payment_title=payment_title,
            amount=amount,
            paid_at=datetime.now(),
            channel="Paystack",
            payment_type=payment_title
        )
    except Exception as e:
        logger.error(f"Failed to generate PDF receipt: {e}")
        # Continue without PDF if generation fails
    
    # Prepare email context
    context = {
        "student_name": student_name,
        "payment_title": payment_title,
        "amount": amount,
        "reference": reference,
        "date": date
    }
    
    # Render template
    subject, html = service._render_template(EmailTemplate.PAYMENT_RECEIPT, context)
    
    # Prepare attachments
    attachments = None
    if pdf_buffer:
        pdf_buffer.seek(0)
        attachments = [{
            "content": pdf_buffer.read(),
            "filename": f"IESA_Receipt_{reference}.pdf",
            "type": "application/pdf",
            "subtype": "pdf"
        }]
    
    # Send email with attachment
    return await service.send_email(to, subject, html, attachments=attachments)


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


async def send_verification_email(to: str, name: str, verification_url: str):
    """Send email verification link to new users"""
    service = get_email_service()
    return await service.send_template_email(
        to=to,
        template=EmailTemplate.EMAIL_VERIFICATION,
        context={
            "name": name,
            "verification_url": verification_url
        }
    )


async def send_announcement_email(
    to: str,
    student_name: str,
    title: str,
    content: str,
    priority: str,
    target_label: str,
    dashboard_url: str = "https://iesa-ui.vercel.app/dashboard/announcements",
):
    """Send an announcement notification email to a student."""
    service = get_email_service()
    return await service.send_template_email(
        to=to,
        template=EmailTemplate.ANNOUNCEMENT,
        context={
            "student_name": student_name,
            "title": title,
            "content": content,
            "priority": priority,
            "target_label": target_label,
            "dashboard_url": dashboard_url,
        }
    )


async def send_birthday_email(
    to: str,
    name: str,
    role_appreciation: str | None = None,
    due_reminder: str | None = None,
    dashboard_url: str = "https://iesa-ui.vercel.app/dashboard",
):
    """Send a specialized birthday celebrant email."""
    service = get_email_service()

    subject = "Happy Birthday from IESA"
    html = f"""
    <html>
    <body style="margin:0;padding:24px;background:#FAFAFE;font-family:Inter,Arial,sans-serif;color:#0F0F2D;">
        <div style="max-width:620px;margin:0 auto;background:#FFFFFF;border:3px solid #0F0F2D;border-radius:20px;overflow:hidden;box-shadow:6px 6px 0 #000;">
            <div style="background:#0F0F2D;padding:16px 24px;border-bottom:4px solid #C8F31D;">
                <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-weight:800;color:#C8F31D;">IESA · University of Ibadan</div>
                <div style="margin-top:8px;display:inline-block;padding:6px 10px;border:2px solid #0F0F2D;border-radius:999px;background:#C8F31D;color:#0F0F2D;font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;">Birthday Wishes</div>
            </div>
            <div style="padding:28px 24px 24px;">
                <p style="margin:0;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#64748B;font-weight:700;">Celebration</p>
                <h2 style="margin:8px 0 12px;font-size:26px;line-height:1.2;color:#0F0F2D;">Happy Birthday, {escape(name)}!</h2>
                <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#334155;">Wishing you joy, growth, and meaningful moments today.</p>
                <p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:#334155;">The entire Industrial Engineering Students&apos; Association community celebrates you and wishes you a wonderful year ahead.</p>
                {f'<div style="margin:0 0 18px;padding:12px 14px;background:#F2F0FF;border:2px solid #0F0F2D;border-radius:12px;color:#0F0F2D;font-size:13px;line-height:1.6;"><strong>We appreciate your service:</strong> {escape(role_appreciation)}</div>' if role_appreciation else ''}
                {f'<div style="margin:0 0 18px;padding:12px 14px;background:#FFF7D6;border:2px solid #0F0F2D;border-radius:12px;color:#0F0F2D;font-size:13px;line-height:1.6;"><strong>Playful reminder:</strong> {escape(due_reminder)}</div>' if due_reminder else ''}
                <a href="{escape(dashboard_url)}" style="display:inline-block;background:#C8F31D;color:#0F0F2D;font-size:13px;font-weight:900;text-decoration:none;padding:12px 18px;border:3px solid #0F0F2D;border-radius:12px;box-shadow:3px 3px 0 #0F0F2D;">
                    Open IESA Dashboard
                </a>
            </div>
            <div style="background:#F5F6FB;border-top:2px solid #E2E8F0;padding:14px 24px;">
                <p style="margin:0;font-size:11px;line-height:1.6;color:#64748B;">
                    Industrial Engineering Students&apos; Association<br>
                    University of Ibadan
                </p>
            </div>
        </div>
    </body>
    </html>
    """

    return await service.send_email(to=to, subject=subject, html_content=html)


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


async def send_password_reset_email(to: str, name: str, reset_url: str):
    """Send password reset link email"""
    service = get_email_service()
    return await service.send_template_email(
        to=to,
        template=EmailTemplate.PASSWORD_RESET,
        context={
            "name": name,
            "reset_url": reset_url
        }
    )


async def check_email_health() -> dict:
    """
    Diagnose the email service:
    - Provider detection
    - SMTP connectivity test (if SMTP)
    - Returns structured status report
    """
    service = get_email_service()
    report = {
        "provider": service.provider.value,
        "healthy": service._healthy,
        "from_email": service.from_email,
        "from_name": service.from_name,
        "smtp_fallback_enabled": service.smtp_fallback_enabled,
        "status": "ok" if service._healthy else "degraded",
    }

    if service.provider == EmailProvider.SMTP:
        import smtplib
        import asyncio

        smtp_host = service.smtp_host
        smtp_port = service.smtp_port
        smtp_use_tls = service.smtp_use_tls
        smtp_user = service.smtp_user
        smtp_password = service.smtp_password

        # Skip live SMTP test if credentials aren't configured
        if not smtp_host or not smtp_user or not smtp_password:
            report["smtp_connection"] = "not_configured"
            report["healthy"] = False
            report["error"] = "SMTP credentials not configured (SMTP_HOST / SMTP_USER / SMTP_PASSWORD)"
            report["status"] = "degraded"
            return report

        def _test_connection():
            with smtplib.SMTP(smtp_host, smtp_port, timeout=5) as server:
                if smtp_use_tls:
                    server.starttls()
                server.login(smtp_user, smtp_password)
                return True

        try:
            loop = asyncio.get_running_loop()
            await asyncio.wait_for(
                loop.run_in_executor(None, _test_connection),
                timeout=8.0
            )
            report["smtp_connection"] = "ok"
            report["smtp_host"] = smtp_host
            report["smtp_port"] = smtp_port
            report["smtp_user"] = smtp_user
        except asyncio.TimeoutError:
            report["smtp_connection"] = "timeout"
            report["healthy"] = False
            report["error"] = "SMTP connection timed out (>8s) — check SMTP_HOST and network"
        except smtplib.SMTPAuthenticationError:
            report["smtp_connection"] = "auth_failed"
            report["healthy"] = False
            report["error"] = "SMTP authentication failed — check SMTP_USER and SMTP_PASSWORD"
        except Exception as e:
            report["smtp_connection"] = "unreachable"
            report["healthy"] = False
            report["error"] = f"SMTP connection error: {str(e)}"
    elif service.provider == EmailProvider.CONSOLE:
        report["warning"] = "Using console provider — emails are printed, not sent"
        report["status"] = "degraded"

    if not report.get("healthy", False) and report.get("status") == "ok":
        report["status"] = "degraded"

    return report
