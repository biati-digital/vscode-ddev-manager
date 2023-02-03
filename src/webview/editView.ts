import { Disposable, Uri, ViewColumn, Webview, WebviewPanel, window } from "vscode";
import { getUri } from "../utils";

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
        this._panel.onDidDispose(this.dispose, null, this._disposables);
        this._panel.webview.html = this._getWebviewContent(this._panel.webview, extensionUri);
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
        const panel = window.createWebviewPanel("showHelloWorld", "Configure Project", ViewColumn.One, { enableScripts: true });
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
        return /*html*/ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script type="module" src="${toolkitUri}"></script>
          <script type="module" src="${mainUri}"></script>
          <title>Configure Project</title>

          <style>
            vscode-panel-view:not([hidden]) {
                display: block;
            }

            form {
                max-width: 600px;
            }

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

            <form id="task-form">

            <vscode-panels>
                <vscode-panel-tab id="basic">Basic</vscode-panel-tab>
                <vscode-panel-tab id="advanced">Services and Add-ons</vscode-panel-tab>

                <vscode-panel-view id="basic">
                    <div style="width: 100%; display: block; height: 1px;"></div>
                    <vscode-divider></vscode-divider>

                    <div class="vspacer vspacer-2"></div>
                    <div class="form-input-wrapper full">
                        <vscode-text-field id="name" name="name" autofocus="true" size="62">Project Name</vscode-text-field>
                    </div>

                    <div class="form-input-wrapper full">
                        <vscode-text-field id="path" name="path" size="62">Project Path</vscode-text-field>
                    </div>


                    <div class="form-input-wrapper">
                        <vscode-radio-group>
                            <label slot="label">Mutagen</label>
                            <vscode-radio checked>Enable</vscode-radio>
                            <vscode-radio>Disable</vscode-radio>
                        </vscode-radio-group>
                    </div>

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

            </form>
        </body>
      </html>
    `;
    }

    /**
     * Sets up an event listener to listen for messages passed from the webview context and
     * executes code based on the message that is received.
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