/**
 * ModelLabUI component
 * Provides UI for experimenting with different background models
 * Integrated directly into the existing UI
 */
class ModelLabUI {
    constructor(backgroundModelFactory, backgroundService, debugCallback) {
        this.modelFactory = backgroundModelFactory;
        this.backgroundService = backgroundService;
        this.debugCallback = debugCallback || console.log;
        this.currentModelInfo = null;
        this.fpsHistory = [];
        this.fpsUpdateInterval = null;
    }

    /**
     * Initialize the lab UI by enhancing the existing UI
     */
    async init() {
        this.debugCallback('Initializing Model Lab UI...');
        
        // Create model lab UI elements and add to the existing UI
        await this._createModelLabUI();
        
        // Load available models
        await this._loadAvailableModels();
        
        // Start performance monitoring
        this._startPerformanceMonitoring();
        
        return true;
    }

    /**
     * Create and inject the model lab UI into the existing UI
     * @private
     */
    async _createModelLabUI() {
        // Find the performance metrics section to add our models panel after it
        const performanceMetrics = document.getElementById('performanceMetrics');
        
        if (!performanceMetrics) {
            this.debugCallback('Performance metrics element not found');
            return;
        }

        // Create the models lab section
        const labSection = document.createElement('div');
        labSection.id = 'modelLabSection';
        labSection.className = 'model-lab-section';
        labSection.innerHTML = `
            <div class="lab-header">
                <h3 class="flex items-center gap-2">
                    <i class="fas fa-flask"></i> 
                    <span>Virtual Background Models</span>
                    <button class="collapse-btn" title="Toggle section visibility">
                        <i class="fas fa-chevron-down"></i>
                    </button>
                </h3>
                <span class="lab-subtitle">Test different segmentation models and configurations</span>
            </div>
            
            <div class="lab-content">
                <div class="device-capabilities-section">
                    <div class="section-header" data-section="device-info">
                        <h4>Device Capabilities</h4>
                        <button class="collapse-btn" title="Toggle section visibility">
                            <i class="fas fa-chevron-down"></i>
                        </button>
                    </div>
                    <div class="section-content" id="device-info-content">
                        <div id="device-info" class="device-info-grid">Loading capabilities...</div>
                    </div>
                </div>
                
                <div class="model-selection-section">
                    <div class="section-header" data-section="model-selection">
                        <h4>Available Models</h4>
                        <button class="collapse-btn" title="Toggle section visibility">
                            <i class="fas fa-chevron-down"></i>
                        </button>
                    </div>
                    <div class="section-content" id="model-selection-content">
                        <div id="model-selection">Loading available models...</div>
                    </div>
                </div>
            </div>
        `;
        
        // Add CSS styles for the lab section
        const styleEl = document.createElement('style');
        styleEl.textContent = `
            .model-lab-section {
                margin-top: 15px;
                padding: 10px;
                background-color: rgba(0, 0, 0, 0.02);
                border: 1px solid var(--neutral-200);
                border-radius: 8px;
            }
            
            .lab-header {
                display: flex;
                flex-direction: column;
            }
            
            .lab-header h3 {
                margin: 0;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            
            .lab-subtitle {
                font-size: 0.85rem;
                color: var(--neutral-500);
                margin-top: 3px;
                margin-left: 22px;
            }
            
            .section-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin: 8px 0 3px;
                padding-bottom: 3px;
                border-bottom: 1px solid var(--neutral-100);
            }
            
            .section-header h4 {
                margin: 0;
                font-size: 0.95rem;
            }
            
            .collapse-btn {
                background: none;
                border: none;
                cursor: pointer;
                padding: 2px 6px;
                color: var(--neutral-500);
                border-radius: 4px;
                transition: all 0.2s ease;
            }
            
            .collapse-btn:hover {
                background-color: var(--neutral-100);
                color: var(--neutral-700);
            }
            
            .collapse-btn.collapsed i {
                transform: rotate(-90deg);
            }
            
            .section-content.collapsed {
                display: none;
            }
            
            .device-capabilities-section,
            .model-selection-section {
                margin-top: 6px;
                background-color: white;
                border-radius: 6px;
                padding: 6px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            }
            
            .device-info-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
                gap: 6px;
                margin-top: 6px;
                font-size: 12px;
            }
            
            .device-info-item {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 3px 6px;
                background-color: rgba(0,0,0,0.01);
                border-radius: 4px;
            }
            
            .device-info-value {
                font-weight: 500;
                margin-left: auto;
            }
            
            .model-option {
                padding: 8px;
                border-radius: 6px;
                margin-bottom: 6px;
                background-color: white;
                border: 1px solid var(--neutral-200);
                transition: all 0.2s ease;
            }
            
            .model-option.selected {
                background-color: rgba(var(--primary-rgb), 0.05);
                border-color: var(--primary-color);
            }
            
            .model-option-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 4px;
            }
            
            .model-name {
                font-weight: 500;
                font-size: 13px;
            }
            
            .model-badge {
                font-size: 10px;
                padding: 1px 5px;
                border-radius: 10px;
            }
            
            .model-badge.implemented {
                background-color: rgba(var(--success-rgb), 0.1);
                color: var(--success-color);
            }
            
            .model-badge.coming-soon {
                background-color: rgba(var(--warning-rgb), 0.1);
                color: var(--warning-color);
            }
            
            .model-description {
                font-size: 12px;
                color: var(--neutral-600);
                margin-bottom: 6px;
            }
            
            .model-variants {
                margin-left: 10px;
                border-left: 2px solid var(--neutral-200);
                padding-left: 10px;
            }
            
            .variant-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 4px 0;
                border-bottom: 1px solid var(--neutral-100);
            }
            
            .variant-item:last-child {
                border-bottom: none;
            }
            
            .variant-info {
                font-size: 12px;
                max-width: 65%;
            }
            
            .variant-name {
                font-weight: 500;
                margin-bottom: 0;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .variant-specs {
                font-size: 11px;
                color: var(--neutral-600);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .incompatibility-reason {
                font-size: 10px;
                color: var(--danger-color);
                margin-top: 1px;
            }
            
            button.select-model-btn,
            button.try-variant-btn {
                padding: 3px 8px;
                border: none;
                border-radius: 4px;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.2s ease;
                white-space: nowrap;
            }
            
            button.select-model-btn {
                background-color: var(--primary-color);
                color: white;
            }
            
            button.try-variant-btn {
                background-color: var(--secondary-color);
                color: white;
                min-width: 50px;
            }
            
            button:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            button.select-model-btn:hover:not(:disabled),
            button.try-variant-btn:hover:not(:disabled) {
                filter: brightness(1.1);
            }
            
            .model-lab-section.collapsed .lab-content {
                display: none;
            }
            
            /* Compact model selector layout */
            .compact-models-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                gap: 8px;
            }
        `;
        
        // Insert the styles and lab section
        document.head.appendChild(styleEl);
        
        // Insert after performance metrics
        performanceMetrics.parentNode.insertBefore(labSection, performanceMetrics.nextSibling);
        
        // Add event listeners for collapsible sections
        this._setupCollapsibleSections();
    }

    /**
     * Set up collapsible sections behavior
     * @private 
     */
    _setupCollapsibleSections() {
        // Main section collapse toggle
        const mainSection = document.getElementById('modelLabSection');
        const mainToggle = mainSection.querySelector('.lab-header .collapse-btn');
        
        mainToggle.addEventListener('click', () => {
            mainSection.classList.toggle('collapsed');
            mainToggle.classList.toggle('collapsed');
            const icon = mainToggle.querySelector('i');
            icon.className = mainSection.classList.contains('collapsed') ? 
                'fas fa-chevron-right' : 'fas fa-chevron-down';
        });
        
        // Sub-sections collapse toggles
        const sectionHeaders = document.querySelectorAll('.section-header');
        
        sectionHeaders.forEach(header => {
            const sectionId = header.getAttribute('data-section');
            const content = document.getElementById(`${sectionId}-content`);
            const toggleBtn = header.querySelector('.collapse-btn');
            
            toggleBtn.addEventListener('click', () => {
                content.classList.toggle('collapsed');
                toggleBtn.classList.toggle('collapsed');
                const icon = toggleBtn.querySelector('i');
                icon.className = content.classList.contains('collapsed') ? 
                    'fas fa-chevron-right' : 'fas fa-chevron-down';
            });
        });
    }
    
    /**
     * Load and display available models
     * @private
     */
    async _loadAvailableModels() {
        const modelSelectionDiv = document.getElementById('model-selection');
        if (!modelSelectionDiv) return;
        
        // Get available models
        const availableModels = this.modelFactory.getAvailableModels();
        const deviceCapabilities = this.modelFactory.getDeviceCapabilities();
        
        // Display device capabilities
        const deviceInfoDiv = document.getElementById('device-info');
        if (deviceInfoDiv) {
            deviceInfoDiv.innerHTML = `
                <div class="device-info-item">
                    <div>SIMD:</div>
                    <div class="device-info-value" style="color: ${deviceCapabilities.simdSupport ? 'var(--success-color)' : 'var(--danger-color)'}">
                        ${deviceCapabilities.simdSupport ? 'Yes' : 'No'}
                    </div>
                </div>
                <div class="device-info-item">
                    <div>WebGL:</div>
                    <div class="device-info-value" style="color: ${deviceCapabilities.webglSupport ? 'var(--success-color)' : 'var(--danger-color)'}">
                        ${deviceCapabilities.webglSupport ? 'Yes' : 'No'}
                    </div>
                </div>
                <div class="device-info-item">
                    <div>WebGL 2:</div>
                    <div class="device-info-value" style="color: ${deviceCapabilities.webgl2Support ? 'var(--success-color)' : 'var(--danger-color)'}">
                        ${deviceCapabilities.webgl2Support ? 'Yes' : 'No'}
                    </div>
                </div>
                <div class="device-info-item">
                    <div>CPU Cores:</div>
                    <div class="device-info-value">${deviceCapabilities.cores}</div>
                </div>
                <div class="device-info-item">
                    <div>Performance:</div>
                    <div class="device-info-value">${deviceCapabilities.devicePerformance}</div>
                </div>
                <div class="device-info-item">
                    <div>Recommended:</div>
                    <div class="device-info-value">${deviceCapabilities.recommendedModel}</div>
                </div>
            `;
        }
        
        // Clear previous content
        modelSelectionDiv.innerHTML = '';
        
        // Create a container grid for models
        const modelsGrid = document.createElement('div');
        modelsGrid.className = 'compact-models-grid';
        modelSelectionDiv.appendChild(modelsGrid);
        
        // Add auto (recommended) option
        const autoDiv = document.createElement('div');
        autoDiv.className = `model-option ${!deviceCapabilities.preferredModel || deviceCapabilities.preferredModel === 'auto' ? 'selected' : ''}`;
        
        autoDiv.innerHTML = `
            <div class="model-option-header">
                <div class="model-name">Auto (Recommended)</div>
                <button class="select-model-btn">
                    ${!deviceCapabilities.preferredModel ? 'Selected' : 'Select'}
                </button>
            </div>
            <div class="model-description">
                Auto-selects optimal model for your device
            </div>
        `;
        
        autoDiv.querySelector('.select-model-btn').addEventListener('click', async () => {
            await this._selectModel('auto');
        });
        
        modelsGrid.appendChild(autoDiv);
        
        // Create elements for each model
        availableModels.forEach(model => {
            const modelDiv = document.createElement('div');
            modelDiv.className = `model-option ${deviceCapabilities.preferredModel === model.id ? 'selected' : ''}`;
            
            let modelContent = `
                <div class="model-option-header">
                    <div class="model-name">${model.name}</div>
                    <div class="model-badge ${model.isImplemented ? 'implemented' : 'coming-soon'}">
                        ${model.isImplemented ? 'Available' : 'Coming Soon'}
                    </div>
                </div>
                <div class="model-description">${model.description ? model.description.split('(')[0] : ''}</div>
            `;
            
            // Add variants if available
            if (model.variants && model.variants.length > 0) {
                modelContent += '<div class="model-variants">';
                model.variants.forEach(variant => {
                    const isDisabled = !model.isImplemented || !variant.isCompatible;
                    modelContent += `
                        <div class="variant-item ${isDisabled ? 'disabled' : ''}">
                            <div class="variant-info">
                                <div class="variant-name">${variant.name.replace(/^.*?\s/, '')}</div>
                                <div class="variant-specs">
                                    ${variant.resolution} | ${variant.fps}
                                    ${variant.backend ? ` | ${variant.backend}` : ''}
                                </div>
                                ${variant.incompatibilityReason ? 
                                    `<div class="incompatibility-reason">${variant.incompatibilityReason}</div>` : ''
                                }
                            </div>
                            <button class="try-variant-btn" data-model="${model.id}" data-variant="${variant.name}" 
                                ${isDisabled ? 'disabled' : ''}>
                                ${isDisabled ? 'N/A' : 'Try'}
                            </button>
                        </div>
                    `;
                });
                modelContent += '</div>';
            } else {
                // Add select button for models without variants
                modelContent += `
                    <div style="text-align: right; margin-top: 6px;">
                        <button class="select-model-btn" data-model="${model.id}" 
                            ${!model.isImplemented ? 'disabled' : ''}>
                            ${model.isImplemented ? 
                                (deviceCapabilities.preferredModel === model.id ? 'Selected' : 'Select') : 
                                'Coming Soon'
                            }
                        </button>
                    </div>
                `;
            }
            
            modelDiv.innerHTML = modelContent;
            modelsGrid.appendChild(modelDiv);
        });
        
        // Add event listeners for variant buttons
        document.querySelectorAll('.try-variant-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const modelId = btn.getAttribute('data-model');
                const variantName = btn.getAttribute('data-variant');
                
                // Find variant configuration
                const model = availableModels.find(m => m.id === modelId);
                const variant = model?.variants?.find(v => v.name === variantName);
                
                if (model && variant) {
                    await this._selectModel(modelId, {
                        variant: variantName,
                        resolution: variant.resolution,
                        backend: variant.backend,
                        simdRequired: variant.simdRequired
                    });
                }
            });
        });
        
        // Add event listeners for select model buttons
        document.querySelectorAll('.select-model-btn').forEach(btn => {
            if (btn.hasAttribute('data-model')) {
                btn.addEventListener('click', async () => {
                    const modelId = btn.getAttribute('data-model');
                    await this._selectModel(modelId);
                });
            }
        });
    }
    
    /**
     * Select a background model to use
     * @param {string} modelId The model ID to select
     * @param {Object} config Optional configuration for the model
     * @private
     */
    async _selectModel(modelId, config = {}) {
        this.debugCallback(`Selecting model: ${modelId} with config:`, config);
        
        try {
            if (modelId === 'auto') {
                // Reset to auto selection
                this.modelFactory.resetUserPreferredModel();
            } else {
                // Set user preferred model
                this.modelFactory.setUserPreferredModel(modelId, config);
            }
            
            // Reload the background model
            await this.backgroundService.reloadBackgroundModel();
            
            // Update UI to reflect changes
            await this._loadAvailableModels();
            
            this.debugCallback(`Model changed to ${modelId} successfully`);
        } catch (error) {
            this.debugCallback(`Error changing model: ${error.message}`);
        }
    }
    
    /**
     * Start monitoring performance metrics
     * @private
     */
    _startPerformanceMonitoring() {
        if (this.fpsUpdateInterval) {
            clearInterval(this.fpsUpdateInterval);
        }
        
        this.fpsUpdateInterval = setInterval(() => {
            // We're using the existing performance metrics display,
            // so we don't need to update anything here
        }, 1000);
    }
    
    /**
     * Stop performance monitoring
     * @private
     */
    _stopPerformanceMonitoring() {
        if (this.fpsUpdateInterval) {
            clearInterval(this.fpsUpdateInterval);
            this.fpsUpdateInterval = null;
        }
    }
    
    /**
     * Clean up resources
     */
    dispose() {
        this._stopPerformanceMonitoring();
    }
}

export default ModelLabUI;