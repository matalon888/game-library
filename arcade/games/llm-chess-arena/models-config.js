/**
 * Models Configuration File
 * 
 * This file contains all the model configurations for the LLM Chess Arena.
 * You can easily add or modify models by editing this file.
 */

const PROVIDER_CONFIG = {
    'groq': {
        displayName: 'Groq',
        models: {
            'llama-3.3-70b-versatile': {
                displayName: 'LLaMa 3.3 70B',
                tempRange: { min: 0.1, max: 1.0 }
            },
            'openai/gpt-oss-120b': {
                displayName: 'GPT-OSS 120B',
                tempRange: { min: 0.1, max: 1.0 }
            }
        }
    },
    'openai': {
        displayName: 'OpenAI',
        models: {
            'gpt-4.1': {
                displayName: 'GPT-4.1',
                tempRange: { min: 0.1, max: 1.0 }
            },
            'gpt-4.1-mini': {
                displayName: 'GPT-4.1 mini',
                tempRange: { min: 0.1, max: 1.0 }
            },
            'gpt-4o': {
                displayName: 'GPT-4o',
                tempRange: { min: 0.1, max: 1.0 }
            }
        }
    },
    'gemini': {
        displayName: 'Google Gemini',
        models: {
            'gemini-flash-latest': {
                displayName: 'Gemini Flash',
                tempRange: { min: 0.1, max: 1.0 }
            },
            'gemini-pro-latest': {
                displayName: 'Gemini Pro',
                tempRange: { min: 0.1, max: 1.0 }
            },
            'gemini-flash-lite-latest': {
                displayName: 'Gemini Flash-Lite',
                tempRange: { min: 0.1, max: 1.0 }
            }
        }
    },
    'grok': {
        displayName: 'xAI Grok',
        models: {
            'grok-4.5': {
                displayName: 'Grok 4.5',
                tempRange: { min: 0.1, max: 1.0 }
            }
        }
    },
    'openrouter': {
        displayName: 'OpenRouter',
        models: {
            'anthropic/claude-sonnet-5.5': {
                displayName: 'Claude Sonnet 5.5',
                tempRange: { min: 0.1, max: 1.0 }
            },
            'anthropic/claude-haiku-5.5': {
                displayName: 'Claude Haiku 5.5',
                tempRange: { min: 0.1, max: 1.0 }
            },
            'anthropic/claude-opus-5.5': {
                displayName: 'Claude Opus 5.5',
                tempRange: { min: 0.1, max: 1.0 }
            },
            'openai/gpt-5.6-luna': {
                displayName: 'GPT-5.6 Luna',
                tempRange: { min: 0.1, max: 1.0 }
            },
            'google/gemini-3.8-flash': {
                displayName: 'Gemini 3.8 Flash',
                tempRange: { min: 0.1, max: 1.0 }
            },
            'x-ai/grok-4.7': {
                displayName: 'Grok 4.7',
                tempRange: { min: 0.1, max: 1.0 }
            }
        }
    }
};

// Export the configuration
if (typeof module !== 'undefined') {
    module.exports = { PROVIDER_CONFIG };
}

// Make available globally for browser
if (typeof window !== 'undefined') {
    console.log("🔍 Setting up global config in browser environment");
    console.log("📋 PROVIDER_CONFIG:", JSON.stringify(Object.keys(PROVIDER_CONFIG), null, 2));
    
    window.PROVIDERS_CONFIG = PROVIDER_CONFIG;
    console.log("✅ Assigned to window.PROVIDERS_CONFIG");
    
    // Also provide as PROVIDER_CONFIG for potential compatibility
    window.PROVIDER_CONFIG = PROVIDER_CONFIG;
    console.log("✅ Assigned to window.PROVIDER_CONFIG");
}
