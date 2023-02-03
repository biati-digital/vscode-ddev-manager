import { Disposable, Uri, ViewColumn, Webview, WebviewPanel, window } from "vscode";
import { getUri } from "../utils";

/**
 * This class manages the state and behavior of HelloWorld webview panels.
 *
 * It contains all the data and methods for:
 *
 * - Creating and rendering HelloWorld webview panels
 * - Properly cleaning up and disposing of webview resources when the panel is closed
 * - Setting the HTML (and by proxy CSS/JavaScript) content of the webview panel
 * - Setting message listeners so data can be passed between the webview and extension
 */
export class DDEVFormProjectPanel {
    public static currentPanel: DDEVFormProjectPanel | undefined;
    private readonly _panel: WebviewPanel;
    private _disposables: Disposable[] = [];

    /**
     * The DDEVFormProjectPanel class private constructor (called only from the render method).
     *
     * @param panel A reference to the webview panel
     * @param extensionUri The URI of the directory containing the extension
     */
    private constructor(panel: WebviewPanel, extensionUri: Uri) {
        this._panel = panel;

        // Set an event listener to listen for when the panel is disposed (i.e. when the user closes
        // the panel or when the panel is closed programmatically)
        this._panel.onDidDispose(this.dispose, null, this._disposables);

        // Set the HTML content for the webview panel
        this._panel.webview.html = this._getWebviewContent(this._panel.webview, extensionUri);

        // Set an event listener to listen for messages passed from the webview context
        this._setWebviewMessageListener(this._panel.webview);
    }

    /**
     * Renders the current webview panel if it exists otherwise a new webview panel
     * will be created and displayed.
     *
     * @param extensionUri The URI of the directory containing the extension.
     */
    public static render(extensionUri: Uri) {
        if (DDEVFormProjectPanel.currentPanel) {
            DDEVFormProjectPanel.currentPanel._panel.reveal(ViewColumn.One);
            return;
        }

        // If a webview panel does not already exist create and show a new one
        const panel = window.createWebviewPanel(
            // Panel view type
            "showHelloWorld",
            // Panel title
            "Configure Project",
            // The editor column the panel should be displayed in
            ViewColumn.One,
            {
                enableScripts: true,
            }
        );

        DDEVFormProjectPanel.currentPanel = new DDEVFormProjectPanel(panel, extensionUri);
    }

    /**
     * Cleans up and disposes of webview resources when the webview panel is closed.
     */
    public dispose() {
        DDEVFormProjectPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    /**
     * Defines and returns the HTML that should be rendered within the webview panel.
     *
     * @remarks This is also the place where references to CSS and JavaScript files/packages
     * (such as the Webview UI Toolkit) are created and inserted into the webview HTML.
     *
     * @param webview A reference to the extension webview
     * @param extensionUri The URI of the directory containing the extension
     * @returns A template string literal containing the HTML that should be
     * rendered within the webview panel
     */
    private _getWebviewContent(webview: Webview, extensionUri: Uri) {
        const toolkitUri = getUri(webview, extensionUri, [
            "node_modules",
            "@vscode",
            "webview-ui-toolkit",
            "dist",
            "toolkit.js",
        ]);
        const mainUri = getUri(webview, extensionUri, ["webview-ui", "main.js"]);

        // Tip: Install the es6-string-html VS Code extension to enable code highlighting below
        return /*html*/ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script type="module" src="${toolkitUri}"></script>
          <script type="module" src="${mainUri}"></script>
          <title>Add New Project</title>

          <style>
            .form-input-footer {
                display: block;
                margin-bottom: 10px;
            }

            .form-input-group {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 12px;
            }

            .form-input-wrapper {
                display: flex;
                flex-wrap: wrap;
                flex-direction: column;
                gap: 4px;
                margin-bottom: 8px;
            }

            .form-input-block.full > label {
                margin-bottom
            }

            .form-input-footer {
                margin-top: 1rem;
            }

            label.full {
                display: block;
                width: 100%;
            }
            label.side {
                display: inline-block;
                margin-right: 0.6rem;
                margin-top: 0.3rem;
            }

            small {
                max-width: 469px;
                display: block;
                line-height: 1.5;
                opacity: 0.5;
                margin: 0.6rem 0;
            }

            .vspacer {
                display: block;
                width: 100%;
                height: 6px;
            }

            .vspacer-2 {
                height: 10px;
            }
          </style>
        </head>
        <body>
          <h2>Configure DDEV Project</h2>
          <p>This is just an idea, it currently does not work</p>


          <vscode-panels>
            <vscode-panel-tab id="basic">Basic</vscode-panel-tab>
            <vscode-panel-tab id="advanced">Services and Add-ons</vscode-panel-tab>

            <vscode-panel-view id="basic">
            <form id="task-form">
                <vscode-divider></vscode-divider>

                <div class="vspacer vspacer-2"></div>
                <div class="form-input-wrapper full">
                    <vscode-text-field id="name" name="name" autofocus="true" size="62">Project Name</vscode-text-field>
                </div>

                <div class="form-input-wrapper full">
                    <vscode-text-field id="path" name="path" size="62">Project Path</vscode-text-field>
                </div>


            <div class="form-input-group">
                <div class="form-input-wrapper full">
                    <label>Project Type:</label>
                    <vscode-dropdown id="type" name="type">
                        <vscode-option>WordPress</vscode-option>
                        <vscode-option>Typo3</vscode-option>
                        <vscode-option>Craft CMS</vscode-option>
                        <vscode-option>Laravel</vscode-option>
                        <vscode-option>Magento</vscode-option>
                        <vscode-option>Magento 2</vscode-option>
                        <vscode-option>PHP App</vscode-option>
                        <vscode-option>Shopware 6</vscode-option>
                        <vscode-option>Drupal 10</vscode-option>
                        <vscode-option>Drupal 9</vscode-option>
                        <vscode-option>Drupal 8</vscode-option>
                        <vscode-option>Drupal 7</vscode-option>
                        <vscode-option>Drupal 6</vscode-option>
                    </vscode-dropdown>
                </div>

                <div class="form-input-wrapper full">
                    <label>Database Server:</label>
                    <vscode-dropdown id="database" name="database">
                        <vscode-option>MySQL 8.0</vscode-option>
                        <vscode-option>MySQL 5.7</vscode-option>
                        <vscode-option>MySQL 5.6</vscode-option>
                        <vscode-option>MySQL 5.5</vscode-option>
                        <vscode-option>MariaDB 10.8</vscode-option>
                        <vscode-option>MariaDB 10.7</vscode-option>
                        <vscode-option>MariaDB 10.6</vscode-option>
                        <vscode-option>MariaDB 10.5</vscode-option>
                        <vscode-option>MariaDB 10.4</vscode-option>
                        <vscode-option>MariaDB 10.3</vscode-option>
                        <vscode-option>MariaDB 10.2</vscode-option>
                        <vscode-option>MariaDB 10.1</vscode-option>
                        <vscode-option>MariaDB 10.0</vscode-option>
                        <vscode-option>MariaDB 5.5</vscode-option>
                    </vscode-dropdown>
                </div>
            </div>

            <div class="form-input-group">
                <div class="form-input-wrapper full">
                    <label>PHP Version:</label>
                    <vscode-dropdown id="php_version" name="php_version">
                        <vscode-option>PHP 8.2</vscode-option>
                        <vscode-option>PHP 8.1</vscode-option>
                        <vscode-option>PHP 8.0</vscode-option>
                        <vscode-option>PHP 7.4</vscode-option>
                        <vscode-option>PHP 7.3</vscode-option>
                        <vscode-option>PHP 7.2</vscode-option>
                        <vscode-option>PHP 7.1</vscode-option>
                        <vscode-option>PHP 7.0</vscode-option>
                        <vscode-option>PHP 5.6</vscode-option>
                    </vscode-dropdown>
                </div>

                <div class="form-input-wrapper full">
                    <label>NodeJS:</label>
                    <vscode-dropdown id="nodejs_version" name="nodejs_version">
                        <vscode-option>NodeJS 18</vscode-option>
                        <vscode-option>NodeJS 16</vscode-option>
                        <vscode-option>NodeJS 14</vscode-option>
                        <vscode-option>Disabled</vscode-option>
                    </vscode-dropdown>
                </div>
            </div>



            <div class="form-input-wrapper">
                <vscode-radio-group>
                    <label slot="label">Mutagen</label>
                    <vscode-radio checked>Enable</vscode-radio>
                    <vscode-radio>Disable</vscode-radio>
                </vscode-radio-group>
            </div>


          </form>

            </vscode-panel-view>
            <vscode-panel-view id="advanced">
                    <div class="form-input-wrapper">
                        <h3 style="margin-bottom: 5px;">Install Services & Add-ons</h3>
                        <vscode-divider></vscode-divider>
                        <vscode-checkbox>Adminer service</vscode-checkbox>
                        <vscode-checkbox>Beanstalkd</vscode-checkbox>
                        <vscode-checkbox>Auto-refresh HTTPS page on changes</vscode-checkbox>
                        <vscode-checkbox>Schedule commands to execute within DDEV</vscode-checkbox>
                        <vscode-checkbox>Drupal 9 Apache Solr installation</vscode-checkbox>
                        <vscode-checkbox>Elasticsearch add-on</vscode-checkbox>
                        <vscode-checkbox>Install Memcached as an extra service</vscode-checkbox>
                        <vscode-checkbox>MongoDB add-on</vscode-checkbox>
                        <vscode-checkbox>PDFreactor service</vscode-checkbox>
                        <vscode-checkbox>Add integration with Platform.sh hosting service</vscode-checkbox>
                        <vscode-checkbox>Support HTTP/HTTPS proxies with DDEV</vscode-checkbox>
                        <vscode-checkbox>Redis service for DDEV</vscode-checkbox>
                        <vscode-checkbox>Redis Commander for use with DDEV Redis service</vscode-checkbox>
                        <vscode-checkbox>A DDEV service for running standalone Chrome</vscode-checkbox>
                        <vscode-checkbox>Varnish reverse proxy add-on for DDEV</vscode-checkbox>
                    </div>
            </vscode-panel-view>
          </vscode-panels>


            <div style="width: 100%; display: block; height: 1px;"></div>
            <div class="form-input-footer">
                <vscode-button id="howdy">Create Project</vscode-button>
            </div>


        </body>
      </html>
    `;
    }

    /**
     * Sets up an event listener to listen for messages passed from the webview context and
     * executes code based on the message that is recieved.
     *
     * @param webview A reference to the extension webview
     * @param context A reference to the extension context
     */
    private _setWebviewMessageListener(webview: Webview) {
        webview.onDidReceiveMessage(
            (message: any) => {
                console.log('message', message);
                const command = message.command;
                const text = message.text;

                switch (command) {
                    case "hello":
                        // Code that should run in response to the hello message command
                        window.showInformationMessage(text);
                        return;
                    // Add more switch case statements here as more webview message commands
                    // are created within the webview context (i.e. inside media/main.js)
                }
            },
            undefined,
            this._disposables
        );
    }
}