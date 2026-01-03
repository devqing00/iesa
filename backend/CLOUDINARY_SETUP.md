# Cloudinary Setup Guide for IESA Profile Pictures

## What is Cloudinary?
Cloudinary is a cloud-based image and video management service. We use it to store and optimize profile pictures.

## Setup Steps

### 1. Create a Free Cloudinary Account
1. Go to [https://cloudinary.com/users/register/free](https://cloudinary.com/users/register/free)
2. Sign up with your email or GitHub account
3. Verify your email address

### 2. Get Your Credentials
1. Log in to your Cloudinary dashboard
2. Go to the **Dashboard** (home page after login)
3. You'll see your **Account Details** section with:
   - **Cloud Name**
   - **API Key**
   - **API Secret** (click the eye icon to reveal)

### 3. Add Credentials to `.env` File

In `backend/.env`, add the following lines:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name_here
CLOUDINARY_API_KEY=your_api_key_here
CLOUDINARY_API_SECRET=your_api_secret_here
```

Replace the values with your actual credentials from the dashboard.

### 4. Install Python Package

```bash
cd backend
pip install cloudinary
```

### 5. Restart Backend Server

After adding credentials:
```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

## Features

### Automatic Image Optimization
- Profile pictures are automatically resized to 400x400px
- Cropped to focus on faces using AI face detection
- Optimized for web delivery (WebP format when supported)
- Quality set to "auto:good" for best balance

### Folder Structure
All profile pictures are stored in: `iesa/profile_pictures/user_{firebase_uid}`

### File Replacement
Uploading a new profile picture automatically replaces the old one (no duplicate files).

## Usage in Application

### Frontend (Next.js)
Users can upload profile pictures by:
1. Going to their profile page
2. Hovering over their avatar
3. Clicking to select an image file
4. Image is automatically uploaded and displayed

### Backend (FastAPI)
Endpoint: `POST /api/users/me/profile-picture`
- Accepts: `multipart/form-data` with `file` field
- Validates: Image type and size (max 5MB)
- Returns: Updated user profile with new `profilePictureUrl`

## Limits (Free Plan)
- **Storage**: 25 GB
- **Bandwidth**: 25 GB/month
- **Transformations**: 25,000/month

This is more than enough for a student platform with hundreds of users.

## Security Notes

⚠️ **Never commit `.env` file to Git!**

The `.env` file is already in `.gitignore`. Always use environment variables for credentials.

## Troubleshooting

### "cloudinary not configured" error
- Check that all three environment variables are set in `.env`
- Restart the backend server after adding credentials

### Upload fails with 401 error
- Verify your API Key and API Secret are correct
- Check that there are no extra spaces in the `.env` file

### Images not displaying
- Check that the returned URL is a valid HTTPS URL
- Verify CORS settings allow Cloudinary domain

## Testing

After setup, test by:
1. Starting both frontend and backend servers
2. Logging in to your account
3. Going to Profile page
4. Uploading a profile picture
5. Verifying it appears in your Cloudinary dashboard under `iesa/profile_pictures/`
