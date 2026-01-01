"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { 
  isInstitutionalEmail, 
  parseInstitutionalEmail,
  isValidMatricNumber,
  matricMatchesEmail
} from "@/lib/emailUtils";
import { 
  signInWithPopup, 
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "firebase/auth";
import { auth } from "@/lib/firebase";

type RegistrationStep = "email-preference" | "auth" | "student-details" | "onboarding";

export default function RegisterPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  
  const [currentStep, setCurrentStep] = useState<RegistrationStep>("email-preference");
  const [useInstitutionalEmail, setUseInstitutionalEmail] = useState(true); // Always true now
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(true);
  
  // Student details form
  const [studentDetails, setStudentDetails] = useState({
    firstName: "",
    lastName: "",
    matricNumber: "",
    phone: "",
    personalEmail: "",
    level: "100L",
    admissionYear: new Date().getFullYear(),
    institutionalEmail: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailHints, setEmailHints] = useState<{
    firstNameInitial?: string;
    lastNameHint?: string;
    matricLast3Digits?: string;
  }>({});

  // Redirect if already logged in and completed onboarding
  useEffect(() => {
    if (!loading && user) {
      // TODO: Check if user.hasCompletedOnboarding
      // If yes, redirect to dashboard
      // router.push("/dashboard");
    }
  }, [user, loading, router]);

  // Parse email and Google profile to pre-fill form
  useEffect(() => {
    if (user?.email) {
      setRegisteredEmail(user.email);
      
      // Get data from Google profile (displayName, photoURL, etc.)
      const displayName = user.displayName || "";
      const nameParts = displayName.split(" ");
      const googleFirstName = nameParts[0] || "";
      const googleLastName = nameParts.slice(1).join(" ") || "";
      
      // Parse institutional email for hints
      if (isInstitutionalEmail(user.email)) {
        const hints = parseInstitutionalEmail(user.email);
        setEmailHints(hints);
        
        // Pre-fill with Google data as primary source
        setStudentDetails(prev => ({
          ...prev,
          firstName: googleFirstName || (hints.firstNameInitial ? `${hints.firstNameInitial}...` : ""),
          lastName: googleLastName || hints.lastNameHint || "",
          institutionalEmail: user.email || "",
          // Don't auto-fill matric - user must enter full 6 digits
        }));
      } else {
        // Personal email - use Google data only
        setStudentDetails(prev => ({
          ...prev,
          firstName: googleFirstName,
          lastName: googleLastName,
        }));
      }
    }
  }, [user]);

  const handleEmailPreferenceSubmit = () => {
    setCurrentStep("auth");
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsSubmitting(true);
      setErrors({});
      
      const provider = new GoogleAuthProvider();
      
      // Restrict to UI student domain only
      provider.setCustomParameters({
        hd: 'stu.ui.edu.ng',
        prompt: 'select_account'
      });
      
      const result = await signInWithPopup(auth, provider);
      
      // Verify institutional email
      if (!isInstitutionalEmail(result.user.email || "")) {
        await auth.signOut();
        setErrors({ auth: "Please use your institutional email (@stu.ui.edu.ng)" });
        return;
      }
      
      // Auto-proceed to student details
      setCurrentStep("student-details");
    } catch (error: unknown) {
      console.error("Google sign-in error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to sign in with Google";
      setErrors({ auth: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailPasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSubmitting(true);
      setErrors({});
      
      // Validate institutional email
      if (!isInstitutionalEmail(authEmail)) {
        setErrors({ auth: "Please use your institutional email (@stu.ui.edu.ng)" });
        return;
      }
      
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, authEmail, authPassword);
      } else {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
      }
      
      // Auto-proceed to student details
      setCurrentStep("student-details");
    } catch (error: unknown) {
      console.error("Email/password auth error:", error);
      const errorMessage = error instanceof Error ? error.message : "Authentication failed";
      setErrors({ auth: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  const validateStudentDetails = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!studentDetails.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }

    if (!studentDetails.lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }

    if (!studentDetails.matricNumber.trim()) {
      newErrors.matricNumber = "Matric number is required";
    } else if (!isValidMatricNumber(studentDetails.matricNumber)) {
      newErrors.matricNumber = "Invalid matric number format";
    } else if (emailHints.matricLast3Digits && !matricMatchesEmail(studentDetails.matricNumber, emailHints.matricLast3Digits)) {
      newErrors.matricNumber = "Matric number does not match your email. Please verify.";
    }
    
    // Institutional email is always required
    if (!isInstitutionalEmail(registeredEmail)) {
      newErrors.institutionalEmail = "Institutional email is required";
    }

    if (!studentDetails.phone.trim()) {
      newErrors.phone = "Phone number is required";
    } else if (!/^(\+234|0)[789]\d{9}$/.test(studentDetails.phone)) {
      newErrors.phone = "Invalid Nigerian phone number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleStudentDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateStudentDetails()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Get Firebase ID token
      const token = await user?.getIdToken();

      // Send student details to backend
      const response = await fetch("/api/v1/students/complete-registration", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...studentDetails,
          // Ensure institutional email is set
          institutionalEmail: registeredEmail
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save student details");
      }

      // Move to onboarding
      setCurrentStep("onboarding");
    } catch (error) {
      console.error("Error saving student details:", error);
      setErrors({ submit: "Failed to save details. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteOnboarding = () => {
    router.push("/dashboard");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-4">
      <div className="w-full max-w-md">
        {/* Email Preference Step - Institutional Email Required */}
        {currentStep === "email-preference" && (
          <div className="rounded-xl bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] p-8">
            <h1 className="text-2xl font-heading font-bold text-[var(--foreground)] mb-2">
              Welcome to IESA
            </h1>
            <p className="text-[var(--foreground)]/60 mb-4">
              Registration requires your institutional email
            </p>
            
            <div className="mb-6 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-sm text-[var(--foreground)]/80">
                <svg className="h-5 w-5 inline mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-semibold">Important:</span> You must use your UI student email (@stu.ui.edu.ng) to register.
              </p>
            </div>

            <button
              onClick={handleEmailPreferenceSubmit}
              className="w-full p-4 rounded-lg bg-[var(--primary)] text-white text-left hover:opacity-90 transition-opacity"
            >
              <div className="flex items-center gap-3">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-semibold">Continue with Institutional Email</p>
                  <p className="text-sm opacity-80">yourname123@stu.ui.edu.ng</p>
                </div>
              </div>
            </button>

            <div className="mt-6 text-center">
              <p className="text-sm text-[var(--foreground)]/60">
                Already have an account?{" "}
                <a
                  href="/login"
                  className="font-semibold text-[var(--primary)] hover:opacity-80 transition-opacity"
                >
                  Sign in
                </a>
              </p>
            </div>
          </div>
        )}

        {/* Authentication Step */}
        {currentStep === "auth" && (
          <div className="rounded-xl bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] p-8">
            <h1 className="text-2xl font-heading font-bold text-[var(--foreground)] mb-2">
              {isSignUp ? "Create Account" : "Sign In"}
            </h1>
            <p className="text-[var(--foreground)]/60 mb-6">
              Use your institutional email (@stu.ui.edu.ng)
            </p>

            {/* Google Sign In */}
            <button
              onClick={handleGoogleSignIn}
              disabled={isSubmitting}
              className="w-full mb-4 p-3 rounded-lg border border-[var(--glass-border)] text-[var(--foreground)] hover:bg-[var(--glass-bg)] transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--glass-border)]"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-[var(--glass-bg)] text-[var(--foreground)]/60">Or</span>
              </div>
            </div>

            {/* Email/Password Form */}
            <form onSubmit={handleEmailPasswordAuth} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)]/80 mb-1">
                  Email <span className="text-[var(--foreground)]/60">(@stu.ui.edu.ng)</span>
                </label>
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="yourname123@stu.ui.edu.ng"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--glass-border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--foreground)]/80 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--glass-border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </div>

              {errors.auth && (
                <p className="text-red-500 text-sm">{errors.auth}</p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-lg bg-[var(--primary)] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isSubmitting ? "Please wait..." : (isSignUp ? "Sign Up" : "Sign In")}
              </button>

              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="w-full text-sm text-[var(--foreground)]/60 hover:text-[var(--foreground)] transition-colors"
              >
                {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
              </button>

              <button
                type="button"
                onClick={() => setCurrentStep("email-preference")}
                className="w-full text-sm text-[var(--foreground)]/60 hover:text-[var(--foreground)] transition-colors"
              >
                ← Back
              </button>
            </form>
          </div>
        )}

        {/* Student Details Step */}
        {currentStep === "student-details" && (
          <div className="rounded-xl bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] p-8">
            <h1 className="text-2xl font-heading font-bold text-[var(--foreground)] mb-2">
              Student Details
            </h1>
            <p className="text-[var(--foreground)]/60 mb-6">
              Please confirm or update your information
            </p>

            {registeredEmail && (
              <div className="mb-6 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <p className="text-sm text-[var(--foreground)]/80">
                  <span className="font-semibold">Registered Email:</span> {registeredEmail}
                </p>
                {emailHints.lastNameHint && (
                  <p className="text-xs text-[var(--foreground)]/60 mt-1">
                    Hint: Last name might be &ldquo;{emailHints.lastNameHint}&rdquo;, matric ends with &ldquo;{emailHints.matricLast3Digits}&rdquo;
                  </p>
                )}
              </div>
            )}

            <form onSubmit={handleStudentDetailsSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)]/80 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={studentDetails.firstName}
                    onChange={(e) => setStudentDetails({ ...studentDetails, firstName: e.target.value })}
                    placeholder="John"
                    className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--glass-border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                  {errors.firstName && (
                    <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)]/80 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={studentDetails.lastName}
                    onChange={(e) => setStudentDetails({ ...studentDetails, lastName: e.target.value })}
                    placeholder="Doe"
                    className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--glass-border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                  {errors.lastName && (
                    <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--foreground)]/80 mb-1">
                  Matric Number * <span className="text-xs text-[var(--foreground)]/60">(6 digits)</span>
                </label>
                <input
                  type="text"
                  placeholder="236856"
                  value={studentDetails.matricNumber}
                  onChange={(e) => {
                    const matric = e.target.value.replace(/\D/g, '').slice(0, 6); // Only digits, max 6
                    setStudentDetails({ ...studentDetails, matricNumber: matric });
                  }}
                  maxLength={6}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--glass-border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
                {errors.matricNumber && (
                  <p className="text-red-500 text-xs mt-1">{errors.matricNumber}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--foreground)]/80 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  placeholder="+234 812 345 6789"
                  value={studentDetails.phone}
                  onChange={(e) => setStudentDetails({ ...studentDetails, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--glass-border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
                {errors.phone && (
                  <p className="text-red-500 text-xs mt-1">{errors.phone}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--foreground)]/80 mb-1">
                  Personal Email (Optional)
                </label>
                <input
                  type="email"
                  placeholder="yourname@gmail.com"
                  value={studentDetails.personalEmail}
                  onChange={(e) => setStudentDetails({ ...studentDetails, personalEmail: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--glass-border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
                <p className="text-xs text-[var(--foreground)]/60 mt-1">
                  For notifications and updates. Can be verified later.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)]/80 mb-1">
                    Current Level *
                  </label>
                  <select
                    value={studentDetails.level}
                    onChange={(e) => setStudentDetails({ ...studentDetails, level: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--glass-border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  >
                    <option value="100L">100 Level</option>
                    <option value="200L">200 Level</option>
                    <option value="300L">300 Level</option>
                    <option value="400L">400 Level</option>
                    <option value="500L">500 Level</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)]/80 mb-1">
                    Admission Year *
                  </label>
                  <input
                    type="number"
                    value={studentDetails.admissionYear}
                    onChange={(e) => setStudentDetails({ ...studentDetails, admissionYear: parseInt(e.target.value) })}
                    min={new Date().getFullYear() - 6}
                    max={new Date().getFullYear()}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--glass-border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                  <p className="text-xs text-[var(--foreground)]/60 mt-1">Year you were admitted</p>
                </div>
              </div>

              {errors.submit && (
                <p className="text-red-500 text-sm">{errors.submit}</p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-lg bg-[var(--primary)] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isSubmitting ? "Saving..." : "Continue"}
              </button>
            </form>
          </div>
        )}

        {/* Onboarding Step */}
        {currentStep === "onboarding" && (
          <div className="rounded-xl bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] p-8 text-center">
            <div className="mb-6">
              <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <svg className="h-10 w-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-2xl font-heading font-bold text-[var(--foreground)] mb-2">
                Welcome, {studentDetails.firstName}!
              </h1>
              <p className="text-[var(--foreground)]/60">
                Your account has been set up successfully
              </p>
            </div>

            <div className="mb-8 space-y-3 text-left">
              <div className="p-4 rounded-lg bg-[var(--background)]">
                <p className="text-sm font-medium text-[var(--foreground)]/80 mb-1">What&apos;s Next?</p>
                <ul className="space-y-2 text-sm text-[var(--foreground)]/60">
                  <li className="flex items-start gap-2">
                    <svg className="h-5 w-5 text-[var(--primary)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    View announcements and updates
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="h-5 w-5 text-[var(--primary)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    Check upcoming events
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="h-5 w-5 text-[var(--primary)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    Manage your payments
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="h-5 w-5 text-[var(--primary)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    Complete your profile
                  </li>
                </ul>
              </div>
            </div>

            <button
              onClick={handleCompleteOnboarding}
              className="w-full py-3 rounded-lg bg-[var(--primary)] text-white font-medium hover:opacity-90 transition-opacity"
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
