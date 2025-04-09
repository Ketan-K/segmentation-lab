// Performance metrics component for monitoring processing performance
import { formatTime } from '../utils/generalUtils.js';

/**
 * Set up performance metrics UI and handlers
 * @param {Object} uiElements - UI element references
 * @param {Object} backgroundService - Virtual background service
 */
export function setupPerformanceMetrics(uiElements, backgroundService) {
    /**
     * Update the UI with comparison metrics between models
     * @param {Object} modelMetrics - Metrics for different models
     * @param {string} currentModel - Currently active model name
     */
    function updateComparisonMetrics(modelMetrics, currentModel) {
        const comparisonSection = document.getElementById('modelComparisonSection');
        if (!comparisonSection) return;
        
        let hasData = false;
        // Check if there's any model data to compare
        for (const metrics of Object.values(modelMetrics)) {
            if (metrics.fps > 0 || metrics.segTime > 0 || metrics.processTime > 0) {
                hasData = true;
                break;
            }
        }
        
        // Show/hide the section based on data availability
        if (hasData) {
            comparisonSection.classList.remove('hide');
            
            const comparisonBody = document.getElementById('modelComparisonBody');
            if (comparisonBody) {
                comparisonBody.innerHTML = ''; // Clear existing rows
                
                // Add a row for each model with data
                for (const [model, metrics] of Object.entries(modelMetrics)) {
                    if (metrics.fps > 0 || metrics.segTime > 0 || metrics.processTime > 0) {
                        const row = document.createElement('tr');
                        
                        // Create model name cell
                        const modelCell = document.createElement('td');
                        modelCell.textContent = model;
                        row.appendChild(modelCell);
                        
                        // Create FPS cell
                        const fpsCell = document.createElement('td');
                        fpsCell.textContent = metrics.fps.toFixed(1);
                        row.appendChild(fpsCell);
                        
                        // Create segmentation time cell
                        const segTimeCell = document.createElement('td');
                        segTimeCell.textContent = metrics.segTime.toFixed(2);
                        row.appendChild(segTimeCell);
                        
                        // Create processing time cell
                        const processTimeCell = document.createElement('td');
                        processTimeCell.textContent = metrics.processTime.toFixed(2);
                        row.appendChild(processTimeCell);
                        
                        // Add highlight for current model
                        if (model === currentModel) {
                            row.classList.add('current-model');
                        }
                        
                        comparisonBody.appendChild(row);
                    }
                }
            }
        } else {
            comparisonSection.classList.add('hide');
        }
    }

    // Set up metrics display updaters if needed
    const metricsUpdateButton = document.getElementById('updateMetrics');
    if (metricsUpdateButton) {
        metricsUpdateButton.addEventListener('click', () => {
            // Request a metrics update from the background service
            backgroundService.updateMetricsDisplay();
        });
    }

    return {
        updateComparisonMetrics
    };
}