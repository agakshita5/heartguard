// Fixed & Enhanced Firebase Auth Module

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    signOut,
    setPersistence,
    browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, 
    setDoc, 
    doc, 
    getDoc, 
    updateDoc 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// CONFIGURATION
let auth;
let db;
let firebaseConfigGlobal;

// Initialize Firebase with config from HTML
function initializeFirebase() {
    try {
        // Get config from window object (set from HTML)
        if (typeof firebaseConfig === 'undefined') {
            throw new Error('Firebase config not found. Ensure firebaseConfig is defined in your HTML.');
        }
        
        firebaseConfigGlobal = firebaseConfig;
        const app = initializeApp(firebaseConfigGlobal);
        
        auth = getAuth(app);
        db = getFirestore(app);
        
        // Enable persistence
        setPersistence(auth, browserLocalPersistence)
            .catch(error => console.warn("Persistence setup warning:", error));
        
        console.log("Firebase initialized successfully");
        return true;
    } catch (error) {
        console.error("Firebase initialization error:", error);
        showGlobalError("Firebase initialization failed. Please refresh the page.");
        return false;
    }
}

// UI UTILITIES
function showMessage(message, divId, type = 'info') {
    const messageDiv = document.getElementById(divId);
    if (!messageDiv) {
        console.warn(`Message div not found: ${divId}`);
        return;
    }
    
    messageDiv.style.display = "block";
    messageDiv.className = `messageDiv alert alert-${type === 'error' ? 'danger' : 'success'} alert-dismissible fade show`;
    messageDiv.innerHTML = `
        <i class="bi bi-${type === 'error' ? 'exclamation-circle' : 'check-circle'}-fill me-2"></i>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    messageDiv.style.opacity = 1;
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        if (messageDiv.style.display !== 'none') {
            messageDiv.style.opacity = 0;
            setTimeout(() => {
                messageDiv.style.display = "none";
            }, 300);
        }
    }, 5000);
}

function showGlobalError(message) {
    const alert = document.createElement('div');
    alert.className = 'alert alert-danger alert-dismissible fade show';
    alert.innerHTML = `
        <i class="bi bi-exclamation-triangle-fill me-2"></i>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.insertAdjacentElement('afterbegin', alert);
}

function setLoadingState(buttonId, isLoading) {
    const button = document.getElementById(buttonId);
    if (!button) return;
    
    if (isLoading) {
        button.disabled = true;
        button.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Processing...`;
    } else {
        button.disabled = false;
        button.innerHTML = button.dataset.originalText || 'Submit';
    }
}

// SIGN UP
function setupSignUp() {
    const signUpBtn = document.getElementById('submitSignUp');
    if (!signUpBtn) return;
    
    signUpBtn.dataset.originalText = signUpBtn.innerHTML;
    
    signUpBtn.addEventListener('click', async (event) => {
        event.preventDefault();
        console.log("Sign up button clicked");
        
        const email = document.getElementById('rEmail')?.value?.trim();
        const password = document.getElementById('rPassword')?.value;
        const firstName = document.getElementById('fName')?.value?.trim();
        const lastName = document.getElementById('lName')?.value?.trim();
        
        // Validation
        const errors = validateSignUpInputs(email, password, firstName, lastName);
        if (errors.length > 0) {
            showMessage(errors.join('. '), 'signUpMessage', 'error');
            return;
        }
        
        setLoadingState('submitSignUp', true);
        
        try {
            console.log("Attempting to create user...");
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            const todayStr = new Date().toISOString().split('T')[0];
            
            console.log("User created:", user.uid);
            
            // Store user data in Firestore
            const userData = {
                email,
                firstName,
                lastName,
                uid: user.uid,
                createdAt: new Date().toISOString(),
                lastLoginDate: todayStr,
                profileComplete: false
            };
            
            await setDoc(doc(db, "users", user.uid), userData);
            console.log("User data saved to Firestore");
            
            showMessage('Account created successfully! Redirecting...', 'signUpMessage', 'success');
            
            // Redirect after 2 seconds
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
            
        } catch (error) {
            console.error("Signup error:", error);
            setLoadingState('submitSignUp', false);
            
            let errorMsg = 'Account creation failed';
            switch (error.code) {
                case 'auth/email-already-in-use':
                    errorMsg = 'This email is already registered. Please sign in instead.';
                    break;
                case 'auth/weak-password':
                    errorMsg = 'Password must be at least 6 characters long';
                    break;
                case 'auth/invalid-email':
                    errorMsg = 'Please enter a valid email address';
                    break;
                default:
                    errorMsg = error.message || 'Unable to create account';
            }
            
            showMessage(errorMsg, 'signUpMessage', 'error');
        }
    });
}

function validateSignUpInputs(email, password, firstName, lastName) {
    const errors = [];
    
    if (!email) errors.push('Email is required');
    else if (!isValidEmail(email)) errors.push('Please enter a valid email');
    
    if (!password) errors.push('Password is required');
    else if (password.length < 6) errors.push('Password must be at least 6 characters');
    
    if (!firstName) errors.push('First name is required');
    if (!lastName) errors.push('Last name is required');
    
    return errors;
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// SIGN IN
function setupSignIn() {
    const signInBtn = document.getElementById('submitSignIn');
    if (!signInBtn) return;
    
    signInBtn.dataset.originalText = signInBtn.innerHTML;
    
    signInBtn.addEventListener('click', async (event) => {
        event.preventDefault();
        
        const email = document.getElementById('email')?.value?.trim();
        const password = document.getElementById('password')?.value;
        
        // Validation
        if (!email || !password) {
            showMessage('Please enter both email and password', 'signInMessage', 'error');
            return;
        }
        
        if (!isValidEmail(email)) {
            showMessage('Please enter a valid email address', 'signInMessage', 'error');
            return;
        }
        
        setLoadingState('submitSignIn', true);
        console.log("Attempting login with:", email);
        
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            console.log("Firebase auth success, user:", user.uid);
            
            // Get ID token
            const token = await user.getIdToken(true); // Force refresh
            console.log("Firebase ID token generated");
            
            // Send token to backend
            const response = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token })
            });
            
            const data = await response.json();
            console.log("Backend response:", data);
            
            if (response.ok && data.success) {
                showMessage('Login successful! Redirecting...', 'signInMessage', 'success');
                
                // Update last login
                await updateUserLastLogin(user.uid);
                
                setTimeout(() => {
                    window.location.href = '/';
                }, 1500);
            } else {
                throw new Error(data.error || 'Login failed on server');
            }
            
        } catch (error) {
            console.error("Login error:", error);
            setLoadingState('submitSignIn', false);
            
            let errorMsg = 'Login failed';
            if (error.code === 'auth/user-not-found') {
                errorMsg = 'No account found with this email';
            } else if (error.code === 'auth/wrong-password') {
                errorMsg = 'Incorrect password';
            } else if (error.code === 'auth/invalid-credential') {
                errorMsg = 'Invalid email or password';
            } else if (error.code === 'auth/user-disabled') {
                errorMsg = 'This account has been disabled';
            } else if (error.message) {
                errorMsg = error.message;
            }
            
            showMessage(errorMsg, 'signInMessage', 'error');
        }
    });
}

async function updateUserLastLogin(userId) {
    try {
        const today = new Date().toISOString().split('T')[0];
        await updateDoc(doc(db, "users", userId), {
            lastLoginDate: today,
            lastLoginTime: new Date().toISOString()
        });
    } catch (error) {
        console.warn("Could not update last login:", error);
    }
}

// SIGN OUT
function setupSignOut() {
    const signOutBtn = document.querySelector('a[href="/logout"]');
    if (!signOutBtn) return;
    
    signOutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        
        try {
            await signOut(auth);
            console.log("User signed out successfully");
            window.location.href = '/';
        } catch (error) {
            console.error("Sign out error:", error);
            showGlobalError("Error signing out. Please try again.");
        }
    });
}

// FORM TOGGLE
function setupFormToggle() {
    const signUpBtn = document.getElementById('signUpButton');
    const signInBtn = document.getElementById('signInButton');
    const signInForm = document.getElementById('signIn');
    const signUpForm = document.getElementById('signup');
    
    if (signUpBtn && signInForm && signUpForm) {
        signUpBtn.addEventListener('click', () => {
            signInForm.style.display = "none";
            signUpForm.style.display = "block";
        });
    }
    
    if (signInBtn && signInForm && signUpForm) {
        signInBtn.addEventListener('click', () => {
            signInForm.style.display = "block";
            signUpForm.style.display = "none";
        });
    }
}

// INITIALIZATION
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM loaded, initializing Firebase auth...");
    
    if (initializeFirebase()) {
        setupSignUp();
        setupSignIn();
        setupSignOut();
        setupFormToggle();
        console.log("Firebase auth setup complete");
    } else {
        console.error("Firebase initialization failed");
    }
});

window.FirebaseAuth = {
    getAuth: () => auth,
    getDB: () => db,
    signOut: () => signOut(auth),
    getCurrentUser: () => auth.currentUser
};