// Utility functions for displaying in-app alerts

/**
 * Displays an in-app alert message
 * @param {string} message - The message to display
 * @param {string} type - Alert type ('info', 'error', 'success')
 * @param {string} title - Alert title
 * @param {number} duration - How long to display the alert in ms
 * @returns {string} The ID of the created alert
 */
export function showAlert(message, type = 'info', title = '', duration = 5000) {
    const alertContainer = document.getElementById('alertContainer');
    const alertId = 'alert-' + Date.now();
    
    // Create alert element
    const alert = document.createElement('div');
    alert.className = `app-alert ${type}`;
    alert.id = alertId;
    
    // Set icon based on type
    let icon = 'info-circle';
    if (type === 'error') icon = 'exclamation-circle';
    if (type === 'success') icon = 'check-circle';
    
    // Set title if not provided
    if (!title) {
        if (type === 'error') title = 'Error';
        if (type === 'success') title = 'Success';
        if (type === 'info') title = 'Information';
    }
    
    // Build alert content
    alert.innerHTML = `
        <div class="alert-icon"><i class="fas fa-${icon}"></i></div>
        <div class="alert-content">
            <div class="alert-title">${title}</div>
            <div class="alert-message">${message}</div>
        </div>
        <button class="close-alert"><i class="fas fa-times"></i></button>
    `;
    
    // Add event listener to close button
    alertContainer.appendChild(alert);
    
    // Show alert with animation
    setTimeout(() => alert.classList.add('show'), 10);
    
    // Set up auto-dismiss
    const timeoutId = setTimeout(() => dismissAlert(alertId), duration);
    
    // Add click event to close button
    alert.querySelector('.close-alert').addEventListener('click', () => {
        clearTimeout(timeoutId);
        dismissAlert(alertId);
    });
    
    return alertId;
}

/**
 * Dismisses an alert with animation
 * @param {string} alertId - The ID of the alert to dismiss
 */
export function dismissAlert(alertId) {
    const alert = document.getElementById(alertId);
    if (!alert) return;
    
    alert.classList.remove('show');
    setTimeout(() => {
        if (alert.parentNode) {
            alert.parentNode.removeChild(alert);
        }
    }, 300);
}