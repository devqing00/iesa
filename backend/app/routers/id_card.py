"""
ID Card Router - Digital Student ID Cards

Endpoints:
- GET /api/v1/id-card - Generate and download student's ID card
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from typing import Optional
from datetime import datetime

from ..core.security import verify_token
from ..utils.id_card_generator import generate_student_id_card


router = APIRouter(
    prefix="/api/v1/student-document",
    tags=["student-document"]
)


@router.get("")
async def get_student_document(
    current_user: dict = Depends(verify_token)
):
    """
    Generate and download the current user's student document
    
    The document includes:
    - Student information (name, matric, level)
    - QR code for verification
    - Payment status indicator
    - IESA branding
    
    Returns:
        StreamingResponse: PDF file of the student document
    """
    try:
        from ..main import db
        
        # Get student data from Firebase user
        student_id = current_user.get("uid")
        
        # Query the users collection (students are stored there)
        student_doc = db.users.find_one({"firebaseUid": student_id})
        
        if not student_doc:
            raise HTTPException(
                status_code=404,
                detail="Student record not found. Please complete your profile."
            )
        
        # Get student information from database
        display_name = f"{student_doc.get('firstName', '')} {student_doc.get('lastName', '')}".strip() or "Student Name"
        matric_number = student_doc.get("matricNumber", "Not Set")
        level = student_doc.get("currentLevel", "Not Set")  # Changed from 'level' to 'currentLevel'
        department = student_doc.get("department", "Industrial Engineering")
        admission_year = student_doc.get("admissionYear", "")
        
        # Calculate entry session from admission year
        if admission_year:
            next_year = admission_year + 1
            entry_session = f"{admission_year}/{next_year}"
        else:
            entry_session = ""
        
        # Use student's entry session if available, otherwise current session
        if entry_session:
            session = entry_session
        else:
            current_year = datetime.now().year
            next_year = current_year + 1
            session = f"{current_year}/{next_year}"
        
        # Check actual payment status from database
        # Query all payments and check if user has paid all required dues
        try:
            all_payments = list(db.payments.find({}))
            total_payments = len(all_payments)
            paid_payments = sum(1 for p in all_payments if student_id in p.get("paidBy", []))
            
            # If user has paid all dues, mark as "Paid"
            if total_payments > 0 and paid_payments == total_payments:
                payment_status = "Paid"
            else:
                payment_status = "Not Paid"
        except Exception as e:
            print(f"Error checking payment status: {str(e)}")
            payment_status = "Not Paid"
        
        # TODO: Get photo URL from user profile
        # In production, this would come from Firebase Storage or user profile
        photo_url = None
        
        # Generate the ID card
        pdf_buffer = generate_student_id_card(
            student_id=student_id,
            matric_number=matric_number,
            full_name=display_name,
            level=level,
            department=department,
            session=session,
            payment_status=payment_status,
            photo_url=photo_url
        )
        
        # Create filename
        filename = f"IESA_ID_Card_{matric_number.replace('/', '_')}.pdf"
        
        # Return PDF as downloadable file
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
        
    except Exception as e:
        print(f"Error generating ID card: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate ID card: {str(e)}"
        )


@router.get("/view")
async def view_student_document(
    current_user: dict = Depends(verify_token)
):
    """
    View student document inline without downloading
    
    Returns:
        StreamingResponse: PDF file displayed inline
    """
    try:
        from ..main import db
        
        # Get student data from Firebase user
        student_id = current_user.get("uid")
        
        # Query the users collection (students are stored there)
        student_doc = db.users.find_one({"firebaseUid": student_id})
        
        if not student_doc:
            raise HTTPException(
                status_code=404,
                detail="Student record not found. Please complete your profile."
            )
        
        # Get student information from database
        display_name = f"{student_doc.get('firstName', '')} {student_doc.get('lastName', '')}".strip() or "Student Name"
        matric_number = student_doc.get("matricNumber", "Not Set")
        level = student_doc.get("currentLevel", "Not Set")  # Changed from 'level' to 'currentLevel'
        department = student_doc.get("department", "Industrial Engineering")
        admission_year = student_doc.get("admissionYear", "")
        
        # Calculate entry session from admission year
        if admission_year:
            next_year = admission_year + 1
            entry_session = f"{admission_year}/{next_year}"
        else:
            entry_session = ""
        
        # Use student's entry session if available
        if entry_session:
            session = entry_session
        else:
            current_year = datetime.now().year
            session = f"{current_year}/{current_year + 1}"
        
        # Check payment status from database
        try:
            all_payments = list(db.payments.find({}))
            total_payments = len(all_payments)
            paid_payments = sum(1 for p in all_payments if student_id in p.get("paidBy", []))
            
            if total_payments > 0 and paid_payments == total_payments:
                payment_status = "Paid"
            else:
                payment_status = "Not Paid"
        except Exception as e:
            print(f"Error checking payment status: {str(e)}")
            payment_status = "Not Paid"
            
        photo_url = None
        
        # Generate ID card
        pdf_buffer = generate_student_id_card(
            student_id=student_id,
            matric_number=matric_number,
            full_name=display_name,
            level=level,
            department=department,
            session=session,
            payment_status=payment_status,
            photo_url=photo_url
        )
        
        # Return PDF for inline viewing
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": "inline"
            }
        )
        
    except Exception as e:
        print(f"Error previewing ID card: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to preview ID card: {str(e)}"
        )
