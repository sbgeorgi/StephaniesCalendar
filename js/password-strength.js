// js/password-strength.js
document.addEventListener('DOMContentLoaded', () => {
    const passwordInput = document.getElementById('register-password');
    if (!passwordInput) return; // Exit if not on the register page

    const strengthBar = document.getElementById('password-strength-bar');
    const strengthText = document.getElementById('password-strength-text');
    const registerForm = document.getElementById('register-form');

    passwordInput.addEventListener('input', () => {
        const password = passwordInput.value;
        const strength = evaluatePasswordStrength(password);

        strengthBar.className = ''; // Clear existing classes
        strengthBar.classList.add('strength-' + strength.level);
        strengthText.textContent = strength.message;
    });

    function evaluatePasswordStrength(password) {
        let score = 0;
        if (!password) return { score: 0, level: 'none', message: '' };

        if (password.length >= 8) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[a-z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;

        switch (score) {
            case 0:
            case 1:
            case 2:
                return { score, level: 'weak', message: 'Weak. Add more variety.' };
            case 3:
                return { score, level: 'fair', message: 'Fair. Could be stronger.' };
            case 4:
                return { score, level: 'good', message: 'Good password.' };
            case 5:
                return { score, level: 'strong', message: 'Strong password.' };
            default:
                return { score: 0, level: 'none', message: '' };
        }
    }

    // Prevent form submission if password is too weak
    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            const strength = evaluatePasswordStrength(passwordInput.value);
            if (strength.score < 3) {
                e.preventDefault(); // Stop the form submission
                const messageElement = document.getElementById('auth-message');
                if (messageElement) {
                    messageElement.textContent = 'Please choose a stronger password (at least fair).';
                    messageElement.className = 'message error';
                }
            }
        });
    }
});