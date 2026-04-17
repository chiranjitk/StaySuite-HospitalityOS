import { NextRequest, NextResponse } from 'next/server';

/**
 * Swagger UI Handler for /api/docs
 * Serves the interactive Swagger UI for exploring the API
 */

export async function GET(request: NextRequest) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>StaySuite-HospitalityOS API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css">
  <style>
    html {
      box-sizing: border-box;
      overflow: -moz-scrollbars-vertical;
      overflow-y: scroll;
    }
    
    *, *:before, *:after {
      box-sizing: inherit;
    }
    
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }
    
    #swagger-ui {
      max-width: 1460px;
      margin: 0 auto;
    }
    
    /* Custom theming */
    .swagger-ui .topbar {
      background-color: #1e40af;
    }
    
    .swagger-ui .topbar .download-url-wrapper .download-url-button {
      background: #3b82f6;
    }
    
    .swagger-ui .topbar .download-url-wrapper input[type=text] {
      border: 2px solid #3b82f6;
    }
    
    .swagger-ui .info .title {
      font-size: 2rem;
    }
    
    .swagger-ui .info .title small {
      background: #3b82f6;
    }
    
    .swagger-ui .opblock-tag {
      font-size: 1.2rem;
      font-weight: 600;
    }
    
    .swagger-ui .opblock.opblock-get .opblock-summary-method {
      background: #10b981;
    }
    
    .swagger-ui .opblock.opblock-post .opblock-summary-method {
      background: #3b82f6;
    }
    
    .swagger-ui .opblock.opblock-put .opblock-summary-method {
      background: #f59e0b;
    }
    
    .swagger-ui .opblock.opblock-delete .opblock-summary-method {
      background: #ef4444;
    }
    
    /* Dark mode support */
    @media (prefers-color-scheme: dark) {
      body {
        background-color: #1f2937;
      }
      
      .swagger-ui {
        background: #1f2937;
      }
      
      .swagger-ui .info .title,
      .swagger-ui .opblock-tag,
      .swagger-ui .opblock .opblock-summary-description,
      .swagger-ui .opblock-description-wrapper p,
      .swagger-ui .opblock-external-docs-wrapper p,
      .swagger-ui .opblock-title_normal,
      .swagger-ui .tab li,
      .swagger-ui table thead tr th,
      .swagger-ui table thead tr td,
      .swagger-ui .response-col_links,
      .swagger-ui .response-col_description,
      .swagger-ui .model-title,
      .swagger-ui .parameter__name,
      .swagger-ui .parameter__type,
      .swagger-ui .prop-type,
      .swagger-ui .model-box,
      .swagger-ui .model {
        color: #e5e7eb;
      }
      
      .swagger-ui .opblock .opblock-summary {
        background: #374151;
        border-color: #4b5563;
      }
      
      .swagger-ui .opblock-body {
        background: #1f2937;
      }
      
      .swagger-ui .tab li:first-child {
        background: #374151;
      }
      
      .swagger-ui input[type=text],
      .swagger-ui input[type=password],
      .swagger-ui input[type=email],
      .swagger-ui input[type=file],
      .swagger-ui textarea,
      .swagger-ui select {
        background: #374151;
        border-color: #4b5563;
        color: #e5e7eb;
      }
      
      .swagger-ui .model-box {
        background: #374151;
        border-color: #4b5563;
      }
      
      .swagger-ui table thead {
        background: #374151;
      }
      
      .swagger-ui table tbody tr {
        background: #1f2937;
      }
      
      .swagger-ui table tbody tr:hover {
        background: #374151;
      }
      
      .swagger-ui .highlight-code {
        background: #374151;
      }
      
      .swagger-ui .copy-to-clipboard {
        background: #4b5563;
      }
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  
  <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const ui = SwaggerUIBundle({
        url: "/api/docs/openapi.json",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
        docExpansion: "list",
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
        displayOperationId: false,
        displayRequestDuration: true,
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        syntaxHighlight: {
          activate: true,
          theme: "monokai"
        },
        tryItOutEnabled: true,
        requestSnippetsEnabled: true,
        requestSnippets: {
          generators: {
            curl_bash: {
              title: "cURL (bash)",
              syntax: "bash"
            },
            curl_powershell: {
              title: "cURL (PowerShell)",
              syntax: "powershell"
            },
            curl_cmd: {
              title: "cURL (CMD)",
              syntax: "bash"
            }
          },
          defaultExpanded: true,
          languages: null
        }
      });
      
      window.ui = ui;
    };
  </script>
</body>
</html>
  `;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
