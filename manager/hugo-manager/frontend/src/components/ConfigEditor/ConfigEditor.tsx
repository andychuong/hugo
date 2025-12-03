import { useState, useEffect } from 'react';
import { GetConfigFileInfo, GetConfig, UpdateConfig, ValidateConfig, GetAvailableEnvironments, ConvertConfigFormat } from '../../../wailsjs/go/handlers/App';
import { models } from '../../../wailsjs/go/models';

interface ConfigEditorProps {
  projectId: string;
}

type ConfigFileInfo = models.ConfigFileInfo;

export default function ConfigEditor({ projectId }: ConfigEditorProps) {
  const [config, setConfig] = useState<Record<string, any>>({});
  const [configInfo, setConfigInfo] = useState<ConfigFileInfo | null>(null);
  const [environments, setEnvironments] = useState<string[]>([]);
  const [selectedEnvironment, setSelectedEnvironment] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [debounceTimer, setDebounceTimer] = useState<number | null>(null);
  const [languageCodeOpen, setLanguageCodeOpen] = useState(false);
  const [languageCodeFiltering, setLanguageCodeFiltering] = useState(false);

  // Common language codes for Hugo
  const commonLanguageCodes = [
    'en', 'en-us', 'en-gb', 'en-ca', 'en-au',
    'es', 'es-es', 'es-mx', 'es-ar',
    'fr', 'fr-fr', 'fr-ca',
    'de', 'de-de', 'de-at', 'de-ch',
    'it', 'it-it',
    'pt', 'pt-br', 'pt-pt',
    'ru', 'ru-ru',
    'ja', 'ja-jp',
    'zh', 'zh-cn', 'zh-tw',
    'ko', 'ko-kr',
    'ar', 'ar-sa',
    'hi', 'hi-in',
    'nl', 'nl-nl',
    'sv', 'sv-se',
    'pl', 'pl-pl',
    'tr', 'tr-tr',
    'cs', 'cs-cz',
    'da', 'da-dk',
    'fi', 'fi-fi',
    'no', 'no-no',
    'he', 'he-il',
    'th', 'th-th',
    'vi', 'vi-vn',
  ];

  useEffect(() => {
    loadConfig();
  }, [projectId, selectedEnvironment]);

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const info = await GetConfigFileInfo(projectId);
      setConfigInfo(info);
      
      if (info.isDir) {
        const envs = await GetAvailableEnvironments(projectId);
        setEnvironments(envs);
      }

      const configData = await GetConfig(projectId, selectedEnvironment);
      setConfig(configData);
    } catch (err: any) {
      setError(err.message || 'Failed to load config');
    } finally {
      setLoading(false);
    }
  };

  // Helper to update nested config values
  const updateNestedValue = (obj: Record<string, any>, path: string[], value: any): Record<string, any> => {
    const newObj = { ...obj };
    let current = newObj;
    for (let i = 0; i < path.length - 1; i++) {
      current[path[i]] = { ...current[path[i]] };
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;
    return newObj;
  };

  // Save config value - called on blur, Enter, or after long debounce
  const saveConfigValue = async (keyPath: string[], newValue: any) => {
    // Clear any pending debounce timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      setDebounceTimer(null);
    }

    // Validate
    try {
      await ValidateConfig(keyPath, newValue);
    } catch (err: any) {
      setError(err.message || 'Validation failed');
      return;
    }

    // Save the value
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await UpdateConfig(projectId, keyPath, newValue);
      setSuccess('Config updated successfully');
      await loadConfig();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update config');
    } finally {
      setSaving(false);
    }
  };

  // Handle value change - updates local state immediately, saves on blur/Enter
  const handleValueChange = (keyPath: string[], newValue: any) => {
    // Update local config state immediately for responsive UI
    setConfig(updateNestedValue(config, keyPath, newValue));

    // Clear existing debounce timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // Set a long debounce as fallback (2 seconds) - only triggers if user doesn't blur/Enter
    const timer = setTimeout(() => {
      saveConfigValue(keyPath, newValue);
    }, 2000);

    setDebounceTimer(timer);
  };

  // Handle blur - save immediately
  const handleValueBlur = (keyPath: string[], currentValue: any) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      setDebounceTimer(null);
    }
    saveConfigValue(keyPath, currentValue);
  };

  // Handle Enter key - save immediately
  const handleValueKeyDown = (e: React.KeyboardEvent, keyPath: string[], currentValue: any) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        setDebounceTimer(null);
      }
      saveConfigValue(keyPath, currentValue);
      // Blur the input to close any dropdowns
      (e.target as HTMLInputElement).blur();
    }
  };

  const handleFormatChange = async (newFormat: string) => {
    if (!configInfo) return;

    if (confirm(`Convert config file to ${newFormat.toUpperCase()}? This will replace the current config file.`)) {
      try {
        await ConvertConfigFormat(projectId, newFormat);
        setSuccess(`Config converted to ${newFormat.toUpperCase()}`);
        await loadConfig();
        setTimeout(() => setSuccess(null), 3000);
      } catch (err: any) {
        setError(err.message || 'Failed to convert config format');
      }
    }
  };

  const renderValue = (key: string, value: any, keyPath: string[] = []): JSX.Element => {
    const currentKeyPath = [...keyPath, key];

    if (value === null || value === undefined) {
      return (
        <div className="flex items-center gap-2">
          <span className="text-gray-400 min-w-[120px]">{key}:</span>
          {configInfo?.isDir ? (
            <span className="text-gray-500">null</span>
          ) : (
            <input
              type="text"
              value=""
              placeholder="null"
              onChange={(e) => {
                const newValue = e.target.value === '' ? null : e.target.value;
                handleValueChange(currentKeyPath, newValue);
              }}
              className="flex-1 px-2 py-1 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
          )}
        </div>
      );
    }

    if (typeof value === 'string') {
      // Special handling for languageCode with combobox
      if (key === 'languageCode' && !configInfo?.isDir) {
        // Show all codes when dropdown opens, filter only when user is actively typing
        const filteredCodes = languageCodeFiltering && value.trim() !== ''
          ? commonLanguageCodes.filter(code =>
              code.toLowerCase().includes(value.toLowerCase())
            )
          : commonLanguageCodes;
        const showDropdown = languageCodeOpen;

        return (
          <div className="flex items-center gap-2 relative">
            <span className="text-gray-400 min-w-[120px]">{key}:</span>
            <div className="flex-1 relative">
              <div className="flex gap-1">
                <input
                  type="text"
                  value={value}
                  onChange={(e) => {
                    handleValueChange(currentKeyPath, e.target.value);
                    setLanguageCodeOpen(true);
                    setLanguageCodeFiltering(true);
                  }}
                  onFocus={() => {
                    setLanguageCodeOpen(true);
                    setLanguageCodeFiltering(false);
                  }}
                  onBlur={(e) => {
                    // Save on blur
                    handleValueBlur(currentKeyPath, e.target.value);
                    // Delay to allow dropdown click
                    setTimeout(() => {
                      setLanguageCodeOpen(false);
                      setLanguageCodeFiltering(false);
                    }, 200);
                  }}
                  onKeyDown={(e) => handleValueKeyDown(e, currentKeyPath, value)}
                  placeholder="e.g., en-us"
                  className="flex-1 px-2 py-1 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    setLanguageCodeOpen(!languageCodeOpen);
                    setLanguageCodeFiltering(false);
                  }}
                  className="px-2 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded border border-gray-600"
                  title="Show language codes"
                >
                  ▼
                </button>
              </div>
              {showDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-600 rounded shadow-lg max-h-60 overflow-y-auto">
                  {filteredCodes.length > 0 ? (
                    filteredCodes.map((code) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => {
                          // Update local state
                          setConfig(updateNestedValue(config, currentKeyPath, code));
                          // Save immediately when selecting from dropdown
                          if (debounceTimer) {
                            clearTimeout(debounceTimer);
                            setDebounceTimer(null);
                          }
                          saveConfigValue(currentKeyPath, code);
                          setLanguageCodeOpen(false);
                          setLanguageCodeFiltering(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-700 text-white text-sm"
                      >
                        {code}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-gray-400 text-sm">
                      No matches found
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      }

      return (
        <div className="flex items-center gap-2">
          <span className="text-gray-400 min-w-[120px]">{key}:</span>
          {configInfo?.isDir ? (
            <span className="text-green-300">"{value}"</span>
          ) : (
            <input
              type="text"
              value={value}
              onChange={(e) => handleValueChange(currentKeyPath, e.target.value)}
              onBlur={(e) => handleValueBlur(currentKeyPath, e.target.value)}
              onKeyDown={(e) => handleValueKeyDown(e, currentKeyPath, value)}
              className="flex-1 px-2 py-1 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
          )}
        </div>
      );
    }

    if (typeof value === 'number') {
      return (
        <div className="flex items-center gap-2">
          <span className="text-gray-400 min-w-[120px]">{key}:</span>
          {configInfo?.isDir ? (
            <span className="text-hugo-accent-tealLight">{String(value)}</span>
          ) : (
            <input
              type="number"
              value={value}
              onChange={(e) => {
                const num = parseFloat(e.target.value);
                handleValueChange(currentKeyPath, isNaN(num) ? 0 : num);
              }}
              onBlur={(e) => {
                const num = parseFloat(e.target.value);
                handleValueBlur(currentKeyPath, isNaN(num) ? 0 : num);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const num = parseFloat((e.target as HTMLInputElement).value);
                  handleValueKeyDown(e, currentKeyPath, isNaN(num) ? 0 : num);
                }
              }}
              className="flex-1 px-2 py-1 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
          )}
        </div>
      );
    }

    if (typeof value === 'boolean') {
      return (
        <div className="flex items-center gap-2">
          <span className="text-gray-400 min-w-[120px]">{key}:</span>
          {configInfo?.isDir ? (
            <span className="text-hugo-accent-tealLight">{String(value)}</span>
          ) : (
            <input
              type="checkbox"
              checked={value}
              onChange={(e) => handleValueChange(currentKeyPath, e.target.checked)}
              className="w-4 h-4 text-hugo-accent-teal bg-gray-700 border-gray-600 rounded focus:ring-hugo-accent-teal"
            />
          )}
        </div>
      );
    }

    if (Array.isArray(value)) {
      return (
        <div className="ml-4 border-l-2 border-gray-700 pl-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-gray-400">{key}:</span>
          </div>
          {configInfo?.isDir ? (
            value.map((item, idx) => (
              <div key={idx} className="mb-1">
                {renderValue(`[${idx}]`, item, currentKeyPath)}
              </div>
            ))
          ) : (
            <textarea
              value={JSON.stringify(value, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  handleValueChange(currentKeyPath, parsed);
                } catch {
                  // Invalid JSON, ignore for now
                }
              }}
              onBlur={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  handleValueBlur(currentKeyPath, parsed);
                } catch {
                  // Invalid JSON, don't save
                }
              }}
              onKeyDown={(e) => {
                // Ctrl+Enter or Cmd+Enter to save
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  try {
                    const parsed = JSON.parse((e.target as HTMLTextAreaElement).value);
                    handleValueKeyDown(e, currentKeyPath, parsed);
                  } catch {
                    // Invalid JSON, don't save
                  }
                }
              }}
              className="w-full px-2 py-1 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none font-mono text-sm"
              rows={Math.min(value.length + 2, 10)}
            />
          )}
        </div>
      );
    }

    if (typeof value === 'object') {
      return (
        <div className="ml-4 border-l-2 border-gray-700 pl-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-gray-400">{key}:</span>
          </div>
          {configInfo?.isDir ? (
            Object.entries(value).map(([k, v]) => (
              <div key={k} className="mb-2">
                {renderValue(k, v, currentKeyPath)}
              </div>
            ))
          ) : (
            <textarea
              value={JSON.stringify(value, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  handleValueChange(currentKeyPath, parsed);
                } catch {
                  // Invalid JSON, ignore for now
                }
              }}
              onBlur={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  handleValueBlur(currentKeyPath, parsed);
                } catch {
                  // Invalid JSON, don't save
                }
              }}
              onKeyDown={(e) => {
                // Ctrl+Enter or Cmd+Enter to save
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  try {
                    const parsed = JSON.parse((e.target as HTMLTextAreaElement).value);
                    handleValueKeyDown(e, currentKeyPath, parsed);
                  } catch {
                    // Invalid JSON, don't save
                  }
                }
              }}
              className="w-full px-2 py-1 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none font-mono text-sm"
              rows={Math.min(Object.keys(value).length + 2, 10)}
            />
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <span className="text-gray-400 min-w-[120px]">{key}:</span>
        <span className="text-gray-400">{String(value)}</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-400">Loading config...</div>
      </div>
    );
  }

  if (error && !configInfo) {
    return (
      <div className="p-4 bg-red-900/20 border border-red-700 rounded">
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with format selector and environment selector */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {configInfo && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-gray-400">Format:</span>
                <span className="text-white font-mono">{configInfo.format.toUpperCase()}</span>
                {!configInfo.isDir && (
                  <select
                    onChange={(e) => handleFormatChange(e.target.value)}
                    className="ml-2 px-2 py-1 bg-gray-700 text-white rounded"
                    value=""
                  >
                    <option value="">Convert to...</option>
                    {configInfo.format !== 'toml' && <option value="toml">TOML</option>}
                    {configInfo.format !== 'yaml' && <option value="yaml">YAML</option>}
                    {configInfo.format !== 'json' && <option value="json">JSON</option>}
                  </select>
                )}
              </div>
              {configInfo.isDir && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">Environment:</span>
                  <select
                    value={selectedEnvironment}
                    onChange={(e) => setSelectedEnvironment(e.target.value)}
                    className="px-2 py-1 bg-gray-700 text-white rounded"
                  >
                    <option value="">Default</option>
                    {environments.map((env) => (
                      <option key={env} value={env}>
                        {env}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}
        </div>
        <button
          onClick={loadConfig}
          className="px-4 py-2 bg-hugo-accent-teal hover:bg-hugo-accent-tealLight rounded"
        >
          Refresh
        </button>
      </div>

      {/* Config info */}
      {configInfo && (
        <div className="text-sm text-gray-400">
          <p>Config file: {configInfo.path}</p>
          {configInfo.isDir && (
            <p className="mt-1">
              Note: Directory-based configs are read-only. Edit individual files in the config directory.
            </p>
          )}
        </div>
      )}

      {/* Config content */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Configuration</h2>
        <div className="space-y-4 font-mono text-sm">
          {Object.keys(config).length === 0 ? (
            <div className="text-gray-500">No configuration found</div>
          ) : (
            Object.entries(config).map(([key, value]) => (
              <div key={key} className="mb-2">
                {renderValue(key, value)}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Success/Error messages - at bottom with reduced padding */}
      {success && (
        <div className="px-3 py-2 bg-green-900/20 border border-green-700 rounded">
          <div className="text-green-400 text-sm">{success}</div>
        </div>
      )}
      {error && (
        <div className="px-3 py-2 bg-red-900/20 border border-red-700 rounded">
          <div className="text-red-400 text-sm">{error}</div>
        </div>
      )}
      {saving && (
        <div className="px-3 py-2 bg-hugo-accent-teal/20 border border-hugo-accent-teal/50 rounded text-sm">
          <div className="text-hugo-accent-tealLight">Saving...</div>
        </div>
      )}
    </div>
  );
}

