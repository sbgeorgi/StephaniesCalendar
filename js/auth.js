// js/auth.js
const SUPABASE_URL = 'https://vrzfqxopinrzismpfdzu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyemZxeG9waW5yemlzbXBmZHp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2NDEyOTgsImV4cCI6MjA2OTIxNzI5OH0._mPhMisM6qVeSw2HKTo2cHv4YTkAaO3eSSDaPh2pj5U';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const messageElement = document.getElementById('auth-message');

function showMessage(text, type = 'error') {
    if (messageElement) {
        messageElement.textContent = text;
        messageElement.className = `message ${type}`;
    }
}

const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) showMessage(error.message); else window.location.href = 'calendar.html';
    });
}

const registerForm = document.getElementById('register-form');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullName = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        if (password !== document.getElementById('register-password-confirm').value) {
            return showMessage("Passwords do not match.");
        }
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
        if (error) showMessage(error.message); else {
            showMessage("Registration successful! Please check your email to confirm your account, then log in.", "success");
            registerForm.querySelector('button').disabled = true;
        }
    });
}