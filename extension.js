const vscode = require("vscode");
const axios = require("axios");

async function loadOctokit() {
    const { Octokit } = await import("@octokit/rest");
    return Octokit;
}
let Octokit1;
(async () => {
    Octokit1 = await loadOctokit();
})();

// GitHub OAuth App credentials
const CLIENT_ID = "Ov23liGkKJGdjqJ1tmc6";
const CLIENT_SECRET = "820b46d46ef1b3f480b091d5f30d76bdcb12a4db";
const REDIRECT_URI = "vscode://aditya.gitbolt/auth-callback"; // Update with your extension ID

let octokit;

async function authenticate() {
    const githubUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
        REDIRECT_URI
    )}&scope=repo`;

    // Open GitHub login in browser
    const uri = vscode.Uri.parse(githubUrl);
    await vscode.env.openExternal(uri);

    vscode.window.showInformationMessage(
        "GitHub login opened in your browser. Please complete the login process."
    );
}

// Handle the redirect callback and get the access token
async function handleUri(uri) {
    const query = new URLSearchParams(uri.query);
    const code = query.get("code");

    if (!code) {
        vscode.window.showErrorMessage("Authentication failed. No code received.");
        return;
    }

    try {
        const tokenResponse = await axios.post(
            "https://github.com/login/oauth/access_token",
            {
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                code: code,
            },
            {
                headers: { Accept: "application/json" },
            }
        );

        const accessToken = tokenResponse.data.access_token;
        if (!accessToken) {
            throw new Error("No access token received.");
        }

        // Initialize Octokit with access token
        octokit = new Octokit1({
            auth: accessToken,
        });

        vscode.window.showInformationMessage("Successfully authenticated with GitHub!");
        await listRepositories();
    } catch (error) {
        vscode.window.showErrorMessage(`Authentication error: ${error.message}`);
    }
}

// List repositories after authentication
async function listRepositories() {
    if (!octokit) {
        vscode.window.showErrorMessage("Not authenticated with GitHub. Please authenticate first.");
        return;
    }

    try {
        const { data: repos } = await octokit.repos.listForAuthenticatedUser();
        const repoList = repos
            .map(
                (repo) =>
                    `Name: ${repo.name}\nDescription: ${repo.description || "No description"}\nURL: ${repo.html_url}`
            )
            .join("\n\n");

        vscode.window.showInformationMessage(`Fetched ${repos.length} repositories successfully!`);
        vscode.workspace.openTextDocument({ content: repoList }).then((doc) => {
            vscode.window.showTextDocument(doc);
        });
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to fetch repositories: ${error.message}`);
    }
}

// Extension activation
function activate(context) {
    // Register command to trigger authentication
    let disposable = vscode.commands.registerCommand("gitbolt.login", authenticate);
    context.subscriptions.push(disposable);

    // Register URI handler to handle GitHub callback
    context.subscriptions.push(
        vscode.window.registerUriHandler({
            handleUri,
        })
    );

    vscode.window.showInformationMessage("GitBolt extension activated!");
}

// Extension deactivation
function deactivate() {}

module.exports = {
    activate,
    deactivate,
};
