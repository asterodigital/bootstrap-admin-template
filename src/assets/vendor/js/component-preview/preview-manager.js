// Preview Manager for Component Preview System
window.PreviewManager = class PreviewManager {
  static updateTimers = new Map()
  static CONFIG = {
    DEBOUNCE_DELAY: 300,
    THEME_SYNC_DELAY: 100,
    ERROR_DISPLAY_DURATION: 5000
  }

  static debounceByPreviewBox(previewBoxId, func, wait) {
    if (this.updateTimers.has(previewBoxId)) {
      clearTimeout(this.updateTimers.get(previewBoxId))
    }

    const timeoutId = setTimeout(() => {
      func()
      this.updateTimers.delete(previewBoxId)
    }, wait)

    this.updateTimers.set(previewBoxId, timeoutId)
  }

  static handleContentChange(editor, container) {
    if (!editor || !container) return

    const previewBox = container.closest('.preview-box') || container.closest('.preview-modal')
    if (!previewBox) return

    const iframe = previewBox.querySelector('.preview-iframe')
    if (!iframe) return

    // Debounce updates by preview box
    const previewBoxId = previewBox.id || 'default'
    this.debounceByPreviewBox(
      previewBoxId,
      () => {
        try {
          // Check if using external source
          const externalSrc = previewBox.dataset.externalSrc
          if (externalSrc) {
            // For external sources, only update if src has changed
            if (iframe.src !== externalSrc) {
              //iframe.src = externalSrc
            }
          } else {
            // Get all editors
            const htmlEditor = window.CodeMirrorManager?.getEditorFromPreviewBox(previewBox, 'html')
            const cssEditor = window.CodeMirrorManager?.getEditorFromPreviewBox(previewBox, 'css')
            const jsEditor = window.CodeMirrorManager?.getEditorFromPreviewBox(
              previewBox,
              'javascript'
            )

            // Validate editors and content
            const validateEditor = (editor, type) => {
              if (!editor) return ''
              try {
                const value = editor.getValue()
                return typeof value === 'string' ? value : ''
              } catch (err) {
                console.error(`Error getting ${type} content:`, err)
                return ''
              }
            }

            const htmlContent = validateEditor(htmlEditor, 'HTML')
            const cssContent = validateEditor(cssEditor, 'CSS')
            const jsContent = validateEditor(jsEditor, 'JavaScript')

            // Get theme
            const themeToggle = previewBox.querySelector('.theme-toggle')
            const theme = themeToggle?.dataset.currentTheme || 'light'

            // Update iframe content with error handling
            if (iframe.contentWindow) {
              try {
                iframe.contentWindow.postMessage(
                  {
                    type: 'updateContent',
                    html: htmlContent,
                    css: cssContent,
                    js: jsContent
                  },
                  '*'
                )

                iframe.contentWindow.postMessage({ type: 'setTheme', theme: theme }, '*')

                // Clear any previous error messages
                const errorContainer = previewBox.querySelector('.preview-update-container')
                if (errorContainer) {
                  errorContainer.classList.add('d-none')
                }
              } catch (err) {
                console.error('Error updating iframe content:', err)
                this.showError(previewBox, 'Failed to update preview: ' + err.message)
              }
            } else {
              // Fallback to full refresh if contentWindow is not available
              const iframeContent = this.createIframeContent(
                htmlContent,
                cssContent,
                jsContent,
                theme
              )
              iframe.srcdoc = iframeContent
            }
          }

          // Sync with other previews
          this.syncPreviewContent(previewBox)
        } catch (err) {
          console.error('Error in content change handler:', err)
          this.showError(previewBox, 'An error occurred while updating the preview')
        }
      },
      this.CONFIG.DEBOUNCE_DELAY
    )
  }

  static showError(previewBox, message) {
    const errorContainer = previewBox.querySelector('.preview-update-container')
    if (!errorContainer) return

    errorContainer.classList.remove('d-none')
    errorContainer.innerHTML = `
      <div class="alert alert-warning alert-dismissible fade show m-2" role="alert">
        <strong>Error:</strong> ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>
    `

    // Auto-hide after a few seconds
    setTimeout(() => {
      const alert = errorContainer.querySelector('.alert')
      if (alert) {
        const bsAlert = new bootstrap.Alert(alert)
        bsAlert.close()
      }
    }, this.CONFIG.ERROR_DISPLAY_DURATION)
  }

  static updateIframeContent(previewBox) {
    if (!previewBox) return

    const iframe = previewBox.querySelector('.preview-iframe')
    if (!iframe) return

    // Check if using external source
    const externalSrc = previewBox.dataset.externalSrc
    if (externalSrc) {
      // For external sources, only update if src has changed
      if (iframe.src !== externalSrc) {
        //iframe.src = externalSrc
      }
      return
    }

    // For non-external sources, proceed with full content update
    // Get all editors
    const htmlEditor = window.CodeMirrorManager?.getEditorFromPreviewBox(previewBox, 'html')
    const cssEditor = window.CodeMirrorManager?.getEditorFromPreviewBox(previewBox, 'css')
    const jsEditor = window.CodeMirrorManager?.getEditorFromPreviewBox(previewBox, 'javascript')

    // Get content from editors
    const htmlContent = htmlEditor ? htmlEditor.getValue() : ''
    const cssContent = cssEditor ? cssEditor.getValue() : ''
    const jsContent = jsEditor ? jsEditor.getValue() : ''

    // Get theme
    const themeToggle = previewBox.querySelector('.theme-toggle')
    const theme = themeToggle?.dataset.currentTheme || 'light'

    if (iframe.dataset.initialized !== 'true') {
      const iframeContent = this.createIframeContent(htmlContent, cssContent, jsContent, theme)
      iframe.srcdoc = iframeContent
      iframe.dataset.initialized = 'true'
    } else {
      if (iframe.contentWindow) {
        try {
          iframe.contentWindow.postMessage(
            {
              type: 'updateContent',
              html: htmlContent,
              css: cssContent,
              js: jsContent
            },
            '*'
          )

          iframe.contentWindow.postMessage({ type: 'setTheme', theme: theme }, '*')
        } catch (e) {
          console.error('Error updating iframe content:', e)
          // Fallback to full refresh
          const iframeContent = this.createIframeContent(htmlContent, cssContent, jsContent, theme)
          iframe.srcdoc = iframeContent
        }
      } else {
        const iframeContent = this.createIframeContent(htmlContent, cssContent, jsContent, theme)
        iframe.srcdoc = iframeContent
      }
    }

    this.syncPreviewContent(previewBox)
  }

  static showJavaScriptError(previewBox, error) {
    const errorContainer = previewBox.querySelector('.preview-update-container')
    if (!errorContainer) return

    errorContainer.classList.remove('d-none')
    errorContainer.innerHTML = `
      <div class="alert alert-warning alert-dismissible fade show m-2" role="alert">
        <strong>JavaScript Error:</strong> ${error.message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>
    `

    // Auto-hide after a few seconds
    setTimeout(() => {
      const alert = errorContainer.querySelector('.alert')
      if (alert) {
        const bsAlert = new bootstrap.Alert(alert)
        bsAlert.close()
      }
    }, this.CONFIG.ERROR_DISPLAY_DURATION)
  }

  static syncPreviewContent(previewBox) {
    // Check if using external source
    const externalSrc = previewBox.dataset.externalSrc
    if (externalSrc) {
      // For external sources, only sync theme
      const themeToggle = previewBox.querySelector('.theme-toggle')
      const currentTheme = themeToggle?.dataset.currentTheme || 'light'

      if (typeof window.UIControlsManager !== 'undefined') {
        window.UIControlsManager.updateComponentTheme(previewBox, currentTheme)
      }
      return
    }

    // For non-external sources, proceed with full content sync
    if (previewBox.classList.contains('preview-box')) {
      const modalId =
        previewBox.dataset.modal ||
        previewBox
          .querySelector('.preview-expand')
          ?.getAttribute('data-bs-target')
          ?.replace('#', '')

      if (modalId) {
        const modal = document.getElementById(modalId)
        if (modal && modal.classList.contains('show') && modal.style.display !== 'none') {
          if (typeof window.UIControlsManager !== 'undefined') {
            window.UIControlsManager.syncModalContent(previewBox, modal)
          }
        }
      }
    }

    if (previewBox.classList.contains('preview-modal')) {
      const modalId = previewBox.id
      if (modalId) {
        const mainPreview = document.querySelector(`.preview-box[data-modal="${modalId}"]`)
        if (mainPreview) {
          this.updateIframeContent(mainPreview)
        }
      }
    }

    // Get component-specific theme
    const themeToggle = previewBox.querySelector('.theme-toggle')
    const currentTheme = themeToggle?.dataset.currentTheme || 'light'

    if (typeof window.UIControlsManager !== 'undefined') {
      window.UIControlsManager.updateComponentTheme(previewBox, currentTheme)
    }
  }

  static getCSSPath() {
    const isDev = window.location.port === '1234'
    return isDev ? '/dist/css/style.css' : '/css/style.min.css'
  }

  static getJSPath(filename) {
    const isDev = window.location.port === '1234'
    return isDev ? `/dist/js/${filename}.js` : `/js/${filename}.min.js`
  }

  static createIframeContent(htmlContent = '', cssContent = '', jsContent = '', theme = null) {
    if (theme === null) {
      theme = document.documentElement.getAttribute('data-bs-theme') || 'light'
    }

    return `
      <!DOCTYPE html>
      <html lang="en" data-bs-theme="${theme}">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">

        <script>
          // Initialize theme from parent
          document.documentElement.setAttribute('data-bs-theme', '${theme}');
          let themeVersion = 0;
        </script>

        <link href="${this.getCSSPath()}" rel="stylesheet">
        <link href="https://cdn.jsdelivr.net/npm/remixicon@4.6.0/fonts/remixicon.css" rel="stylesheet">
        <!-- Source Sans 3 from Google Fonts -->
        <link
          href="https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,200..900;1,200..900&family=Ubuntu+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap"
          rel="stylesheet"
        />

        <style id="component-style">
          body {
            padding: 1rem;
            margin: 0;
          }
          #component-wrapper {
            width: 100%;
            height: 100%;
            position: relative;
          }
          #component-html {
            width: 100%;
            height: 100%;
          }
          .theme-update {
            transition: background-color 0.3s ease;
          }
          .js-error {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            background-color: #f8d7da;
            color: #842029;
            padding: 0.5rem;
            font-family: monospace;
            font-size: 0.875rem;
            z-index: 1000;
            border-bottom: 1px solid #f5c2c7;
            max-height: 100px;
            overflow-y: auto;
          }
        </style>

        <style id="custom-css">
          ${cssContent}
        </style>

        <script>
          window.addEventListener('message', function(event) {
            if (!event.data || !event.data.type) return;

            switch (event.data.type) {
              case 'setTheme':
                const newTheme = event.data.theme;
                const newVersion = event.data.version || 0;
                const currentTheme = document.documentElement.getAttribute('data-bs-theme');

                // Only update if theme actually changed or version is newer
                if (currentTheme !== newTheme || newVersion > themeVersion) {
                  document.documentElement.setAttribute('data-bs-theme', newTheme);
                  document.body.classList.remove('theme-update');
                  void document.body.offsetWidth;
                  document.body.classList.add('theme-update');
                  themeVersion = newVersion;
                }

                // Acknowledge receipt with current theme and version
                window.parent.postMessage({
                  type: 'themeAcknowledged',
                  theme: document.documentElement.getAttribute('data-bs-theme'),
                  version: themeVersion
                }, '*');
                break;

              case 'updateContent':
                if (event.data.html !== undefined) {
                  document.getElementById('component-html').innerHTML = event.data.html;
                }
                if (event.data.css !== undefined) {
                  document.getElementById('custom-css').textContent = event.data.css;
                }
                if (event.data.js !== undefined) {
                  try {
                    const oldScript = document.getElementById('custom-js');
                    if (oldScript) oldScript.remove();

                    const newScript = document.createElement('script');
                    newScript.id = 'custom-js';
                    newScript.textContent = event.data.js;
                    document.body.appendChild(newScript);

                    // Remove any error display if script executed successfully
                    const errorElement = document.querySelector('.js-error');
                    if (errorElement) errorElement.remove();
                  } catch (error) {
                    console.error('Error executing JavaScript:', error);
                    // Show error in iframe
                    let errorElement = document.querySelector('.js-error');
                    if (!errorElement) {
                      errorElement = document.createElement('div');
                      errorElement.className = 'js-error';
                      document.body.prepend(errorElement);
                    }
                    errorElement.textContent = 'JavaScript Error: ' + error.message;
                  }
                }
                window.parent.postMessage({ type: 'contentAcknowledged' }, '*');
                break;
            }
          });

          // Catch runtime errors
          window.onerror = function(message, source, lineno, colno, error) {
            let errorElement = document.querySelector('.js-error');
            if (!errorElement) {
              errorElement = document.createElement('div');
              errorElement.className = 'js-error';
              document.body.prepend(errorElement);
            }
            errorElement.textContent = 'Runtime Error: ' + message;

            // Report back to parent
            window.parent.postMessage({
              type: 'jsError',
              message: message,
              line: lineno,
              column: colno
            }, '*');

            return true; // Prevents the error from appearing in the console
          };

          // Notify parent when iframe is ready
          window.addEventListener('load', function() {
            const currentTheme = document.documentElement.getAttribute('data-bs-theme');
            window.parent.postMessage({
              type: 'iframeReady',
              theme: currentTheme,
              version: themeVersion
            }, '*');
          });
        </script>
      </head>
      <body data-bs-theme="${theme}" class="theme-update">
        <div id="component-wrapper">
          <div id="component-html">
            ${htmlContent}
          </div>
        </div>
        <script src="${this.getJSPath('main')}" type="module"></script>
        <script id="custom-js">
          ${jsContent}
        </script>
      </body>
      </html>
    `
  }

  static createStandaloneHTML(htmlContent = '', cssContent = '', jsContent = '') {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Component Preview</title>
  <link href="https://cdn.jsdelivr.net/npm/asteroadmin@latest/dist/css/style.min.css" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/remixicon@4.6.0/fonts/remixicon.css" rel="stylesheet">
  <!-- Source Sans 3 from Google Fonts -->
  <link
    href="https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,200..900;1,200..900&family=Ubuntu+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap"
    rel="stylesheet"
  />
  <style>
    body {
      padding: 1rem;
    }
    ${cssContent}
  </style>
</head>
<body>
  ${htmlContent}
  <script src="https://cdn.jsdelivr.net/npm/asteroadmin@latest/dist/js/main.min.js" type="module"></script>
  <script>
    ${jsContent}
  </script>
</body>
</html>`
  }

  static resetAllCode(previewBox) {
    if (!previewBox) return

    // Reset HTML editor
    const htmlContainer = previewBox.querySelector(
      '.codemirror-editor-container[data-language="html"]'
    )
    if (htmlContainer && htmlContainer.editor && htmlContainer.defaultCode) {
      htmlContainer.editor.setValue(htmlContainer.defaultCode)
    }

    // Reset CSS editor
    const cssContainer = previewBox.querySelector(
      '.codemirror-editor-container[data-language="css"]'
    )
    if (cssContainer && cssContainer.editor && cssContainer.defaultCode) {
      cssContainer.editor.setValue(cssContainer.defaultCode)
    }

    // Reset JS editor
    const jsContainer = previewBox.querySelector(
      '.codemirror-editor-container[data-language="javascript"]'
    )
    if (jsContainer && jsContainer.editor && jsContainer.defaultCode) {
      jsContainer.editor.setValue(jsContainer.defaultCode)
    }

    // Update preview
    const iframe = previewBox.querySelector('.preview-iframe')
    if (iframe) {
      const htmlContent = htmlContainer?.defaultCode || ''
      const cssContent = cssContainer?.defaultCode || ''
      const jsContent = jsContainer?.defaultCode || ''
      const themeToggle = previewBox.querySelector('.theme-toggle')
      const theme = themeToggle?.dataset.currentTheme || 'light'

      this.updateIframeContent(previewBox, {
        html: htmlContent,
        css: cssContent,
        js: jsContent,
        theme
      })
    }
  }

  static setupResetButtons() {
    document.querySelectorAll('.reset-button, .reset-all-button').forEach((button) => {
      button.addEventListener('click', () => {
        const previewBox = button.closest('.preview-box') || button.closest('.preview-modal')
        if (!previewBox) return

        // If it's a reset-all button, reset all editors
        if (button.classList.contains('reset-all-button')) {
          this.resetAllCode(previewBox)
          return
        }

        // Otherwise, reset only the active editor
        const activeTab = previewBox.querySelector('.code-preview-nav .nav-link.active')
        if (!activeTab) return

        const targetId = activeTab.getAttribute('data-bs-target') || activeTab.getAttribute('href')
        if (!targetId) return

        const targetPane = previewBox.querySelector(targetId)
        if (!targetPane) return

        const editorContainer = targetPane.querySelector('.codemirror-editor-container')
        if (!editorContainer || !editorContainer.editor || !editorContainer.defaultCode) return

        // Reset the editor content
        editorContainer.editor.setValue(editorContainer.defaultCode)

        // Update the preview
        this.handleContentChange(editorContainer.editor, editorContainer)
      })
    })
  }

  static setupCodeToggles() {
    document.querySelectorAll('.preview-box').forEach((previewBox) => {
      const toggleBtn = previewBox.querySelector('.code-toggle-link')
      const codePreviewBox = previewBox.querySelector('.code-preview-box')

      if (toggleBtn && codePreviewBox) {
        toggleBtn.addEventListener('click', () => {
          const isHidden = !codePreviewBox.classList.contains('show')

          codePreviewBox.classList.toggle('show')
          toggleBtn.classList.toggle('active')
          toggleBtn.setAttribute('aria-expanded', isHidden ? 'true' : 'false')

          const btnText = toggleBtn.querySelector('span')
          if (btnText) {
            btnText.textContent = isHidden ? 'Hide Code' : 'Show Code'
          }

          const icon = toggleBtn.querySelector('i')
          if (icon) {
            icon.className = isHidden ? 'ri-code-line px-1' : 'ri-code-s-slash-line px-1'
          }

          if (isHidden) {
            setTimeout(() => {
              const editors = codePreviewBox.querySelectorAll('.codemirror-editor-container')
              editors.forEach((container) => {
                if (container.editor) {
                  container.editor.refresh()
                }
              })
            }, 300)
          }
        })
      }
    })
  }

  static setupThemeToggles() {
    // Theme toggle functionality
    document.querySelectorAll('.theme-toggle').forEach((button) => {
      button.addEventListener('click', () => {
        const currentTheme = button.dataset.currentTheme || 'light'
        const newTheme = currentTheme === 'light' ? 'dark' : 'light'

        // Update button state
        button.dataset.currentTheme = newTheme

        // Update icon
        const icon = button.querySelector('i')
        if (icon) {
          if (newTheme === 'dark') {
            icon.classList.remove('ri-sun-line')
            icon.classList.add('ri-moon-line')
            button.setAttribute('title', 'Switch to light theme')
          } else {
            icon.classList.remove('ri-moon-line')
            icon.classList.add('ri-sun-line')
            button.setAttribute('title', 'Switch to dark theme')
          }
        }

        // Find the preview box
        const previewBox = button.closest('.preview-box') || button.closest('.preview-modal')
        if (!previewBox) return

        // Find the iframe
        const iframe = previewBox.querySelector('.preview-iframe')
        if (!iframe || !iframe.contentWindow) return

        // Update iframe theme
        try {
          iframe.contentWindow.postMessage({ type: 'setTheme', theme: newTheme }, '*')
        } catch (e) {
          console.error('Error updating iframe theme:', e)
        }
      })
    })
  }

  static setupDeviceButtons() {
    // Device buttons functionality
    document.querySelectorAll('.preview-devices .btn').forEach((button) => {
      button.addEventListener('click', () => {
        const width = button.dataset.width
        if (!width) return

        // Find all buttons in this device group and update active state
        const deviceGroup = button.closest('.preview-devices')
        if (deviceGroup) {
          deviceGroup.querySelectorAll('.btn').forEach((btn) => {
            btn.classList.toggle('active', btn === button)
            btn.setAttribute('aria-pressed', btn === button)
          })
        }

        // Find the preview container
        const previewBox = button.closest('.preview-box') || button.closest('.preview-modal')
        if (!previewBox) return

        const container = previewBox.querySelector('.preview-container')
        if (!container) return

        // Update container width
        container.style.maxWidth = '100%'
        container.style.width = width === '100%' ? '100%' : `${width}px`
        container.style.margin = width === '100%' ? '0' : '0 auto'
      })
    })
  }

  // Initialize the Preview Manager
  static init() {
    try {
      // console.log('Initializing Preview Manager')

      // Set up event listeners for code toggles
      this.setupCodeToggles()

      // Set up event listeners for reset buttons
      this.setupResetButtons()

      // Set up event listeners for theme toggles
      this.setupThemeToggles()

      // Set up event listeners for device buttons
      this.setupDeviceButtons()

      console.log('Preview Manager initialized successfully')
    } catch (error) {
      console.error('Error initializing Preview Manager:', error)
    }
  }

  // Remove or use the unused variables in the relevant function
  static handlePreviewUpdate(previewBox) {
    const htmlEditor = window.CodeMirrorManager.getEditorFromPreviewBox(previewBox, 'html')
    const cssEditor = window.CodeMirrorManager.getEditorFromPreviewBox(previewBox, 'css')
    const jsEditor = window.CodeMirrorManager.getEditorFromPreviewBox(previewBox, 'javascript')

    if (!htmlEditor && !cssEditor && !jsEditor) {
      console.error('No editors found in preview box')
      return
    }

    const htmlContent = htmlEditor ? htmlEditor.getValue() : ''
    const cssContent = cssEditor ? cssEditor.getValue() : ''
    const jsContent = jsEditor ? jsEditor.getValue() : ''
    const theme = document.documentElement.getAttribute('data-bs-theme') || 'light'

    // Use the variables to update the preview
    this.updatePreview(previewBox, {
      html: htmlContent,
      css: cssContent,
      js: jsContent,
      theme: theme
    })
  }
}

// Initialize the Preview Manager when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.PreviewManager.init()
})
