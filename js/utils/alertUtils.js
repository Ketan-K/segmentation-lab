// Alert utility functions
const ALERT_DURATION = 5000; // 5 seconds
const alerts = [];

export function showAlert(message, type = 'info', title = '') {
    // Create alert container if it doesn't exist
    let alertContainer = document.getElementById('alertContainer');
    if (!alertContainer) {
        alertContainer = document.createElement('div');
        alertContainer.id = 'alertContainer';
        alertContainer.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-height: 80vh;
            overflow-y: auto;
        `;
        document.body.appendChild(alertContainer);
    }

    // Create alert element
    const alertEl = document.createElement('div');
    const alertId = Date.now();
    alertEl.id = `alert-${alertId}`;
    alertEl.className = `alert alert-${type}`;
    alertEl.style.cssText = `
        padding: 12px 20px;
        margin-bottom: 0;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-width: 300px;
        max-width: 500px;
        animation: slideIn 0.3s ease;
        backdrop-filter: blur(10px);
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        border: 1px solid rgba(0,0,0,0.1);
    `;

    // Set background color based on type
    switch (type) {
        case 'success':
            alertEl.style.backgroundColor = 'rgba(40, 167, 69, 0.95)';
            alertEl.style.color = 'white';
            break;
        case 'error':
            alertEl.style.backgroundColor = 'rgba(220, 53, 69, 0.95)';
            alertEl.style.color = 'white';
            break;
        case 'warning':
            alertEl.style.backgroundColor = 'rgba(255, 193, 7, 0.95)';
            alertEl.style.color = 'black';
            break;
        default:
            alertEl.style.backgroundColor = 'rgba(23, 162, 184, 0.95)';
            alertEl.style.color = 'white';
    }

    // Create message content
    const messageContent = document.createElement('div');
    messageContent.style.flex = '1';
    if (title) {
        const titleEl = document.createElement('div');
        titleEl.style.fontWeight = 'bold';
        titleEl.style.marginBottom = '4px';
        titleEl.textContent = title;
        messageContent.appendChild(titleEl);
    }
    const messageEl = document.createElement('div');
    messageEl.textContent = message;
    messageContent.appendChild(messageEl);
    alertEl.appendChild(messageContent);

    // Add close button
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;';
    closeButton.style.cssText = `
        background: none;
        border: none;
        color: inherit;
        font-size: 20px;
        cursor: pointer;
        padding: 0 0 0 10px;
        opacity: 0.8;
        transition: opacity 0.2s;
    `;
    closeButton.addEventListener('mouseover', () => closeButton.style.opacity = '1');
    closeButton.addEventListener('mouseout', () => closeButton.style.opacity = '0.8');
    closeButton.onclick = () => removeAlert(alertId);
    alertEl.appendChild(closeButton);

    // Add to container
    alertContainer.appendChild(alertEl);
    alerts.push(alertId);

    // Auto remove after duration
    setTimeout(() => removeAlert(alertId), ALERT_DURATION);

    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

function removeAlert(alertId) {
    const alertEl = document.getElementById(`alert-${alertId}`);
    if (alertEl) {
        // Add slide out animation
        alertEl.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            alertEl.remove();
            // Remove from alerts array
            const index = alerts.indexOf(alertId);
            if (index > -1) {
                alerts.splice(index, 1);
            }
            // Remove container if no alerts
            if (alerts.length === 0) {
                const container = document.getElementById('alertContainer');
                if (container) container.remove();
            }
        }, 300);
    }
}